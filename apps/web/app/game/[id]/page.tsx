import { notFound } from 'next/navigation';
import type { Card, Game, Player } from '@shelterplus/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

interface GameWithPlayers extends Game {
  players: Array<
    Player & {
      cards: Array<Card>;
    }
  >;
}

async function getGame(id: string): Promise<GameWithPlayers> {
  const response = await fetch(`${API_BASE_URL}/games/${id}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load game');
  }
  return response.json();
}

async function getEvents(id: string) {
  const response = await fetch(`${API_BASE_URL}/games/${id}/events?take=10`, { cache: 'no-store' });
  if (!response.ok) {
    return [];
  }
  return response.json();
}

interface GamePageProps {
  params: { id: string };
}

export default async function GamePage({ params }: GamePageProps) {
  const [game, events] = await Promise.all([
    getGame(params.id).catch(() => null),
    getEvents(params.id)
  ]);

  if (!game) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-8">
      <header className="rounded-lg bg-slate-900 p-6">
        <h1 className="text-3xl font-bold">Game overview</h1>
        <p className="mt-2 text-slate-300">
          <span className="font-semibold">Apocalypse:</span> {game.apocalypse}
        </p>
        <p className="text-slate-300">
          <span className="font-semibold">Bunker:</span> {game.bunker}
        </p>
        <p className="text-slate-500">Seats available: {game.seats}</p>
        <p className="text-slate-500">Spectators enabled: {game.isSpectatorsEnabled ? 'Yes' : 'No'}</p>
        {game.ending ? (
          <div className="mt-4 rounded bg-slate-800 p-4">
            <h2 className="text-xl font-semibold">Ending</h2>
            <p className="mt-2 text-slate-200 font-semibold">{(game.ending as any).title}</p>
            <p className="text-slate-400">{(game.ending as any).description}</p>
          </div>
        ) : null}
      </header>

      <section>
        <h2 className="text-2xl font-semibold">Players</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {game.players.map((player) => (
            <article key={player.id} className="space-y-3 rounded-lg bg-slate-900 p-4 shadow">
              <header>
                <p className="text-sm text-slate-400">#{player.number}</p>
                <h3 className="text-xl font-semibold">{player.nickname}</h3>
              </header>
              <ul className="space-y-2 text-sm text-slate-300">
                {player.cards.map((card) => (
                  <li key={card.id} className="rounded bg-slate-800 p-2 text-slate-400">
                    <span className="font-semibold text-slate-200">{card.category}</span>
                    <span className="ml-2 italic text-slate-500">Hidden</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold">Recent events</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-400">
          {Array.isArray(events) && events.length ? (
            events.map((event: any) => (
              <div key={event.id} className="rounded bg-slate-900 p-3">
                <p className="text-slate-200">{event.type}</p>
                <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
              </div>
            ))
          ) : (
            <p>No events logged yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
