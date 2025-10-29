import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { REQUEST_ID_HEADER, getRequestIdFromHeaders } from '@shelterplus/shared/logging';
import { runWithRequestContext } from '../../../../src/lib/request-context';
import { logger } from '../../../../src/lib/logger';
import { authOptions } from '../../../../lib/auth';

const nextAuthHandler = NextAuth(authOptions);

const createHandler = (method: 'GET' | 'POST') =>
  async (request: NextRequest, context: { params: { nextauth: string[] } }) => {
    const existing = getRequestIdFromHeaders(request.headers);
    const requestId = existing ?? uuidv4();

    return runWithRequestContext({ requestId, method }, async () => {
      const start = Date.now();
      logger.debug({ action: 'web.route.start', method, path: request.url, requestId }, 'Handling NextAuth route');
      const response = await nextAuthHandler(request, context);
      const duration = Date.now() - start;
      logger.debug({ action: 'web.route.finish', method, path: request.url, durationMs: duration, requestId }, 'Completed NextAuth route');
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    });
  };

export const GET = createHandler('GET');
export const POST = createHandler('POST');
