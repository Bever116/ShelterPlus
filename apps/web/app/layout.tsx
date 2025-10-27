import './globals.css';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { AuthSessionProvider } from '../components/session-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'ShelterPlus',
  description: 'Coordinate the bunker apocalypse party'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthSessionProvider>
          <main className="min-h-screen">
            {children}
          </main>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
