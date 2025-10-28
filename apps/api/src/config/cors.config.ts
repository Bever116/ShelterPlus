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

export const corsConfig: CorsOptions = {
  origin: allowedOrigins,
  credentials: true
};

