import { Injectable } from '@nestjs/common';
import { PinoLoggerService } from '../logging/logger.service';
import { Client, GatewayIntentBits, TextChannel } from 'discord.js';

interface VoiceParticipant {
  id: string;
  nickname: string;
}

@Injectable()
export class DiscordService {
  private readonly logger: PinoLoggerService;
  private readonly client?: Client;
  private ready = false;

  constructor(logger: PinoLoggerService) {
    this.logger = logger.forContext(DiscordService.name);
    const token = process.env.DISCORD_BOT_TOKEN;
    if (token) {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.DirectMessages
        ]
      });

      this.client.on('ready', () => {
        this.logger.log('Discord client ready', { action: 'discord.login', ready: true });
        this.ready = true;
      });

      this.client.login(token).catch((error) => {
        this.logger.error('Failed to login Discord client', (error as Error).stack, { action: 'discord.login', err: error });
      });
    } else {
      this.logger.warn('DISCORD_BOT_TOKEN missing, running in offline mode', { action: 'discord.offlineMode' });
    }
  }

  async fetchVoiceParticipants(voiceChannelId: string): Promise<VoiceParticipant[]> {
    if (!this.client || !this.ready) {
      this.logger.debug('Discord client not ready; returning empty participants', { action: 'discord.voiceParticipants.empty' });
      return [];
    }

    const channel = await this.client.channels.fetch(voiceChannelId);
    if (!channel || !channel.isVoiceBased()) {
      this.logger.warn(`Channel ${voiceChannelId} is not voice-based or not found`, { action: 'discord.voiceParticipants.missing', voiceChannelId });
      return [];
    }

    const members = channel.isVoiceBased() ? channel.members : undefined;
    if (!members) {
      return [];
    }

    return Array.from(members.values()).map((member) => ({
      id: member.id,
      nickname: member.displayName
    }));
  }

  async sendDirectMessage(discordUserId: string, content: string) {
    if (!this.client || !this.ready) {
      this.logger.log('Offline DM send', { action: 'discord.dm.offline', targetId: discordUserId, length: content.length });
      return;
    }

    const user = await this.client.users.fetch(discordUserId);
    await user.send({ content });
  }

  async postToChannel(channelId: string, content: string) {
    if (!this.client || !this.ready) {
      this.logger.log('Offline channel post', { action: 'discord.post.offline', channelId, length: content.length });
      return;
    }

    const channel = await this.client.channels.fetch(channelId);
    if (!channel) {
      this.logger.warn(`Channel ${channelId} not found`, { action: 'discord.post.missingChannel', channelId });
      return;
    }

    if (channel instanceof TextChannel) {
      await channel.send({ content });
    } else {
      this.logger.warn(`Channel ${channelId} is not a text channel`, { action: 'discord.post.invalidChannel', channelId });
    }
  }
}
