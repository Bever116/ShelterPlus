import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, CardCategory, VoteSource, PlayerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordService } from '../discord/discord.service';
import { APOCALYPSE_POOL, BUNKER_POOL, CATEGORY_POOLS } from './card-pool';
import seedrandom from 'seedrandom';
import { createHash } from 'crypto';
import { CARD_CATEGORY_ORDER } from '@shelterplus/shared';
import { GameGateway } from './game.gateway';

type LobbyWithPlayers = Prisma.LobbyGetPayload<{
  include: { players: true };
}>;

type LobbyPlayer = LobbyWithPlayers['players'][number];

type CardTemplate = {
  category: CardCategory;
  value: string;
};

@Injectable()
export class GameService {
  constructor(
    private prisma: PrismaService,
    private discord: DiscordService,
    private gateway: GameGateway
  ) {}

  async startFromLobby(lobbyId: string) {
    const lobby = await this.prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: { players: true, game: { include: { players: true } } }
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    if (!lobby.players.length) {
      throw new BadRequestException('Cannot start game without players');
    }

    if (lobby.game) {
      throw new BadRequestException('Game already started');
    }

    const enabledCategories = lobby.enabledCategories as Record<CardCategory, boolean>;
    const seed = this.createSeed(lobby);
    const rng = seedrandom(seed);

    const apocalypse = this.pickItem(APOCALYPSE_POOL, rng);
    const bunker = this.pickItem(BUNKER_POOL, rng);
    const seats = Math.floor(lobby.players.length / 2);

    const dealt = this.dealCards(lobby.players, enabledCategories, rng);

    const createdGame = await this.prisma.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          lobbyId: lobby.id,
          apocalypse,
          bunker,
          seats,
          players: {
            create: dealt.map((player) => ({
              number: player.number,
              nickname: player.nickname,
              discordId: player.discordId,
              status: 'ALIVE',
              role: 'PLAYER',
              cards: {
                create: player.cards.map((card) => ({
                  category: card.category,
                  payload: { title: card.value },
                  isOpen: false
                }))
              }
            }))
          },
          events: {
            create: [
              {
                type: 'GAME_STARTED',
                payload: {
                  apocalypse,
                  bunker,
                  seats,
                  players: lobby.players.length
                }
              }
            ]
          }
        },
        include: {
          players: { include: { cards: true } },
          events: true
        }
      });

      return {
        ...game,
        players: [...game.players].sort((a, b) => a.number - b.number)
      };
    });

    await this.sendDiscordNotifications(createdGame, lobby);

    return createdGame;
  }

  async getGame(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          orderBy: { number: 'asc' },
          include: { cards: true }
        }
      }
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return {
      ...game,
      revealPlans: game.revealPlans.map((plan) => ({
        ...plan,
        categories: Array.isArray(plan.categories) ? plan.categories : []
      }))
    };
  }

  async getState(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        lobby: true,
        players: {
          orderBy: { number: 'asc' },
          include: { cards: true }
        },
        votes: true,
        minuteQueue: { orderBy: { position: 'asc' } },
        revealPlans: true
      }
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return game;
  }

  async startRound(gameId: string, round: number) {
    const game = await this.getState(gameId);
    if (round <= game.currentRound) {
      throw new BadRequestException('Round must advance');
    }

    const updated = await this.prisma.game.update({
      where: { id: gameId },
      data: {
        currentRound: round,
        events: {
          create: {
            type: 'ROUND_STARTED',
            payload: { round }
          }
        }
      }
    });

    if (round === 1) {
      const professionCards = await this.prisma.card.findMany({
        where: { player: { gameId }, category: 'Profession' },
        include: { player: true }
      });
      const opened = professionCards.filter((card) => !card.isOpen);
      await Promise.all(
        opened.map((card) =>
          this.prisma.card.update({
            where: { id: card.id },
            data: {
              isOpen: true,
              openedAt: new Date(),
              openedRound: round
            }
          })
        )
      );
      opened.forEach((card) =>
        this.gateway.emitToGame(gameId, 'char:open', { playerId: card.playerId, category: card.category })
      );
      if (opened.length) {
        await this.prisma.gameEvent.create({
          data: {
            gameId,
            type: 'ROUND_AUTO_REVEAL',
            payload: {
              round,
              category: 'Profession',
              players: opened.map((card) => card.playerId)
            }
          }
        });
      }
    }

    this.gateway.emitToGame(gameId, 'round:change', { currentRound: updated.currentRound });
    return updated;
  }

  async endRound(gameId: string, round: number) {
    await this.ensureRound(gameId, round);
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        events: {
          create: {
            type: 'ROUND_ENDED',
            payload: { round }
          }
        }
      }
    });

    return { round };
  }

  async preselectCategories(gameId: string, playerId: string, round: number, categories: CardCategory[]) {
    await this.ensureRound(gameId, round);

    const plan = await this.prisma.revealPlan.upsert({
      where: {
        gameId_playerId_round: {
          gameId,
          playerId,
          round
        }
      },
      create: {
        gameId,
        playerId,
        round,
        categories: categories as Prisma.InputJsonValue
      },
      update: {
        categories: categories as Prisma.InputJsonValue
      }
    });

    this.gateway.emitToGame(gameId, 'char:preselect', { playerId, categories });
    await this.prisma.gameEvent.create({
      data: {
        gameId,
        type: 'REVEAL_PRESELECTED',
        payload: { playerId, round, categories }
      }
    });
    return plan;
  }

  async openCategory(gameId: string, playerId: string, category: CardCategory, round: number) {
    const card = await this.prisma.card.findFirst({
      where: { playerId, category }
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    if (card.isOpen) {
      return card;
    }

    const updated = await this.prisma.card.update({
      where: { id: card.id },
      data: {
        isOpen: true,
        openedAt: new Date(),
        openedRound: round
      }
    });

    await this.prisma.gameEvent.create({
      data: {
        gameId,
        type: 'CARD_OPENED',
        payload: {
          playerId,
          category,
          round
        }
      }
    });

    this.gateway.emitToGame(gameId, 'char:open', { playerId, category });
    return updated;
  }

  async enqueueMinute(gameId: string, round: number, playerId: string) {
    const existing = await this.prisma.minuteRequest.findFirst({
      where: { gameId, round, playerId }
    });

    if (existing) {
      return existing;
    }

    const position =
      (await this.prisma.minuteRequest.count({
        where: { gameId, round }
      })) + 1;

    const request = await this.prisma.minuteRequest.create({
      data: {
        gameId,
        round,
        playerId,
        position
      }
    });

    await this.prisma.gameEvent.create({
      data: {
        gameId,
        type: 'MINUTE_ENQUEUED',
        payload: { playerId, round, position }
      }
    });
    this.emitMinutes(gameId);
    return request;
  }

  async approveMinute(gameId: string, playerId: string, round: number) {
    const request = await this.prisma.minuteRequest.findFirst({
      where: { gameId, round, playerId }
    });

    if (!request) {
      throw new NotFoundException('Minute request not found');
    }

    const updated = await this.prisma.minuteRequest.update({
      where: { id: request.id },
      data: { approved: true }
    });

    await this.prisma.gameEvent.create({
      data: {
        gameId,
        type: 'MINUTE_APPROVED',
        payload: { playerId, round }
      }
    });
    this.emitMinutes(gameId);
    return updated;
  }

  async controlMinuteTimer(
    gameId: string,
    playerId: string | null,
    action: 'start' | 'stop' | 'reset',
    durationSec?: number
  ) {
    const minute = playerId
      ? await this.prisma.minuteRequest.findFirst({ where: { gameId, playerId }, orderBy: { createdAt: 'desc' } })
      : await this.prisma.minuteRequest.findFirst({ where: { gameId, approved: true }, orderBy: { updatedAt: 'desc' } });

    if (!minute) {
      throw new NotFoundException('No minute request available');
    }

    const game = await this.prisma.game.findUnique({ include: { lobby: true }, where: { id: gameId } });
    const defaultDuration = game?.lobby ? (game.lobby.minuteDurationSec ?? 60) : 60;

    let startedAt: Date | null = minute.startedAt;
    let storedDuration = minute.durationSec ?? durationSec ?? defaultDuration;

    if (action === 'start') {
      startedAt = new Date();
      storedDuration = durationSec ?? storedDuration;
    }

    if (action === 'stop') {
      startedAt = null;
    }

    if (action === 'reset') {
      startedAt = new Date();
      storedDuration = durationSec ?? storedDuration;
    }

    const updated = await this.prisma.minuteRequest.update({
      where: { id: minute.id },
      data: {
        startedAt,
        durationSec: storedDuration
      }
    });

    await this.prisma.gameEvent.create({
      data: {
        gameId,
        type: 'MINUTE_TIMER',
        payload: { action, playerId: minute.playerId, durationSec: storedDuration }
      }
    });
    this.emitMinutes(gameId);
    return updated;
  }

  async startVoting(gameId: string, round: number) {
    await this.ensureRound(gameId, round);
    await this.prisma.gameEvent.create({
      data: {
        gameId,
        type: 'VOTING_STARTED',
        payload: { round }
      }
    });
    await this.gatewayEmitVotes(gameId);
    return { round };
  }

  async stopVoting(gameId: string, round: number) {
    await this.ensureRound(gameId, round);
    await this.prisma.gameEvent.create({
      data: {
        gameId,
        type: 'VOTING_STOPPED',
        payload: { round }
      }
    });
    await this.gatewayEmitVotes(gameId);
    return { round };
  }

  async revote(gameId: string, round: number) {
    await this.ensureRound(gameId, round);
    await this.prisma.vote.updateMany({
      where: { gameId, round },
      data: { targetPlayerId: null }
    });
    await this.prisma.gameEvent.create({
      data: {
        gameId,
        type: 'VOTING_REVOTE',
        payload: { round }
      }
    });
    await this.gatewayEmitVotes(gameId);
    return { round };
  }

  async castVote(
    gameId: string,
    round: number,
    voterPlayerId: string,
    targetPlayerId: string | null,
    source: VoteSource
  ) {
    await this.ensureRound(gameId, round);

    const vote = await this.prisma.vote.upsert({
      where: {
        gameId_round_voterPlayerId: {
          gameId,
          round,
          voterPlayerId
        }
      },
      create: {
        gameId,
        round,
        voterPlayerId,
        targetPlayerId,
        source
      },
      update: {
        targetPlayerId,
        source
      }
    });

    await this.gatewayEmitVotes(gameId);
    await this.prisma.gameEvent.create({
      data: {
        gameId,
        type: 'VOTE_CAST',
        payload: { round, voterPlayerId, targetPlayerId, source }
      }
    });
    return vote;
  }

  async kickPlayer(gameId: string, playerId: string) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player || player.gameId !== gameId) {
      throw new NotFoundException('Player not found');
    }

    const updated = await this.prisma.player.update({
      where: { id: playerId },
      data: { status: PlayerStatus.OUT }
    });

    await this.prisma.gameEvent.create({
      data: {
        gameId,
        type: 'PLAYER_KICKED',
        payload: { playerId }
      }
    });

    this.gateway.emitToGame(gameId, 'player:kicked', { playerId });
    await this.gatewayEmitVotes(gameId);
    return updated;
  }

  private async ensureRound(gameId: string, round: number) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    if (round > game.currentRound + 1) {
      throw new BadRequestException('Round progression invalid');
    }
    return game;
  }

  private async gatewayEmitVotes(gameId: string) {
    const votes = await this.prisma.vote.findMany({ where: { gameId } });
    const tallies: Record<string, number> = {};
    for (const vote of votes) {
      if (!vote.targetPlayerId) {
        continue;
      }
      tallies[vote.targetPlayerId] = (tallies[vote.targetPlayerId] ?? 0) + 1;
    }

    const voterSources: Record<string, VoteSource> = {};
    for (const vote of votes) {
      voterSources[vote.voterPlayerId] = vote.source;
    }

    this.gateway.emitToGame(gameId, 'vote:stats', { tallies, voterSources });
  }

  private async emitMinutes(gameId: string) {
    const queue = await this.prisma.minuteRequest.findMany({
      where: { gameId },
      orderBy: { position: 'asc' }
    });

    const running = queue.find((item) => item.startedAt);
    let remaining = 0;
    if (running?.startedAt && running.durationSec) {
      const elapsed = (Date.now() - running.startedAt.getTime()) / 1000;
      remaining = Math.max(0, running.durationSec - Math.floor(elapsed));
    }

    this.gateway.emitToGame(gameId, 'minutes:queue', {
      queue: queue.map((item) => item.playerId),
      approved: queue.filter((item) => item.approved).map((item) => item.playerId)
    });

    this.gateway.emitToGame(gameId, 'minutes:timer', {
      running: Boolean(running?.startedAt),
      remainingSec: remaining,
      currentPlayerId: running?.playerId ?? null
    });
  }

  private createSeed(lobby: LobbyWithPlayers) {
    const channels = lobby.channelsConfig as { guildId?: string } | null;
    const seedString = [
      channels?.guildId ?? 'web',
      lobby.id,
      lobby.createdAt.getTime().toString(),
      lobby.rounds.toString(),
      JSON.stringify(lobby.enabledCategories)
    ].join('::');

    return createHash('sha256').update(seedString).digest('hex');
  }

  private pickItem<T>(pool: T[], rng: seedrandom.prng): T {
    const index = Math.floor(rng() * pool.length);
    return pool[index % pool.length];
  }

  private dealCards(players: LobbyPlayer[], enabled: Record<CardCategory, boolean>, rng: seedrandom.prng) {
    const categoryPools: Record<CardCategory, string[]> = {} as Record<CardCategory, string[]>;
    const usedValues: Record<CardCategory, Set<string>> = {} as Record<CardCategory, Set<string>>;
    const fallbackCounters: Record<CardCategory, number> = {} as Record<CardCategory, number>;

    for (const category of CARD_CATEGORY_ORDER) {
      if (!enabled[category]) {
        continue;
      }
      categoryPools[category] = [...(CATEGORY_POOLS[category] ?? [])];
      usedValues[category] = new Set();
      fallbackCounters[category] = 0;
    }

    const drawCard = (category: CardCategory): CardTemplate => {
      const pool = categoryPools[category] ?? [];
      const allowDuplicates = category === 'ActionCard' || category === 'ConditionCard';
      let value: string | undefined;

      if (!allowDuplicates) {
        const available = pool.filter((item) => !usedValues[category].has(item));
        if (available.length > 0) {
          const index = Math.floor(rng() * available.length);
          value = available[index % available.length];
        }
      } else if (pool.length > 0) {
        const index = Math.floor(rng() * pool.length);
        value = pool[index % pool.length];
      }

      if (!value) {
        const counter = (fallbackCounters[category] += 1);
        value = `${category} - Generated ${counter}`;
      }

      if (!allowDuplicates) {
        usedValues[category].add(value);
      }

      return {
        category,
        value
      };
    };

    return players
      .sort((a, b) => a.number - b.number)
      .map((player) => ({
        id: player.id,
        number: player.number,
        nickname: player.nickname,
        discordId: player.discordId,
        cards: CARD_CATEGORY_ORDER.filter((category) => enabled[category]).map((category) => drawCard(category))
      }));
  }

  private async sendDiscordNotifications(
    game: Prisma.GameGetPayload<{ include: { players: { include: { cards: true } } } }>,
    lobby: LobbyWithPlayers
  ) {
    const channels = lobby.channelsConfig as {
      textChannelId?: string;
    } | null;

    const players = [...game.players].sort((a, b) => a.number - b.number);

    if (channels?.textChannelId) {
      await this.discord.postToChannel(
        channels.textChannelId,
        `**Apocalypse**: ${game.apocalypse}\n**Bunker**: ${game.bunker}`
      );

      const chunkSize = 4;
      for (let i = 0; i < players.length; i += chunkSize) {
        const chunk = players.slice(i, i + chunkSize);
        const content = chunk
          .map((player) => `**${player.number}. ${player.nickname}**\n${player.cards
            .map((card) => `- ${card.category}: _hidden_`)
            .join('\n')}`)
          .join('\n\n');
        await this.discord.postToChannel(channels.textChannelId, content);
      }
    }

    await Promise.all(
      players.map((player) => {
        if (!player.discordId) {
          return Promise.resolve();
        }

        const message = (
          [`Apocalypse: ${game.apocalypse}`, `Bunker: ${game.bunker}`, 'Your cards:'] as string[]
        ).concat(
          player.cards.map((card) => {
            const payload = card.payload as { title?: string };
            const title = payload?.title ?? 'Unknown';
            return `${card.category}: ${title}`;
          })
        ).join('\n');

        return this.discord.sendDirectMessage(player.discordId, message);
      })
    );
  }
}
