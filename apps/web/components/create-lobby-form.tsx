'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CARD_CATEGORY_ORDER, CardCategory } from '@shelterplus/shared';
import { apiClient } from '../lib/api-client';

const defaultCategories = CARD_CATEGORY_ORDER.reduce<Record<CardCategory, boolean>>((acc, category) => {
  acc[category] = true;
  return acc;
}, {} as Record<CardCategory, boolean>);

export function CreateLobbyForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'OFFICIAL' | 'CUSTOM' | 'WEB'>('WEB');
  const [rounds, setRounds] = useState(3);
  const [minuteDurationSec, setMinuteDurationSec] = useState(60);
  const [enabledCategories, setEnabledCategories] = useState(defaultCategories);
  const [guildId, setGuildId] = useState('');
  const [voiceChannelId, setVoiceChannelId] = useState('');
  const [textChannelId, setTextChannelId] = useState('');
  const [officialPresetIndex, setOfficialPresetIndex] = useState(0);
  const [officialConfigs, setOfficialConfigs] = useState<
    Array<{ apocalypse: string; bunker: string; voiceChannelId: string; textChannelId: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (category: CardCategory) => {
    setEnabledCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  useEffect(() => {
    apiClient
      .get('/config/official')
      .then((response) => {
        setOfficialConfigs(response.data as typeof officialConfigs);
      })
      .catch(() => {
        setOfficialConfigs([]);
      });
  }, []);

  useEffect(() => {
    if (officialConfigs.length === 0) {
      setOfficialPresetIndex(0);
    } else if (officialPresetIndex >= officialConfigs.length) {
      setOfficialPresetIndex(0);
    }
  }, [officialConfigs, officialPresetIndex]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/lobbies', {
        mode,
        rounds,
        minuteDurationSec,
        enabledCategories,
        channelsConfig: {
          guildId: guildId || undefined,
          voiceChannelId: voiceChannelId || undefined,
          textChannelId: textChannelId || undefined,
          officialPresetIndex: mode === 'OFFICIAL' ? officialPresetIndex : undefined
        }
      });

      const lobbyId = response.data.id as string;
      router.push(`/lobby/${lobbyId}`);
    } catch (err) {
      setError('Failed to create lobby. Check your configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-slate-900 p-6 shadow-lg">
      <div>
        <label className="block text-sm font-semibold">Mode</label>
        <select
          className="mt-1 w-full rounded bg-slate-800 p-2"
          value={mode}
          onChange={(event) => setMode(event.target.value as typeof mode)}
        >
          <option value="OFFICIAL">Official</option>
          <option value="CUSTOM">Custom</option>
          <option value="WEB">Web-only</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="block text-sm font-semibold">Rounds</span>
          <input
            type="number"
            min={1}
            value={rounds}
            onChange={(event) => setRounds(Number(event.target.value))}
            className="w-full rounded bg-slate-800 p-2"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-semibold">Round duration (seconds)</span>
          <input
            type="number"
            min={10}
            value={minuteDurationSec}
            onChange={(event) => setMinuteDurationSec(Number(event.target.value))}
            className="w-full rounded bg-slate-800 p-2"
          />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Enabled categories
        </legend>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {CARD_CATEGORY_ORDER.map((category) => (
            <label key={category} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={enabledCategories[category]}
                onChange={() => toggleCategory(category)}
                className="h-4 w-4"
              />
              <span>{category}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 md:grid-cols-3">
        {mode === 'OFFICIAL' ? (
          <label className="space-y-1 md:col-span-3">
            <span className="block text-sm font-semibold">Official preset</span>
            <select
              value={officialPresetIndex}
              onChange={(event) => setOfficialPresetIndex(Number(event.target.value))}
              className="w-full rounded bg-slate-800 p-2"
            >
              {officialConfigs.length === 0 ? (
                <option value={0}>Default preset</option>
              ) : (
                officialConfigs.map((preset, index) => (
                  <option key={`${preset.apocalypse}-${index}`} value={index}>
                    #{index + 1}: {preset.apocalypse} / {preset.bunker}
                  </option>
                ))
              )}
            </select>
          </label>
        ) : null}
        <label className="space-y-1">
          <span className="block text-sm font-semibold">Guild ID</span>
          <input
            value={guildId}
            onChange={(event) => setGuildId(event.target.value)}
            className="w-full rounded bg-slate-800 p-2"
            placeholder="Optional"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-semibold">Voice channel ID</span>
          <input
            value={voiceChannelId}
            onChange={(event) => setVoiceChannelId(event.target.value)}
            className="w-full rounded bg-slate-800 p-2"
            placeholder="Optional"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-semibold">Text channel ID</span>
          <input
            value={textChannelId}
            onChange={(event) => setTextChannelId(event.target.value)}
            className="w-full rounded bg-slate-800 p-2"
            placeholder="Optional"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create lobby'}
      </button>
    </form>
  );
}
