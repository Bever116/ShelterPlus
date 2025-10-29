import { Injectable, INestApplication, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_REDACTION_KEYS, redactObject } from '@shelterplus/shared/logging';
import { PinoLoggerService } from '../logging/logger.service';

const parseBoolean = (value?: string): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalized);
};

const additionalRedactionKeys = (process.env.LOG_REDACT ?? '')
  .split(',')
  .map((key) => key.trim())
  .filter((key) => key.length > 0);

const redactionKeys = Array.from(new Set([...DEFAULT_REDACTION_KEYS, ...additionalRedactionKeys]));

const previewPayload = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  try {
    const redacted = redactObject(payload as Record<string, unknown>, redactionKeys);
    const json = JSON.stringify(redacted);
    return json.length > 800 ? `${json.slice(0, 800)}…` : json;
  } catch {
    return '[Unserializable arguments]';
  }
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger: PinoLoggerService;
  private readonly logQueries: boolean;
  private readonly verboseQueries: boolean;

  constructor(logger: PinoLoggerService) {
    super();
    this.logger = logger.forContext('PrismaService');
    this.logQueries = parseBoolean(process.env.PRISMA_LOG_QUERIES);
    this.verboseQueries = this.logQueries && process.env.NODE_ENV !== 'production';
    if (this.logQueries) {
      this.registerLogging();
    }
  }

  private registerLogging() {
    this.$use(async (params, next) => {
      const start = Date.now();
      try {
        const result = await next(params);
        if (this.logQueries) {
          const duration = Date.now() - start;
          const logFields: Record<string, unknown> = {
            action: 'prisma.query',
            model: params.model,
            operation: params.action,
            durationMs: duration
          };
          if (this.verboseQueries) {
            const argsPreview = previewPayload(params.args);
            if (argsPreview) {
              logFields.args = argsPreview;
            }
            if (Array.isArray(result)) {
              logFields.resultCount = result.length;
            }
          }
          this.logger.debug('Prisma query executed', logFields);
        }
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        this.logger.error('Prisma query failed', error instanceof Error ? error.stack : undefined, {
          action: 'prisma.query.error',
          model: params.model,
          operation: params.action,
          durationMs: duration
        });
        throw error;
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit' as never, async () => {
      await app.close();
    });
  }
}
