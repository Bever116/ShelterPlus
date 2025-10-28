import { notFound } from 'next/navigation';
import { API_BASE_URL } from '../../../../lib/api-config';

interface SpectatorView {
  id: string;
  state: string;
}

async function getSpectatorView(id: string): Promise<SpectatorView> {
  const response = await fetch(`${API_BASE_URL}/games/${id}/spectator`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load spectator view');
  }
  return response.json();
}

interface SpectatePageProps {
  params: { id: string };
}

export default async function SpectatePage({ params }: SpectatePageProps) {
  const view = await getSpectatorView(params.id).catch(() => null);

  if (!view) {
    notFound();
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Spectator view</h1>
      <pre className="mt-4 rounded bg-slate-900 p-4 text-sm text-slate-200">
        {JSON.stringify(view, null, 2)}
      </pre>
    </div>
  );
}
