import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Lobby } from '@shelterplus/shared';
import { LobbyPlayersTable } from '../../../components/lobby-players-table';
import { LobbyActions } from '../../../components/lobby-actions';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

interface LobbyPlayer {
  id: string;
  number: number;
  nickname: string;
  discordId: string | null;
}

interface LobbyWithPlayers extends Lobby {
  players: LobbyPlayer[];
  game: { id: string } | null;
}

async function getLobby(id: string): Promise<LobbyWithPlayers> {
  const response = await fetch(`${API_BASE_URL}/lobbies/${id}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load lobby');
  }
  return response.json();
}

interface LobbyPageProps {
  params: { id: string };
}

export default async function LobbyPage({ params }: LobbyPageProps) {
  const lobby = await getLobby(params.id).catch(() => null);

  if (!lobby) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Lobby</h1>
        <p className="text-slate-400">Configure players before starting the game.</p>
        <div className="text-sm text-slate-500">
          <p>Mode: {lobby.mode}</p>
          <p>
            Rounds: {lobby.rounds} · Minutes per round: {lobby.minuteDurationSec}
          </p>
        </div>
      </header>

      <LobbyActions lobbyId={lobby.id} hasGame={Boolean(lobby.game)} />
      <LobbyPlayersTable
        lobbyId={lobby.id}
        initialPlayers={(lobby.players ?? []).map((player) => ({
          id: player.id,
          number: player.number,
          nickname: player.nickname,
          discordId: player.discordId
        }))}
      />

      {lobby.game ? (
        <Link href={`/game/${lobby.game.id}`} className="text-emerald-400">
          Go to game
        </Link>
      ) : null}
    </div>
  );
}
