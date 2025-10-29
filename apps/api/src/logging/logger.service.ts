import { Injectable, LoggerService } from '@nestjs/common';
import type { Logger } from 'pino';
import { apiLogger, createApiLogger } from './pino.factory';

const coerceMessage = (message: unknown): { text: string; payload?: unknown } => {
  if (message instanceof Error) {
    return { text: message.message || message.name, payload: { err: message } };
  }
  if (typeof message === 'string') {
    return { text: message };
  }
  if (typeof message === 'number' || typeof message === 'boolean') {
    return { text: String(message) };
  }
  if (message === undefined) {
    return { text: 'undefined' };
  }
  if (message === null) {
    return { text: 'null' };
  }
  return { text: 'log', payload: { value: message } };
};

const isError = (value: unknown): value is Error => value instanceof Error;

@Injectable()
export class PinoLoggerService implements LoggerService {
  constructor(private readonly logger: Logger = apiLogger) {}

  forContext(context: string): PinoLoggerService {
    return new PinoLoggerService(this.logger.child({ context }));
  }

  private write(level: 'info' | 'error' | 'warn' | 'debug' | 'trace', message: unknown, options: unknown[]) {
    let trace: string | undefined;
    const metadata: Record<string, unknown> = {};
    let logger = this.logger;

    for (const option of options) {
      if (typeof option === 'string' && !trace) {
        if (option.startsWith('    at ') || option.includes('\n    at ')) {
          trace = option;
          continue;
        }
        logger = logger.child({ context: option });
        continue;
      }

      if (isError(option)) {
        metadata.err = option;
        continue;
      }

      if (option && typeof option === 'object') {
        Object.assign(metadata, option as Record<string, unknown>);
      }
    }

    if (trace && !metadata.stack) {
      metadata.stack = trace;
    }

    const { text, payload } = coerceMessage(message);
    if (payload?.err && !metadata.err) {
      metadata.err = payload.err;
      delete (payload as Record<string, unknown>).err;
    }

    const fields = { ...metadata };
    if (payload && Object.keys(payload).length > 0) {
      Object.assign(fields, payload);
    }

    const hasFields = Object.keys(fields).length > 0;

    if (isError(message) || isError(metadata.err)) {
      const err = isError(message) ? message : (metadata.err as Error);
      if (hasFields) {
        logger[level]({ ...fields, err }, text);
      } else {
        logger[level]({ err }, text);
      }
      return;
    }

    if (hasFields) {
      logger[level](fields, text);
      return;
    }

    logger[level](text);
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.write('trace', message, optionalParams);
  }

  setLogLevels?(levels: ('log' | 'error' | 'warn' | 'debug' | 'verbose')[]) {
    const levelPriority: Record<string, number> = {
      error: 50,
      warn: 40,
      log: 30,
      debug: 20,
      verbose: 10
    };
    const minLevel = levels.reduce((min, level) => Math.min(min, levelPriority[level] ?? min), 30);
    if (minLevel <= 10) {
      this.logger.level = 'trace';
    } else if (minLevel <= 20) {
      this.logger.level = 'debug';
    } else if (minLevel <= 30) {
      this.logger.level = 'info';
    } else if (minLevel <= 40) {
      this.logger.level = 'warn';
    } else {
      this.logger.level = 'error';
    }
  }

  child(bindings: Record<string, unknown>): Logger {
    return this.logger.child(bindings);
  }
}

export const createLoggerService = () => new PinoLoggerService(createApiLogger());
