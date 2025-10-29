import pino from 'pino';
import { createSharedLogger } from '@shelterplus/shared/logging';
import { getRequestContext } from './request-context';

export const createApiLogger = () =>
  createSharedLogger({
    service: 'api',
    overrides: {
      timestamp: pino.stdTimeFunctions.isoTime,
      mixin() {
        const context = getRequestContext();
        if (!context) {
          return {};
        }
        const { requestId, userId, sessionId, ...rest } = context;
        return {
          ...(requestId ? { requestId } : {}),
          ...(userId ? { userId } : {}),
          ...(sessionId ? { sessionId } : {}),
          ...rest
        };
      }
    }
  });

export const apiLogger = createApiLogger();
