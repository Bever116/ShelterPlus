import { Logger } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];

const sanitizeOrigins = (origins: (string | undefined | null)[]): string[] => {
  const sanitized = origins
    .filter((origin): origin is string => typeof origin === 'string')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== '*');

  return sanitized.length > 0 ? sanitized : DEFAULT_ALLOWED_ORIGINS;
};

const parseOrigins = (rawOrigins?: string | string[]): string[] => {
  if (!rawOrigins) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  if (Array.isArray(rawOrigins)) {
    return sanitizeOrigins(rawOrigins);
  }

  const origins = rawOrigins.split(',');
  return sanitizeOrigins(origins);
};

const allowedOrigins = parseOrigins(
  process.env.API_ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_WEB_URL
);

const logger = new Logger('CorsConfig');

logger.log(`Allowed origins: ${allowedOrigins.join(', ')}`);

const isAllowedOrigin = (origin?: string | null): boolean => {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(origin);
};

export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      logger.log('CORS request without origin header accepted.');
      callback(null, true);
      return;
    }

    if (isAllowedOrigin(origin)) {
      logger.log(`CORS request from allowed origin: ${origin}`);
      callback(null, origin);
      return;
    }

    logger.warn(`CORS request from disallowed origin: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS`), false);
  },
  credentials: true
};

