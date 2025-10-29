import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { performance } from 'perf_hooks';
import { PinoLoggerService } from './logger.service';
import { setRequestContextValue } from './request-context';
import { DEFAULT_REDACTION_KEYS, redactObject } from '@shelterplus/shared/logging';

const parseBoolean = (value?: string): boolean => {
  if (value === undefined) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalized);
};

const shouldLogBodies = parseBoolean(process.env.LOG_ENABLE_HTTP_BODY);

const additionalRedactions = (process.env.LOG_REDACT ?? '')
  .split(',')
  .map((key) => key.trim())
  .filter((key) => key.length > 0);

const redactionKeys = Array.from(new Set([...DEFAULT_REDACTION_KEYS, ...additionalRedactions]));

const sanitizePayload = (payload: unknown): unknown => {
  if (!shouldLogBodies) {
    return undefined;
  }

  if (payload === undefined) {
    return undefined;
  }

  if (payload === null) {
    return null;
  }

  if (typeof payload === 'string') {
    return payload.length > 1500 ? `${payload.slice(0, 1500)}…` : payload;
  }

  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return payload;
  }

  if (Array.isArray(payload)) {
    const limited = payload.slice(0, 20).map((entry) => sanitizePayload(entry));
    if (payload.length > limited.length) {
      limited.push(`…and ${payload.length - limited.length} more items`);
    }
    return limited;
  }

  if (typeof payload === 'object') {
    try {
      const redacted = redactObject(payload as Record<string, unknown>, redactionKeys);
      const entries = Object.entries(redacted);
      if (entries.length > 20) {
        const trimmed = entries.slice(0, 20);
        const partial: Record<string, unknown> = {};
        for (const [key, value] of trimmed) {
          partial[key] = sanitizePayload(value);
        }
        partial['…truncated'] = `${entries.length - trimmed.length} more keys`;
        return partial;
      }
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of entries) {
        sanitized[key] = sanitizePayload(value);
      }
      return sanitized;
    } catch (error) {
      return '[Unserializable payload]';
    }
  }

  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return '[Unserializable payload]';
  }
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
    const response = context.switchToHttp().getResponse();
    const handlerName = context.getHandler().name;
    const controllerName = context.getClass().name;
    const scopedLogger = this.logger.forContext(`${controllerName}.${handlerName}`);
    const start = performance.now();

    if (request.sessionID) {
      setRequestContextValue('sessionId', request.sessionID);
    }
    if (request.user?.id) {
      setRequestContextValue('userId', request.user.id);
    }

    const requestDetails: Record<string, unknown> = {
      method: request.method,
      url: request.originalUrl ?? request.url,
      bodyKeys: request.body && typeof request.body === 'object' ? Object.keys(request.body) : undefined,
      queryKeys: request.query && typeof request.query === 'object' ? Object.keys(request.query) : undefined
    };

    const bodyPreview = sanitizePayload(request.body);
    if (bodyPreview !== undefined) {
      requestDetails.body = bodyPreview;
    }

    scopedLogger.debug({ action: 'controller.start', ...requestDetails }, 'Controller handler invoked');

    return next.handle().pipe(
      tap((value) => {
        const duration = performance.now() - start;
        const responsePreview = sanitizePayload(value);
        const logFields: Record<string, unknown> = {
          action: 'controller.finish',
          durationMs: Math.round(duration),
          statusCode: response.statusCode,
          ...requestDetails
        };
        if (responsePreview !== undefined) {
          logFields.response = responsePreview;
        }
        scopedLogger.debug(logFields, 'Controller handler completed');
      }),
      catchError((error) => {
        const duration = performance.now() - start;
        const statusCode = typeof (error as { status?: number }).status === 'number' ? (error as { status?: number }).status : response.statusCode;
        scopedLogger.error(
          error instanceof Error ? error : new Error(String(error ?? 'Unknown error')),
          {
            action: 'controller.error',
            durationMs: Math.round(duration),
            statusCode,
            ...requestDetails
          }
        );
        return throwError(() => error);
      })
    );
  }
}
