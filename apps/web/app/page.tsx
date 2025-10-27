import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { AuthButtons } from '../components/auth-buttons';
import { CreateLobbyForm } from '../components/create-lobby-form';
import { authOptions } from '../lib/auth';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const authenticated = Boolean(session);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ShelterPlus</h1>
          <p className="text-slate-400">Run apocalypse bunker games with Discord coordination.</p>
        </div>
        <AuthButtons authenticated={authenticated} />
      </header>

      {authenticated ? (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Create a lobby</h2>
          <CreateLobbyForm />
        </section>
      ) : (
        <section className="rounded-lg bg-slate-900 p-6 text-center text-slate-300">
          <p>Sign in with Discord to create a lobby and manage your bunker adventures.</p>
        </section>
      )}

      <footer className="text-center text-xs text-slate-500">
        <Link href="https://github.com">GitHub</Link>
      </footer>
    </div>
  );
}
