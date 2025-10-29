import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import pinoHttp from 'pino-http';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { REQUEST_ID_HEADER, getRequestIdFromHeaders } from '@shelterplus/shared/logging';
import { AppModule } from './app.module';
import { corsConfig } from './config/cors.config';
import { PinoLoggerService } from './logging/logger.service';
import { GlobalExceptionFilter } from './logging/exception.filter';
import { LoggingInterceptor } from './logging/logging.interceptor';
import { apiLogger } from './logging/pino.factory';
import { getRequestContext, runWithRequestContext, setRequestContextValue } from './logging/request-context';

const bootstrapLogger = new PinoLoggerService(apiLogger).forContext('Bootstrap');

const toBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const parseTrustProxy = (): boolean | number | string => {
  const raw = process.env.API_TRUST_PROXY ?? process.env.TRUST_PROXY;
  if (raw === undefined) {
    return true;
  }

  const normalized = raw.trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  return raw;
};

const resolveHttpsOptions = () => {
  const httpsRequested = toBoolean(process.env.API_ENABLE_HTTPS ?? process.env.USE_HTTPS, false);
  if (!httpsRequested) {
    return { httpsOptions: undefined, httpsEnabled: false } as const;
  }

  const candidates: Array<{ key: string; cert: string }> = [];
  const envKey = process.env.API_HTTPS_KEY_PATH ?? process.env.HTTPS_KEY_PATH;
  const envCert = process.env.API_HTTPS_CERT_PATH ?? process.env.HTTPS_CERT_PATH;

  if (envKey && envCert) {
    candidates.push({ key: resolve(envKey), cert: resolve(envCert) });
  }

  const defaultDirectories = [
    resolve(process.cwd(), 'apps/api/certs'),
    resolve(process.cwd(), 'certs')
  ];

  for (const dir of defaultDirectories) {
    candidates.push({ key: join(dir, 'key.pem'), cert: join(dir, 'cert.pem') });
  }

  for (const { key, cert } of candidates) {
    if (existsSync(key) && existsSync(cert)) {
      bootstrapLogger.log(`Enabling HTTPS with certificates from ${resolve(cert)}`);
      return {
        httpsOptions: {
          key: readFileSync(key),
          cert: readFileSync(cert)
        },
        httpsEnabled: true
      } as const;
    }
  }

  bootstrapLogger.warn('API_ENABLE_HTTPS is true but no certificate pair was found; continuing with HTTP.');
  return { httpsOptions: undefined, httpsEnabled: false } as const;
};

const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const existing = getRequestIdFromHeaders(req.headers);
  const requestId = existing ?? uuidv4();
  (req as Record<string, unknown>).requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  runWithRequestContext({ requestId }, () => {
    next();
  });
};

const attachSessionContext = (req: Request, _res: Response, next: NextFunction) => {
  if (req.sessionID) {
    setRequestContextValue('sessionId', req.sessionID);
  }
  next();
};

async function bootstrap() {
  const { httpsOptions, httpsEnabled } = resolveHttpsOptions();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    ...(httpsOptions ? { httpsOptions } : {})
  });

  const logger = app.get(PinoLoggerService);
  app.useLogger(logger);
  app.useGlobalFilters(app.get(GlobalExceptionFilter));
  app.useGlobalInterceptors(app.get(LoggingInterceptor));

  const httpLogger = pinoHttp({
    logger: apiLogger.child({ context: 'Http' }),
    genReqId(req) {
      return (req as Record<string, unknown>).requestId as string;
    },
    customLogLevel(res, err) {
      if (err) {
        return 'error';
      }
      if (res.statusCode >= 500) {
        return 'error';
      }
      if (res.statusCode >= 400) {
        return 'warn';
      }
      return 'info';
    },
    customProps(req) {
      const context = getRequestContext();
      const props: Record<string, unknown> = {
        requestId: context?.requestId ?? (req as Record<string, unknown>).requestId,
        ip: req.ip,
        method: req.method,
        url: req.originalUrl ?? req.url
      };
      if (context?.userId) {
        props.userId = context.userId;
      }
      if (context?.sessionId) {
        props.sessionId = context.sessionId;
      }
      const userAgent = req.headers['user-agent'];
      if (userAgent) {
        props.userAgent = userAgent;
      }
      return props;
    }
  });

  app.use(requestContextMiddleware);
  app.use(httpLogger);
  app.use(cookieParser());

  const sessionSecret = process.env.SESSION_SECRET ?? 'development-secret';
  const secureCookies = toBoolean(process.env.SESSION_COOKIE_SECURE, httpsEnabled);
  const sameSite = secureCookies ? 'none' : 'lax';

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite,
        secure: secureCookies
      }
    })
  );
  app.use(attachSessionContext);

  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance?.();
  if (instance && typeof instance.set === 'function') {
    instance.set('trust proxy', parseTrustProxy());
  }

  app.enableCors(corsConfig);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true }
    })
  );

  const port = Number.parseInt(process.env.PORT ?? '3333', 10);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  const url = await app.getUrl();
  logger.log('API listening', { url, httpsEnabled });
}

bootstrap().catch((err) => {
  bootstrapLogger.error('Failed to bootstrap Nest application', err instanceof Error ? err.stack : undefined, { err });
  process.exit(1);
});
