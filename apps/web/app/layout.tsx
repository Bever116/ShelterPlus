import './globals.css';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { Inter } from 'next/font/google';
import { getRequestIdFromHeaders } from '@shelterplus/shared/logging';
import { v4 as uuidv4 } from 'uuid';
import { runWithRequestContext } from '../src/lib/request-context';
import { RequestIdProvider } from '../components/request-context';
import { AuthSessionProvider } from '../components/session-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'ShelterPlus',
  description: 'Coordinate the bunker apocalypse party'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const headerList = headers();
  const requestId = getRequestIdFromHeaders(headerList) ?? uuidv4();

  return runWithRequestContext({ requestId }, () => (
    <html lang="en">
      <body className={inter.className} data-request-id={requestId || undefined}>
        <AuthSessionProvider>
          <RequestIdProvider requestId={requestId || undefined}>
            <main className="min-h-screen">
              {children}
            </main>
          </RequestIdProvider>
        </AuthSessionProvider>
      </body>
    </html>
  ));
}
