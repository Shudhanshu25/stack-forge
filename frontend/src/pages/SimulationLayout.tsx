import { useEffect, useMemo, useRef } from 'react';
import { NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import type { Simulation } from '@stackforge/shared';
import { rememberSimulation } from '../components/shell/nav';
import { useRegisterSimulationChrome } from '../components/shell/SimulationController';
import { useToast } from '../components/feedback/Toaster';
import { useTour } from '../onboarding/Onboarding';
import { jobToast, turnToasts } from '../lib/turnToasts';
import {
  AnalyticsSkeleton,
  DashboardSkeleton,
  PageSkeleton,
  TimelineSkeleton,
} from '../components/feedback/Skeletons';
import { ErrorState } from '../components/feedback/States';
import {
  useSimulationData,
  useTurnRunner,
  type SimulationData,
  type TurnRunner,
} from '../hooks/useSimulation';

export type LoadedSimulation = SimulationData & { simulation: Simulation; runner: TurnRunner };

export const useSimulationContext = () => useOutletContext<LoadedSimulation>();

/** "Bengaluru, Karnataka" for the header; startups from before locations have none. */
export function placeOf(simulation: Simulation): string {
  const p = simulation.configuration.locationProfile;
  if (!p || p.basis === 'NEUTRAL') return 'Location not set';
  return [p.city, p.stateName].filter(Boolean).join(', ');
}

/** A loading placeholder shaped like the view being opened. */
function ViewSkeleton({ path, header }: { path: string; header?: boolean }) {
  if (/\/analytics(\/|$)/.test(path)) return <AnalyticsSkeleton header={header} />;
  if (/\/timeline$/.test(path)) return <TimelineSkeleton header={header} />;
  if (/\/scenarios$/.test(path)) return <PageSkeleton label="Loading scenarios" />;
  return <DashboardSkeleton header={header} />;
}

/** Header (product, startup, turn) and tabs shared by every simulation view. */
export function SimulationLayout() {
  const { id = '' } = useParams();
  const { pathname } = useLocation();
  const data = useSimulationData(id);
  const { simulation, error, loading, reload, turns } = data;
  const tour = useTour();
  const { notify } = useToast();

  // One turn runner per open simulation, shared by the top-bar controller and the decision form.
  // A turn played here is announced once its record has loaded (with the quota flag).
  const expected = useRef<number | null>(null);
  const runner = useTurnRunner(id, simulation?.activeJobId, (job) => {
    if (job.status === 'COMPLETED') {
      expected.current = job.turnNumber;
      tour.advance('play');
    }
    void reload();
    const toast = jobToast(job);
    if (toast) notify(toast);
  });
  const latest = turns.at(-1) ?? null;
  useEffect(() => {
    if (expected.current === null || !latest || latest.turnNumber < expected.current) return;
    expected.current = null;
    turnToasts(latest, turns.at(-2) ?? null).forEach(notify);
  }, [latest, turns, notify]);

  useEffect(() => {
    if (id) rememberSimulation(id);
  }, [id]);
  const chrome = useMemo(() => (simulation ? { simulation, runner } : null), [simulation, runner]);
  useRegisterSimulationChrome(chrome);

  if (!simulation) {
    return loading ? (
      <ViewSkeleton path={pathname} />
    ) : (
      <ErrorState
        title="The simulation could not be loaded"
        message={error}
        onRetry={() => void reload()}
      />
    );
  }
  const bankrupt = simulation.status === 'BANKRUPT';
  return (
    <>
      <header className="sim-header">
        <div>
          <div className="eyebrow">{simulation.productName}</div>
          <h1>{simulation.startupName}</h1>
        </div>
        <div className="header-meta">
          <span className="badge">{placeOf(simulation)}</span>
          <span className="badge">Month {simulation.currentTurn}</span>
          <span className={`badge ${bankrupt ? 'bad' : ''}`}>
            {bankrupt ? '✕ Bankrupt' : simulation.status.toLowerCase()}
          </span>
          <span className="badge">{simulation.configuration.industry.replaceAll('_', ' ')}</span>
          <span className="badge">
            {simulation.agentMode === 'llm' ? 'LLM agents' : 'Rule agents'}
          </span>
          <span className="badge">seed {simulation.seed}</span>
        </div>
      </header>
      <nav className="tabs" aria-label="Simulation views">
        <NavLink to={`/simulations/${id}`} end>
          Overview
        </NavLink>
        <NavLink to={`/simulations/${id}/decisions`}>Decisions</NavLink>
        <NavLink to={`/simulations/${id}/scenarios`}>Strategy</NavLink>
        <NavLink to={`/simulations/${id}/analytics`}>Analytics</NavLink>
        <NavLink to={`/simulations/${id}/advisor`}>AI Advisor</NavLink>
        <NavLink to={`/simulations/${id}/timeline`}>Timeline</NavLink>
      </nav>
      <div key={pathname} className="view-fade">
        <Outlet context={{ ...data, runner } as LoadedSimulation} />
      </div>
    </>
  );
}
