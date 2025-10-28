const rawApiUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_ORIGIN ??
  process.env.API_ORIGIN ??
  process.env.API_BASE_URL ??
  '';

if (!rawApiUrl) {
  throw new Error(
    'Missing NEXT_PUBLIC_API_URL (or NEXT_PUBLIC_API_ORIGIN). Set it to the API origin, for example https://localhost:3333.'
  );
}

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

export const API_BASE_URL = normalizeBaseUrl(rawApiUrl);
