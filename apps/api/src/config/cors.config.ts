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

  const origins = Array.isArray(rawOrigins) ? rawOrigins : rawOrigins.split(',');

  const sanitized = origins
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => {
      if (!origin) {
        return false;
      }

      if (origin === '*') {
        throw new Error('API_ALLOWED_ORIGINS and NEXT_PUBLIC_WEB_URL cannot contain "*".');
      }

      return true;
    });

  if (sanitized.length === 0) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  return Array.from(new Set(sanitized));
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
  origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With'
  ],
  optionsSuccessStatus: 204
};

