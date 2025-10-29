import { Injectable } from '@nestjs/common';
import { PinoLoggerService } from '../logging/logger.service';
import { ConfigService } from '@nestjs/config';

export interface OfficialConfig {
  apocalypse: string;
  bunker: string;
  voiceChannelId: string;
  textChannelId: string;
}

@Injectable()
export class OfficialConfigService {
  private readonly logger: PinoLoggerService;
  private cached: OfficialConfig[] | null = null;

  constructor(private config: ConfigService, logger: PinoLoggerService) {
    this.logger = logger.forContext(OfficialConfigService.name);
  }

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
      this.logger.error('Failed to parse OFFICIAL_CONFIG_JSON', (error as Error).stack, { module: 'OfficialConfigService' });
      this.logParsingHint(raw, error as Error);
      this.cached = [];
      return this.cached;
    }
  }

  getByIndex(index: number): OfficialConfig | null {
    const configs = this.getAll();
    return configs[index] ?? null;
  }

  private logParsingHint(raw: string, error: Error) {
    const trimmed = raw.trim();
    if (!trimmed) {
      this.logger.warn('OFFICIAL_CONFIG_JSON is empty after trimming whitespace.');
      return;
    }

    const preview = trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
    this.logger.warn(`OFFICIAL_CONFIG_JSON value preview: ${preview}`);

    if (/Expected property name or '\}' in JSON/.test(error.message)) {
      const looksUnquotedKey = /[{,]\s*[A-Za-z0-9_]+\s*:/.test(trimmed);
      if (looksUnquotedKey) {
        this.logger.warn(
          'It looks like some keys are missing double quotes. Example of the correct format: {"guildId": "123"}.'
        );
      }
    }

    if (/Unexpected token '\\'/.test(error.message)) {
      this.logger.warn(
        'Found unexpected backslashes. If you are using a .env file, drop the escaping and keep just the plain JSON.'
      );
    }
  }
}
