import type { Logger } from 'pino';
import type { createSharedLogger } from '@shelterplus/shared/logging';
import type { RequestContextStore } from '@shelterplus/shared/logging';

type CreateSharedLoggerFn = typeof createSharedLogger;

const isServer = typeof window === 'undefined';

let serverLogger: Logger | null = null;
let requestContextModule: typeof import('./request-context') | null = null;
let cachedCreateSharedLogger: CreateSharedLoggerFn | null = null;
let cachedPino: typeof import('pino') | null = null;

const loadServerDependencies = () => {
  if (!cachedCreateSharedLogger) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedCreateSharedLogger = require('@shelterplus/shared/logging').createSharedLogger as typeof CreateSharedLogger;
  }
  if (!cachedPino) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedPino = require('pino');
  }
  if (!requestContextModule) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    requestContextModule = require('./request-context');
  }
};

const createServerLogger = () => {
  loadServerDependencies();
  return cachedCreateSharedLogger!({
    service: 'web',
    overrides: {
      timestamp: cachedPino!.stdTimeFunctions.isoTime,
      mixin() {
        const context = requestContextModule!.getRequestContext();
        if (!context) {
          return {};
        }
        const { requestId, userId, sessionId, ...rest } = context as RequestContextStore;
        return {
          ...(requestId ? { requestId } : {}),
          ...(userId ? { userId } : {}),
          ...(sessionId ? { sessionId } : {}),
          ...rest
        };
      }
    }
  });
};

const ensureServerLogger = () => {
  if (!serverLogger) {
    serverLogger = createServerLogger();
  }
  return serverLogger;
};

const getClientRequestId = (): string | undefined => {
  if (typeof document === 'undefined') {
    return undefined;
  }
  return document.body?.dataset.requestId ?? undefined;
};

const formatClientArguments = (args: unknown[]): unknown[] => {
  const requestId = getClientRequestId();
  if (!requestId) {
    return args;
  }
  return [`[requestId:${requestId}]`, ...args];
};

const clientLogger = {
  debug: (...args: unknown[]) => console.debug(...formatClientArguments(args)),
  info: (...args: unknown[]) => console.info(...formatClientArguments(args)),
  warn: (...args: unknown[]) => console.warn(...formatClientArguments(args)),
  error: (...args: unknown[]) => console.error(...formatClientArguments(args))
};

export const logger = isServer ? ensureServerLogger() : clientLogger;

export const getRequestId = () => {
  if (isServer) {
    if (!requestContextModule) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      requestContextModule = require('./request-context');
    }
    return requestContextModule.getRequestId();
  }
  return getClientRequestId();
};

export const withServerOperationLog = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
  if (!isServer) {
    return operation();
  }
  const log = ensureServerLogger();
  const start = Date.now();
  log.debug({ action: 'web.operation.start', name });
  try {
    const result = await operation();
    log.debug({ action: 'web.operation.finish', name, durationMs: Date.now() - start });
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
    log.error({ action: 'web.operation.error', name, durationMs: Date.now() - start, err }, 'Server operation failed');
    throw error;
  }
};
