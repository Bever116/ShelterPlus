import { Logger } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

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

const sanitizeOrigins = (origins: (string | undefined | null)[]): string[] =>
  origins
    .filter((origin): origin is string => typeof origin === 'string')
    .map((origin) => normalizeOrigin(origin))
    .filter((origin) => origin.length > 0 && origin !== '*');

const parseOrigins = (rawOrigins?: string | string[]): string[] => {
  if (!rawOrigins) {
    const defaults = sanitizeOrigins([
      process.env.API_PUBLIC_ORIGIN,
      process.env.NEXT_PUBLIC_WEB_URL,
      process.env.WEB_APP_ORIGIN,
      process.env.FRONTEND_ORIGIN
    ]);

    if (defaults.length === 0) {
      throw new Error('Configure API_ALLOWED_ORIGINS or NEXT_PUBLIC_WEB_URL to enable CORS.');
    }

    return Array.from(new Set(defaults));
  }

  const origins = Array.isArray(rawOrigins) ? rawOrigins : rawOrigins.split(',');
  const sanitized = sanitizeOrigins(origins);

  if (sanitized.length === 0) {
    throw new Error('No valid origins provided in API_ALLOWED_ORIGINS.');
  }

  return Array.from(new Set(sanitized));
};

const allowedOrigins = parseOrigins(
  process.env.API_ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_WEB_URL
);

const corsLogger = new Logger('CorsConfig');
corsLogger.log(`Allowed origins: ${allowedOrigins.join(', ')}`);

export const corsConfig: CorsOptions = {
  origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  optionsSuccessStatus: 204
};
