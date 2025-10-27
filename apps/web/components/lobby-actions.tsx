'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../lib/api-client';

interface LobbyActionsProps {
  lobbyId: string;
  hasGame: boolean;
}

export function LobbyActions({ lobbyId, hasGame }: LobbyActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerCollect = async () => {
    setError(null);
    setLoading(true);
    try {
      await apiClient.post(`/lobbies/${lobbyId}/collect`);
      router.refresh();
    } catch (err) {
      setError('Failed to collect players from Discord');
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await apiClient.post(`/games/${lobbyId}/start`);
      const gameId = response.data.id as string;
      router.push(`/game/${gameId}`);
    } catch (err) {
      setError('Unable to start the game. Ensure there are players.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={triggerCollect}
        disabled={loading}
        className="rounded bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-600 disabled:opacity-50"
      >
        Players gathered
      </button>
      <button
        onClick={startGame}
        disabled={loading || hasGame}
        className="rounded bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        Start game
      </button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
