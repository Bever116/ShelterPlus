import { Logger } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];

const normalizeOrigin = (origin: string): string => {
  const trimmed = origin.trim();

  if (!trimmed) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
};

const sanitizeOrigins = (origins: (string | undefined | null)[]): string[] => {
  const sanitized = origins
    .filter((origin): origin is string => typeof origin === 'string')
    .map((origin) => normalizeOrigin(origin))
    .filter((origin) => origin.length > 0 && origin !== '*');

  if (sanitized.length === 0) {
    return DEFAULT_ALLOWED_ORIGINS.map((origin) => normalizeOrigin(origin));
  }

  return Array.from(new Set(sanitized));
};

const parseOrigins = (rawOrigins?: string | string[]): string[] => {
  if (!rawOrigins) {
    return DEFAULT_ALLOWED_ORIGINS.map((origin) => normalizeOrigin(origin));
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
const allowedOriginSet = new Set(allowedOrigins);

const corsLogger = new Logger('CorsConfig');

corsLogger.log(`Allowed origins: ${allowedOrigins.join(', ')}`);

const isOriginAllowed = (origin?: string | null): boolean => {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  return allowedOriginSet.has(normalizedOrigin);
};

export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      corsLogger.log('CORS request without origin header accepted.');
      callback(null, true);
      return;
    }

    if (isOriginAllowed(origin)) {
      corsLogger.log(`CORS request from allowed origin: ${origin}`);
      callback(null, true);
      return;
    }

    corsLogger.warn(`CORS request from disallowed origin: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS`), false);
  },
  credentials: true
};

