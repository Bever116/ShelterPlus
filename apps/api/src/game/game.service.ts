import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, CardCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordService } from '../discord/discord.service';
import { APOCALYPSE_POOL, BUNKER_POOL, CATEGORY_POOLS } from './card-pool';
import seedrandom from 'seedrandom';
import { createHash } from 'crypto';
import { CARD_CATEGORY_ORDER } from '@shelterplus/shared';

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
  constructor(private prisma: PrismaService, private discord: DiscordService) {}

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
