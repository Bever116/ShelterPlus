import assert from 'node:assert/strict';
import type { Request } from 'express';
import { resolveRequestOrigin, buildAbsoluteUrl } from '../src/common/utils/request-origin';

type RequestOverrides = Partial<Request> & {
  headers?: Record<string, string | string[]>;
  hostHeader?: string;
};

const createRequest = (overrides: RequestOverrides = {}): Request => {
  const headers: Record<string, string | string[]> = overrides.headers ?? {};

  const getHeader = (name: string): string | string[] | undefined => {
    const key = name.toLowerCase();
    const value = headers[key];
    if (Array.isArray(value)) {
      return value;
    }
    return value;
  };

  const request = {
    protocol: overrides.protocol ?? 'http',
    secure: overrides.secure ?? false,
    headers,
    hostname: overrides.hostname ?? 'example.test',
    get: (name: string) => {
      const value = getHeader(name);
      if (value !== undefined) {
        return Array.isArray(value) ? value : value;
      }
      return overrides.hostHeader;
    },
    ...overrides
  } as unknown as Request;

  return request;
};

const defaultOrigin = resolveRequestOrigin(
  createRequest({ headers: { host: 'example.test:4000' } })
);
assert.equal(defaultOrigin, 'http://example.test:4000');

const forwardedOrigin = resolveRequestOrigin(
  createRequest({
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'app.example.com'
    }
  })
);
assert.equal(forwardedOrigin, 'https://app.example.com');

const fallbackOrigin = resolveRequestOrigin(
  createRequest({ protocol: 'https', headers: {}, hostname: 'api.internal' })
);
assert.equal(fallbackOrigin, 'https://api.internal');

const inviteUrl = buildAbsoluteUrl(
  createRequest({
    headers: { host: 'localhost:3333' },
    protocol: 'https'
  }),
  '/invite/demo'
);
assert.equal(inviteUrl, 'https://localhost:3333/invite/demo');

console.log('resolveRequestOrigin tests passed');
