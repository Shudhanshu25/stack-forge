import { useCallback, useEffect, useState } from 'react';
import type { AdminStats } from '@stackforge/shared';
import { ApiError } from '../api/client';
import { adminApi } from '../api/endpoints';
import { CardGridSkeleton } from '../components/feedback/Skeletons';
import { ErrorState } from '../components/feedback/States';
import { formatCount } from '../lib/format';

/** Platform totals for admins. */
export function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    adminApi
      .stats()
      .then(setStats)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Could not load statistics'),
      );
  }, []);
  useEffect(load, [load]);
  if (!stats) {
    return error ? (
      <ErrorState title="Statistics could not be loaded" message={error} onRetry={load} />
    ) : (
      <CardGridSkeleton label="Loading statistics" cards={6} />
    );
  }
  const tiles: [string, string, string?][] = [
    ['Users', formatCount(stats.users)],
    ['Startups', formatCount(stats.startups)],
    ['Simulations run', formatCount(stats.simulations)],
    ['Turns played', formatCount(stats.turnsPlayed)],
    [
      'Average turn duration',
      stats.averageTurnDurationMs === null
        ? '—'
        : `${(stats.averageTurnDurationMs / 1000).toFixed(2)} s`,
      'queued job start to finish',
    ],
    ['AI requests', formatCount(stats.aiRequests), 'agent calls, AI CEO analyses and questions'],
    ['ML predictions', formatCount(stats.mlPredictions), 'turns with a forecast'],
    ['Failed jobs', formatCount(stats.failedJobs)],
    ['Engine version', stats.engineVersion ?? 'unavailable'],
    ['Model version', stats.modelVersion ?? 'no trained model'],
  ];
  return (
    <section>
      <div className="page-head">
        <h1>Admin</h1>
        <span className="xs muted">
          as of {new Date(stats.generatedAt).toLocaleString('en-IN')}
        </span>
      </div>
      <div className="kpis">
        {tiles.map(([label, value, note]) => (
          <div className="kpi" key={label}>
            <div className="kpi-label">{label}</div>
            <div className={`kpi-value ${label.endsWith('version') ? 'compact' : ''}`}>{value}</div>
            {note && <div className="xs muted">{note}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
