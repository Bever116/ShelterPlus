import { Injectable, Logger } from '@nestjs/common';
import { Client, GatewayIntentBits, TextChannel } from 'discord.js';

interface VoiceParticipant {
  id: string;
  nickname: string;
}

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private readonly client?: Client;
  private ready = false;

  constructor() {
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
        this.logger.log('Discord client ready');
        this.ready = true;
      });

      this.client.login(token).catch((error) => {
        this.logger.error('Failed to login Discord client', error as Error);
      });
    } else {
      this.logger.warn('DISCORD_BOT_TOKEN missing, running in offline mode');
    }
  }

  async fetchVoiceParticipants(voiceChannelId: string): Promise<VoiceParticipant[]> {
    if (!this.client || !this.ready) {
      this.logger.debug('Discord client not ready; returning empty participants');
      return [];
    }

    const channel = await this.client.channels.fetch(voiceChannelId);
    if (!channel || !channel.isVoiceBased()) {
      this.logger.warn(`Channel ${voiceChannelId} is not voice-based or not found`);
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
      this.logger.log(`Offline DM to ${discordUserId}: ${content}`);
      return;
    }

    const user = await this.client.users.fetch(discordUserId);
    await user.send({ content });
  }

  async postToChannel(channelId: string, content: string) {
    if (!this.client || !this.ready) {
      this.logger.log(`Offline channel post to ${channelId}: ${content}`);
      return;
    }

    const channel = await this.client.channels.fetch(channelId);
    if (!channel) {
      this.logger.warn(`Channel ${channelId} not found`);
      return;
    }

    if (channel instanceof TextChannel) {
      await channel.send({ content });
    } else {
      this.logger.warn(`Channel ${channelId} is not a text channel`);
    }
  }
}
