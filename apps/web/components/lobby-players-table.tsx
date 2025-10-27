'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../lib/api-client';
import { v4 as uuid } from 'uuid';

interface LobbyPlayerRow {
  id: string;
  number: number;
  nickname: string;
  discordId: string | null;
}

interface LobbyPlayersTableProps {
  lobbyId: string;
  initialPlayers: LobbyPlayerRow[];
}

export function LobbyPlayersTable({ lobbyId, initialPlayers }: LobbyPlayersTableProps) {
  const router = useRouter();
  const [rows, setRows] = useState<LobbyPlayerRow[]>(initialPlayers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialPlayers);
  }, [initialPlayers]);

  const updateRow = (id: string, key: keyof LobbyPlayerRow, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [key]: key === 'number'
                ? Number(value)
                : key === 'discordId'
                  ? value.trim() === ''
                    ? null
                    : value
                  : value
            }
          : row
      )
    );
  };

  const addRow = () => {
    setRows((prev) => {
      const nextNumber = prev.length ? Math.max(...prev.map((row) => row.number)) + 1 : 1;
      return [
        ...prev,
        { id: uuid(), number: nextNumber, nickname: 'New Player', discordId: null }
      ];
    });
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch(`/lobbies/${lobbyId}/collect`, {
        players: rows.map((row) => ({
          ...row,
          discordId: row.discordId ?? undefined
        }))
      });
      router.refresh();
    } catch (err) {
      setError('Failed to save players');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Players</h2>
        <div className="flex gap-2">
          <button
            onClick={addRow}
            className="rounded bg-slate-700 px-3 py-1 text-sm text-white hover:bg-slate-600"
          >
            Add player
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-4 py-2 text-left">Number</th>
              <th className="px-4 py-2 text-left">Nickname</th>
              <th className="px-4 py-2 text-left">Discord ID</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="bg-slate-950/60">
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={row.number}
                    onChange={(event) => updateRow(row.id, 'number', event.target.value)}
                    className="w-20 rounded bg-slate-800 p-1"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={row.nickname}
                    onChange={(event) => updateRow(row.id, 'nickname', event.target.value)}
                    className="w-full rounded bg-slate-800 p-1"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={row.discordId ?? ''}
                    onChange={(event) => updateRow(row.id, 'discordId', event.target.value)}
                    className="w-full rounded bg-slate-800 p-1"
                    placeholder="Optional"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => removeRow(row.id)}
                    className="rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
