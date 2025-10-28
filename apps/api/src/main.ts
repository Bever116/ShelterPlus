import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { AppModule } from './app.module';
import { corsConfig } from './config/cors.config';

const logger = new Logger('Bootstrap');

const toBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalized);
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
      logger.log(`Enabling HTTPS with certificates from ${resolve(cert)}`);
      return {
        httpsOptions: {
          key: readFileSync(key),
          cert: readFileSync(cert)
        },
        httpsEnabled: true
      } as const;
    }
  }

  logger.warn('API_ENABLE_HTTPS is true but no certificate pair was found; continuing with HTTP.');
  return { httpsOptions: undefined, httpsEnabled: false } as const;
};

async function bootstrap() {
  const { httpsOptions, httpsEnabled } = resolveHttpsOptions();

  const app = await NestFactory.create(AppModule, httpsOptions ? { httpsOptions } : undefined);

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

  const sessionSecret = process.env.SESSION_SECRET ?? 'development-secret';
  const secureCookies = toBoolean(process.env.SESSION_COOKIE_SECURE, httpsEnabled);
  const sameSite = secureCookies ? 'none' : 'lax';

  app.use(cookieParser());
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

  const port = Number.parseInt(process.env.PORT ?? '3333', 10);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  const url = await app.getUrl();
  Logger.log(`API running on ${url}`);
}

bootstrap().catch((err) => {
  logger.error('Failed to bootstrap Nest application', err);
  process.exit(1);
});
