import type { Request } from 'express';

type HeaderValue = string | string[] | undefined;

const firstHeaderValue = (value: HeaderValue): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim().length > 0)?.trim();
  }

  const first = value.split(',').find((entry) => entry.trim().length > 0);
  return first?.trim();
};

const resolveProtocol = (req: Request): string => {
  const forwarded = firstHeaderValue(req.headers['x-forwarded-proto']);
  if (forwarded) {
    return forwarded;
  }

  if (req.secure) {
    return 'https';
  }

  if (req.protocol) {
    return req.protocol;
  }

  return 'http';
};

const resolveHost = (req: Request): string => {
  const forwarded = firstHeaderValue(req.headers['x-forwarded-host']);
  if (forwarded) {
    return forwarded;
  }

  const hostHeader = firstHeaderValue(req.headers.host);
  if (hostHeader) {
    return hostHeader;
  }

  if (typeof req.get === 'function') {
    const headerHost = req.get('host');
    if (headerHost) {
      return headerHost;
    }
  }

  return req.hostname;
};

export const resolveRequestOrigin = (req: Request): string => {
  const protocol = resolveProtocol(req);
  const host = resolveHost(req);
  return `${protocol}://${host}`;
};

export const buildAbsoluteUrl = (req: Request, pathname: string): string => {
  const origin = resolveRequestOrigin(req).replace(/\/+$/, '');
  return new URL(pathname, `${origin}/`).toString();
};
