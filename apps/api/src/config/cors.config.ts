import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];

const parseOrigins = (rawOrigins?: string | string[]): string[] => {
  if (!rawOrigins) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  const origins = Array.isArray(rawOrigins) ? rawOrigins : rawOrigins.split(',');

  const sanitized = origins
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin) && origin !== '*');

  if (sanitized.length === 0) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  return Array.from(new Set(sanitized));
};

const allowedOrigins = parseOrigins(
  process.env.API_ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_WEB_URL
);

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

