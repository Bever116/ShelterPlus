'use client';

import { signIn, signOut } from 'next-auth/react';

export function AuthButtons({ authenticated }: { authenticated: boolean }) {
  return (
    <button
      className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
      onClick={() => (authenticated ? signOut() : signIn('discord'))}
    >
      {authenticated ? 'Sign out' : 'Sign in with Discord'}
    </button>
  );
}
