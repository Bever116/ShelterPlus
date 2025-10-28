import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, CardCategory, VoteSource, PlayerStatus, PlayerRole, GameAdminRole, InviteRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordService } from '../discord/discord.service';
import { APOCALYPSE_BUNKER_POOL, CATEGORY_POOLS, ENDING_POOL } from './card-pool';
import seedrandom from 'seedrandom';
import { createHash, randomBytes } from 'crypto';
import { CARD_CATEGORY_ORDER, type GamePublicState } from '@shelterplus/shared';
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

  private async recordEvent(gameId: string, type: string, payload: Record<string, unknown>) {
    const event = await this.prisma.gameEvent.create({
      data: { gameId, type, payload }
    });

    this.gateway.emitToGame(gameId, 'events:append', { items: [event] });
    return event;
  }

  private async getPublicState(gameId: string): Promise<GamePublicState> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          orderBy: { number: 'asc' },
          include: { cards: true }
        },
        votes: true
      }
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const tallies: Record<string, number> = {};
    for (const vote of game.votes) {
      if (!vote.targetPlayerId) continue;
      tallies[vote.targetPlayerId] = (tallies[vote.targetPlayerId] ?? 0) + 1;
    }

    return {
      id: game.id,
      apocalypse: game.apocalypse,
      bunker: game.bunker,
      seats: game.seats,
      currentRound: game.currentRound,
      ending: (game.ending as Record<string, unknown> | null) ?? null,
      players: game.players.map((player) => ({
        id: player.id,
        number: player.number,
        nickname: player.nickname,
        status: player.status,
        role: player.role,
        openedCards: player.cards
          .filter((card) => card.isOpen)
          .map((card) => ({
            category: card.category,
            payload: card.payload as Record<string, unknown>,
            openedAt: card.openedAt?.toISOString() ?? null,
            openedRound: card.openedRound ?? null
          }))
      })),
      votes: tallies,
      updatedAt: new Date().toISOString()
    };
  }

  private async broadcastPublicState(gameId: string) {
    try {
      const state = await this.getPublicState(gameId);
      this.gateway.emitToGame(gameId, 'spectator:state', { publicState: state });
    } catch (error) {
      if (error instanceof NotFoundException) {
        return;
      }
      throw error;
    }
  }

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

    const { apocalypse, bunker } = this.pickItem(APOCALYPSE_BUNKER_POOL, rng);
    const seats = Math.floor(lobby.players.length / 2);

    const dealt = this.dealCards(lobby.players, enabledCategories, rng);

    const hostUserId = lobby.players[0]?.discordId ?? `host-${lobby.id}`;

    const createdGame = await this.prisma.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          lobbyId: lobby.id,
          apocalypse,
          bunker,
          seats,
          isSpectatorsEnabled: true,
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
          admins: {
            create: {
              userId: hostUserId,
              role: GameAdminRole.HOST
            }
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

    await this.recordEvent(createdGame.id, 'GAME_STARTED', {
      apocalypse,
      bunker,
      seats,
      players: lobby.players.length
    });

    await this.sendDiscordNotifications(createdGame, lobby);

    await this.broadcastPublicState(createdGame.id);

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
        revealPlans: true,
        admins: true,
        invites: true
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
        currentRound: round
      }
    });

    await this.recordEvent(gameId, 'ROUND_STARTED', { round });

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
        await this.recordEvent(gameId, 'ROUND_AUTO_REVEAL', {
          round,
          category: 'Profession',
          players: opened.map((card) => card.playerId)
        });
      }
    }

    this.gateway.emitToGame(gameId, 'round:change', { currentRound: updated.currentRound });
    await this.broadcastPublicState(gameId);
    return updated;
  }

  async endRound(gameId: string, round: number) {
    await this.ensureRound(gameId, round);
    await this.recordEvent(gameId, 'ROUND_ENDED', { round });
    await this.broadcastPublicState(gameId);

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
    await this.recordEvent(gameId, 'REVEAL_PRESELECTED', { playerId, round, categories });
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

    await this.recordEvent(gameId, 'CARD_OPENED', {
      playerId,
      category,
      round
    });

    this.gateway.emitToGame(gameId, 'char:open', { playerId, category });
    await this.broadcastPublicState(gameId);
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

    await this.recordEvent(gameId, 'MINUTE_ENQUEUED', { playerId, round, position });
    this.emitMinutes(gameId);
    await this.broadcastPublicState(gameId);
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

    await this.recordEvent(gameId, 'MINUTE_APPROVED', { playerId, round });
    this.emitMinutes(gameId);
    await this.broadcastPublicState(gameId);
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

    await this.recordEvent(gameId, 'MINUTE_TIMER', {
      action,
      playerId: minute.playerId,
      durationSec: storedDuration
    });
    this.emitMinutes(gameId);
    await this.broadcastPublicState(gameId);
    return updated;
  }

  async startVoting(gameId: string, round: number) {
    await this.ensureRound(gameId, round);
    await this.recordEvent(gameId, 'VOTING_STARTED', { round });
    await this.gatewayEmitVotes(gameId);
    await this.broadcastPublicState(gameId);
    return { round };
  }

  async stopVoting(gameId: string, round: number) {
    await this.ensureRound(gameId, round);
    await this.recordEvent(gameId, 'VOTING_STOPPED', { round });
    await this.gatewayEmitVotes(gameId);
    await this.broadcastPublicState(gameId);
    return { round };
  }

  async revote(gameId: string, round: number) {
    await this.ensureRound(gameId, round);
    await this.prisma.vote.updateMany({
      where: { gameId, round },
      data: { targetPlayerId: null }
    });
    await this.recordEvent(gameId, 'VOTING_REVOTE', { round });
    await this.gatewayEmitVotes(gameId);
    await this.broadcastPublicState(gameId);
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
    await this.recordEvent(gameId, 'VOTE_CAST', { round, voterPlayerId, targetPlayerId, source });
    await this.broadcastPublicState(gameId);
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

    await this.recordEvent(gameId, 'PLAYER_KICKED', { playerId });

    this.gateway.emitToGame(gameId, 'player:kicked', { playerId });
    await this.gatewayEmitVotes(gameId);
    await this.broadcastPublicState(gameId);
    return updated;
  }

  async getPublicGame(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { isSpectatorsEnabled: true }
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (!game.isSpectatorsEnabled) {
      throw new ForbiddenException('Spectator access disabled');
    }

    return this.getPublicState(gameId);
  }

  async createSpectatorInvite(gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    if (!game.isSpectatorsEnabled) {
      throw new ForbiddenException('Spectators are disabled for this game');
    }
    return this.createInvite(gameId, InviteRole.SPECTATOR);
  }

  async createCoHostInvite(gameId: string) {
    await this.ensureGameExists(gameId);
    return this.createInvite(gameId, InviteRole.CO_HOST);
  }

  async acceptInvite(code: string, userId: string, nickname: string) {
    const invite = await this.prisma.invite.findUnique({ where: { code } });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite expired');
    }

    const updateData: Prisma.InviteUpdateInput = {};
    if (!invite.usedByUserId) {
      updateData.usedByUserId = userId;
    } else if (invite.usedByUserId !== userId) {
      throw new BadRequestException('Invite already used');
    }

    if (Object.keys(updateData).length) {
      await this.prisma.invite.update({ where: { id: invite.id }, data: updateData });
    }

    if (invite.role === InviteRole.CO_HOST) {
      await this.prisma.gameAdmin.upsert({
        where: {
          gameId_userId: {
            gameId: invite.gameId,
            userId
          }
        },
        create: {
          gameId: invite.gameId,
          userId,
          role: GameAdminRole.CO_HOST
        },
        update: {
          role: GameAdminRole.CO_HOST
        }
      });
      await this.recordEvent(invite.gameId, 'CO_HOST_ADDED', { userId });
      return { role: InviteRole.CO_HOST };
    }

    if (invite.role === InviteRole.SPECTATOR) {
      const game = await this.prisma.game.findUnique({ where: { id: invite.gameId } });
      if (!game) {
        throw new NotFoundException('Game not found');
      }
      if (!game.isSpectatorsEnabled) {
        throw new ForbiddenException('Spectators are disabled');
      }

      let spectator = await this.prisma.player.findFirst({
        where: { gameId: invite.gameId, discordId: userId, role: PlayerRole.SPECTATOR }
      });

      if (!spectator) {
        const spectatorCount = await this.prisma.player.count({
          where: { gameId: invite.gameId, role: PlayerRole.SPECTATOR }
        });
        spectator = await this.prisma.player.create({
          data: {
            gameId: invite.gameId,
            discordId: userId,
            number: 1000 + spectatorCount + 1,
            nickname,
            status: PlayerStatus.OUT,
            role: PlayerRole.SPECTATOR
          }
        });
        await this.recordEvent(invite.gameId, 'SPECTATOR_JOINED', { playerId: spectator.id });
      }

      await this.broadcastPublicState(invite.gameId);
      return { role: InviteRole.SPECTATOR, playerId: spectator.id };
    }

    throw new BadRequestException('Unsupported invite role');
  }

  async listEvents(
    gameId: string,
    filters: { type?: string; playerId?: string; from?: Date; to?: Date },
    take = 50,
    cursor?: string
  ) {
    await this.ensureGameExists(gameId);
    const where: Prisma.GameEventWhereInput = { gameId };
    if (filters.type) {
      where.type = filters.type;
    }
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (filters.from) {
      createdAtFilter.gte = filters.from;
    }
    if (filters.to) {
      createdAtFilter.lte = filters.to;
    }
    if (Object.keys(createdAtFilter).length) {
      where.createdAt = createdAtFilter;
    }

    const events = await this.prisma.gameEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor }
          }
        : {})
    });

    if (filters.playerId) {
      return events.filter((event) => {
        const payload = event.payload as Record<string, unknown> | null;
        return payload?.playerId === filters.playerId;
      });
    }

    return events;
  }

  async exportGame(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: { include: { cards: true } },
        votes: true,
        minuteQueue: true,
        revealPlans: true,
        events: true
      }
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return game;
  }

  async triggerEnding(gameId: string) {
    const game = await this.prisma.game.findUnique({ include: { lobby: true }, where: { id: gameId } });
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.ending) {
      throw new BadRequestException('Ending already selected');
    }

    const lobby = await this.prisma.lobby.findUnique({
      where: { id: game.lobbyId },
      include: { players: true }
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    const seed = this.createSeed(lobby);
    const rng = seedrandom(`${seed}::ending`);
    const index = Math.floor(rng() * ENDING_POOL.length) % ENDING_POOL.length;
    const ending = ENDING_POOL[index];

    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        ending: ending as Prisma.InputJsonValue
      }
    });

    await this.recordEvent(gameId, 'ENDING_TRIGGERED', ending);

    const channels = lobby.channelsConfig as { textChannelId?: string } | null;
    if (channels?.textChannelId) {
      const message = `**Ending**: ${ending.title}\n${ending.description}`;
      await this.discord.postToChannel(channels.textChannelId, message);
    }

    this.gateway.emitToGame(gameId, 'ending:show', { ending });
    await this.broadcastPublicState(gameId);
    return ending;
  }

  async getMetrics() {
    const [activeGames, totalPlayers, minuteRequests, votes] = await Promise.all([
      this.prisma.game.count({ where: { ending: null } }),
      this.prisma.player.count({ where: { status: PlayerStatus.ALIVE } }),
      this.prisma.minuteRequest.count(),
      this.prisma.vote.count()
    ]);

    return {
      activeGames,
      alivePlayers: totalPlayers,
      minuteRequests,
      votes
    };
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

  private generateInviteCode() {
    return randomBytes(4).toString('hex');
  }

  private async createInvite(gameId: string, role: InviteRole) {
    const code = this.generateInviteCode();
    const invite = await this.prisma.invite.create({
      data: {
        gameId,
        role,
        code,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    await this.recordEvent(gameId, 'INVITE_CREATED', { role, code });
    return {
      code,
      expiresAt: invite.expiresAt,
      role
    };
  }

  private async ensureGameExists(gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    return game;
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
