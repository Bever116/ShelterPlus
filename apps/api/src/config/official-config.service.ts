import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OfficialConfig {
  apocalypse: string;
  bunker: string;
  voiceChannelId: string;
  textChannelId: string;
}

@Injectable()
export class OfficialConfigService {
  private readonly logger = new Logger(OfficialConfigService.name);
  private cached: OfficialConfig[] | null = null;

  constructor(private config: ConfigService) {}

  getAll(): OfficialConfig[] {
    if (this.cached) {
      return this.cached;
    }

    const raw = this.config.get<string>('officialConfigJson') ?? '[]';
    try {
      const parsed = JSON.parse(raw) as OfficialConfig[];
      this.cached = parsed.filter((entry) =>
        typeof entry.apocalypse === 'string' &&
        typeof entry.bunker === 'string' &&
        typeof entry.voiceChannelId === 'string' &&
        typeof entry.textChannelId === 'string'
      );
      return this.cached;
    } catch (error) {
      this.logger.error('Failed to parse OFFICIAL_CONFIG_JSON', error as Error);
      this.cached = [];
      return this.cached;
    }
  }

  getByIndex(index: number): OfficialConfig | null {
    const configs = this.getAll();
    return configs[index] ?? null;
  }
}
