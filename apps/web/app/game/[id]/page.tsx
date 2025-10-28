import { notFound } from 'next/navigation';
import { API_BASE_URL } from '../../../lib/api-config';

interface GameState {
  id: string;
  lobbyId: string;
  status: string;
}

async function getGame(id: string): Promise<GameState> {
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
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Game</h1>
      <pre className="mt-4 rounded bg-slate-900 p-4 text-sm text-slate-200">
        {JSON.stringify(game, null, 2)}
      </pre>
    </div>
  );
}
