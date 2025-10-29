import type { LoggerOptions } from 'pino';
import pino from 'pino';
import { REQUEST_ID_HEADER } from './request-constants.js';
import { buildRedactionPaths } from './redaction.js';

const resolvePinoFactory = (): typeof import('pino').default => {
  const candidate = (pino as unknown as { default?: typeof import('pino').default }).default;
  if (typeof candidate === 'function') {
    return candidate as typeof import('pino').default;
  }
  return pino as unknown as typeof import('pino').default;
};

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface RequestContextStore {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface CreateLoggerOptions {
  service: string;
  level?: LogLevel;
  pretty?: boolean;
  redactKeys?: string[];
  overrides?: LoggerOptions;
}

export const resolveLogLevel = (level?: string): LogLevel => {
  switch ((level ?? '').toLowerCase()) {
    case 'fatal':
    case 'error':
    case 'warn':
    case 'info':
    case 'debug':
    case 'trace':
      return level as LogLevel;
    default:
      return 'info';
  }
};

export const shouldPrettyPrint = (force?: string | boolean): boolean => {
  if (typeof force === 'boolean') {
    return force;
  }
  if (force !== undefined) {
    const normalized = String(force).toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return process.env.NODE_ENV !== 'production';
};

export const createSharedLogger = ({
  service,
  level,
  pretty,
  redactKeys,
  overrides
}: CreateLoggerOptions) => {
  const resolvedLevel = resolveLogLevel(level ?? process.env.LOG_LEVEL);
  const enablePretty = shouldPrettyPrint(pretty ?? process.env.LOG_PRETTY);
  const redactions = buildRedactionPaths(redactKeys ?? process.env.LOG_REDACT?.split(',') ?? []);

  const transport = enablePretty
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard'
        }
      }
    : undefined;

  const options: LoggerOptions = {
    level: resolvedLevel,
    redact: {
      paths: redactions,
      censor: '[Redacted]'
    },
    base: {
      service
    },
    ...overrides
  };

  const factory = resolvePinoFactory();

  if (transport) {
    return factory({ ...options, transport });
  }

  return factory(options);
};

export const toRequestId = (candidate: string | string[] | null | undefined): string | undefined => {
  if (!candidate) {
    return undefined;
  }
  if (Array.isArray(candidate)) {
    return candidate.find((value) => typeof value === 'string' && value.trim().length > 0);
  }
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

type HeaderRecord = Record<string, string | string[] | undefined>;

export type HeaderSource = HeaderRecord | { get?: (key: string) => string | null | undefined };

export const getRequestIdFromHeaders = (headers: HeaderSource): string | undefined => {
  if (!headers) {
    return undefined;
  }

  if (typeof (headers as { get?: unknown }).get === 'function') {
    const getter = (headers as { get: (key: string) => string | null | undefined }).get.bind(headers) as (key: string) => string | null | undefined;
    const candidate = getter(REQUEST_ID_HEADER);
    return candidate ? candidate.trim() || undefined : undefined;
  }

  const key = REQUEST_ID_HEADER.toLowerCase();
  const direct = (headers as HeaderRecord)[REQUEST_ID_HEADER];
  if (direct) {
    return toRequestId(direct);
  }

  const lower = (headers as HeaderRecord)[key];
  if (lower) {
    return toRequestId(lower);
  }

  for (const [headerKey, value] of Object.entries(headers as HeaderRecord)) {
    if (headerKey.toLowerCase() === key) {
      return toRequestId(value);
    }
  }

  return undefined;
};

export { REQUEST_ID_HEADER } from './request-constants.js';
export { buildRedactionPaths, redactObject, DEFAULT_REDACTION_KEYS } from './redaction.js';
