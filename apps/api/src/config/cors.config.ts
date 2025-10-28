import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];

const parseOrigins = (rawOrigins?: string | string[]): string[] => {
  if (!rawOrigins) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  if (Array.isArray(rawOrigins)) {
    const origins = rawOrigins.filter(Boolean);
    return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
  }

  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
};

const allowedOrigins = parseOrigins(
  process.env.API_ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_WEB_URL
);

export const corsConfig: CorsOptions = {
  origin: allowedOrigins,
  credentials: true
};

