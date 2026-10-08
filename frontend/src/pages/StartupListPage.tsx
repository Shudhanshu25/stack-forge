import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AgentMode, Startup } from '@stackforge/shared';
import { ApiError } from '../api/client';
import { startupApi } from '../api/endpoints';
import { FormError } from '../components/Field';
import { CardGridSkeleton } from '../components/feedback/Skeletons';
import { EmptyState, ErrorState } from '../components/feedback/States';
import { BUSINESS_MODEL_LABELS, DIFFICULTY_LABELS } from '../lib/enums';
import { formatCount, formatInr } from '../lib/money';
import { openStartupSimulation } from '../lib/openStartup';

export function StartupListPage() {
  const [startups, setStartups] = useState<Startup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [modes, setModes] = useState<Record<string, AgentMode>>({});

  /** Resumes the startup's latest simulation, or starts one; `fresh` always starts a new one. */
  async function play(startup: Startup, fresh = false) {
    setError(null);
    try {
      const agentMode = modes[startup.id] ?? 'rules';
      const simulation = await openStartupSimulation(startup, { fresh, agentMode });
      navigate(`/simulations/${simulation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open the simulation');
    }
  }

  const load = useCallback(() => {
    setLoadError(null);
    startupApi
      .list()
      .then(setStartups)
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : 'Check your connection and retry.'),
      );
  }, []);
  useEffect(load, [load]);

  async function remove(startup: Startup) {
    if (!window.confirm(`Delete ${startup.name}? This cannot be undone.`)) return;
    try {
      await startupApi.remove(startup.id);
      setStartups((list) => list?.filter((s) => s.id !== startup.id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete startup');
    }
  }

  return (
    <section>
      <div className="page-head">
        <h1>Your startups</h1>
        <Link to="/startups/new" className="button primary">
          New startup
        </Link>
      </div>
      <FormError message={error} />
      {loadError && (
        <ErrorState title="Your startups could not be loaded" message={loadError} onRetry={load} />
      )}
      {startups === null && !loadError && <CardGridSkeleton label="Loading your startups" />}
      {startups?.length === 0 && (
        <EmptyState
          title="No startups yet"
          action={
            <Link to="/startups/new" className="button primary">
              Create your first startup
            </Link>
          }
        >
          Your startups appear here as cards with their industry, capital and price, each with a
          button to play its simulation. Creating one takes about a minute.
        </EmptyState>
      )}
      <ul className="startup-grid">
        {startups?.map((s) => (
          <li key={s.id} className="card">
            <h2>{s.name}</h2>
            <p className="muted">
              {s.product.name} · {s.configuration.industry.replaceAll('_', ' ')}
            </p>
            <dl className="facts">
              <dt>Location</dt>
              <dd>
                {s.location
                  ? `${s.location.city}, ${s.location.state}`
                  : 'Not set (national baseline)'}
              </dd>
              <dt>Model</dt>
              <dd>{BUSINESS_MODEL_LABELS[s.configuration.businessModel]}</dd>
              <dt>Capital</dt>
              <dd>{formatInr(s.configuration.initialCapital)}</dd>
              <dt>Price</dt>
              <dd>{formatInr(s.configuration.initialPrice)}</dd>
              <dt>Market</dt>
              <dd>{formatCount(s.configuration.marketSize)} customers</dd>
              <dt>Difficulty</dt>
              <dd>{DIFFICULTY_LABELS[s.configuration.difficulty].label}</dd>
            </dl>
            <div className="actions">
              <select
                aria-label="Agents for a new game"
                value={modes[s.id] ?? 'rules'}
                onChange={(e) => setModes({ ...modes, [s.id]: e.target.value as AgentMode })}
              >
                <option value="rules">Rule agents</option>
                <option value="llm">LLM agents</option>
              </select>
              <button className="primary" onClick={() => void play(s)}>
                Play
              </button>
              <button onClick={() => void play(s, true)}>New game</button>
              <Link to={`/startups/${s.id}/edit`} className="button">
                Edit
              </Link>
              <button className="danger" onClick={() => void remove(s)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
