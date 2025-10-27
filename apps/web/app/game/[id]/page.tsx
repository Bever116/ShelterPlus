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

interface GamePageProps {
  params: { id: string };
}

export default async function GamePage({ params }: GamePageProps) {
  const game = await getGame(params.id).catch(() => null);

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
    </div>
  );
}
