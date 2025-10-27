import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordService } from '../discord/discord.service';
import { CreateLobbyDto, normalizeEnabledCategories } from './dto/create-lobby.dto';
import { UpdateLobbyPlayersDto } from './dto/update-players.dto';
import { v4 as uuid } from 'uuid';
import { OfficialConfigService } from '../config/official-config.service';

@Injectable()
export class LobbyService {
  constructor(
    private prisma: PrismaService,
    private discord: DiscordService,
    private officialConfig: OfficialConfigService
  ) {}

  async create(dto: CreateLobbyDto) {
    const normalizedCategories = normalizeEnabledCategories(dto.enabledCategories);
    let channels = dto.channelsConfig ?? {};

    if (dto.mode === 'OFFICIAL') {
      const presetIndex = channels.officialPresetIndex ?? 0;
      const preset = this.officialConfig.getByIndex(presetIndex);
      if (preset) {
        channels = {
          ...channels,
          voiceChannelId: preset.voiceChannelId,
          textChannelId: preset.textChannelId,
          officialPresetIndex: presetIndex
        };
      }
    }

    const lobby = await this.prisma.lobby.create({
      data: {
        mode: dto.mode,
        rounds: dto.rounds,
        minuteDurationSec: dto.minuteDurationSec,
        enabledCategories: normalizedCategories as Prisma.JsonObject,
        channelsConfig: channels as Prisma.JsonObject
      }
    });

    return lobby;
  }

  async get(lobbyId: string) {
    const lobby = await this.prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: { players: { orderBy: { number: 'asc' } }, game: true }
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    return lobby;
  }

  async collectPlayers(lobbyId: string) {
    const lobby = await this.prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    const config = lobby.channelsConfig as { voiceChannelId?: string } | null;
    const voiceChannelId = config?.voiceChannelId;
    const participants = voiceChannelId
      ? await this.discord.fetchVoiceParticipants(voiceChannelId)
      : [];

    let fallbackNumber = 1;
    const players = participants.map((participant) => {
      const match = participant.nickname.match(/^(\d+)\s*(.*)$/);
      const number = match ? Number(match[1]) : fallbackNumber++;
      const nickname = match && match[2] ? match[2].trim() : participant.nickname;
      return {
        id: uuid(),
        lobbyId,
        number,
        nickname,
        discordId: participant.id
      };
    });

    if (!players.length) {
      return this.prisma.lobbyPlayer.findMany({ where: { lobbyId }, orderBy: { number: 'asc' } });
    }

    await this.prisma.lobbyPlayer.deleteMany({ where: { lobbyId } });

    if (players.length) {
      await this.prisma.lobbyPlayer.createMany({
        data: players.map(({ id, lobbyId: lobbyIdValue, ...rest }) => ({
          id,
          lobbyId: lobbyIdValue,
          ...rest
        }))
      });
    }

    return this.prisma.lobbyPlayer.findMany({ where: { lobbyId }, orderBy: { number: 'asc' } });
  }

  async updatePlayers(lobbyId: string, dto: UpdateLobbyPlayersDto) {
    const lobby = await this.prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    await this.prisma.lobbyPlayer.deleteMany({ where: { lobbyId } });
    if (dto.players.length) {
      await this.prisma.lobbyPlayer.createMany({
        data: dto.players.map((player) => ({
          id: player.id,
          lobbyId,
          number: player.number,
          nickname: player.nickname,
          discordId: player.discordId ?? null
        }))
      });
    }

    return this.prisma.lobbyPlayer.findMany({ where: { lobbyId }, orderBy: { number: 'asc' } });
  }
}
