import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { REQUEST_ID_HEADER, getRequestIdFromHeaders } from '@shelterplus/shared/logging';

export function middleware(request: NextRequest) {
  const existing = getRequestIdFromHeaders(request.headers);
  const requestId = existing ?? uuidv4();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: '/:path*'
};
