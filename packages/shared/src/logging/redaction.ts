export const DEFAULT_REDACTION_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'token',
  'accessToken',
  'refreshToken'
];

const normalizeKey = (key: string) => key.trim().toLowerCase();

export const buildRedactionPaths = (additionalKeys: string[]): string[] => {
  const keys = new Set<string>();
  for (const key of DEFAULT_REDACTION_KEYS) {
    if (key) {
      keys.add(normalizeKey(key));
    }
  }
  for (const key of additionalKeys) {
    if (key) {
      keys.add(normalizeKey(key));
    }
  }

  const paths: string[] = [];
  for (const key of keys) {
    paths.push(key);
    paths.push(`req.headers.${key}`);
    paths.push(`res.headers.${key}`);
    paths.push(`*.${key}`);
    paths.push(`headers.${key}`);
    paths.push(`body.${key}`);
    paths.push(`data.${key}`);
  }

  return Array.from(new Set(paths));
};

const redactValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(() => '[Redacted]');
  }
  if (value && typeof value === 'object') {
    return '[Redacted Object]';
  }
  if (typeof value === 'string') {
    return '[Redacted]';
  }
  return '[Redacted]';
};

export const redactObject = <T>(input: T, keysToRedact: string[]): T => {
  if (!input || typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => {
      if (item && typeof item === 'object') {
        return redactObject(item as Record<string, unknown>, keysToRedact);
      }
      return item;
    }) as unknown as T;
  }

  const normalizedKeys = new Set(keysToRedact.map((key) => normalizeKey(key)));
  const clone: Record<string, unknown> = { ...(input as Record<string, unknown>) };

  for (const [key, value] of Object.entries(clone)) {
    const normalizedKey = normalizeKey(key);
    if (normalizedKeys.has(normalizedKey)) {
      clone[key] = redactValue(value);
      continue;
    }

    if (value && typeof value === 'object') {
      clone[key] = redactObject(value as Record<string, unknown>, keysToRedact);
    }
  }

  return clone as T;
};
