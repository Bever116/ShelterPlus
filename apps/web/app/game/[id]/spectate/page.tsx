import { notFound } from 'next/navigation';
import type { GamePublicState } from '@shelterplus/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

async function getPublicState(id: string): Promise<GamePublicState> {
  const response = await fetch(`${API_BASE_URL}/games/${id}/public`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load game');
  }
  return response.json();
}

interface SpectatePageProps {
  params: { id: string };
}

export default async function SpectatePage({ params }: SpectatePageProps) {
  const state = await getPublicState(params.id).catch(() => null);

  if (!state) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <header className="rounded-lg bg-slate-900 p-6">
        <h1 className="text-3xl font-bold">Spectator view</h1>
        <p className="mt-2 text-slate-300">
          <span className="font-semibold">Apocalypse:</span> {state.apocalypse}
        </p>
        <p className="text-slate-300">
          <span className="font-semibold">Bunker:</span> {state.bunker}
        </p>
        <p className="text-slate-500">Current round: {state.currentRound}</p>
        {state.ending ? (
          <div className="mt-4 rounded bg-slate-800 p-4">
            <h2 className="text-xl font-semibold">Ending</h2>
            <p className="mt-2 text-slate-300 font-semibold">{state.ending.title as string}</p>
            <p className="text-slate-400">{state.ending.description as string}</p>
          </div>
        ) : null}
      </header>

      <section>
        <h2 className="text-2xl font-semibold">Players</h2>
        <div className="mt-4 space-y-4">
          {state.players.map((player) => (
            <article key={player.id} className="rounded-lg bg-slate-900 p-4">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">#{player.number}</p>
                  <h3 className="text-xl font-semibold">{player.nickname}</h3>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-400">
                  {player.status}
                </span>
              </header>
              {player.openedCards.length ? (
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {player.openedCards.map((card) => (
                    <li key={`${player.id}-${card.category}`} className="rounded bg-slate-800 p-2">
                      <span className="font-semibold text-slate-100">{card.category}</span>
                      <span className="ml-2 text-slate-400">{card.payload.title as string}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No public cards yet.</p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold">Voting snapshot</h2>
        {Object.keys(state.votes).length ? (
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {Object.entries(state.votes).map(([playerId, count]) => {
              const target = state.players.find((player) => player.id === playerId);
              return (
                <li key={playerId} className="rounded bg-slate-900 p-3">
                  <span className="font-semibold text-slate-100">
                    {target ? `${target.number}. ${target.nickname}` : playerId}
                  </span>
                  <span className="ml-2 text-slate-400">{count} votes</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No votes recorded.</p>
        )}
      </section>
    </div>
  );
}
