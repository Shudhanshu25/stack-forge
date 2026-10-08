import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Decision,
  PipelineStage,
  Simulation,
  SimulationAnalytics,
  SimulationJob,
  SimulationTurn,
  WsServerMessage,
} from '@stackforge/shared';
import { ApiError } from '../api/client';
import { simulationApi } from '../api/endpoints';
import { describeJobError, isActive, recordEvent, withTrace, type JobTrace } from '../lib/play';
import { SimulationSocket, type SocketStatus } from '../lib/socket';

export interface SimulationData {
  simulation: Simulation | null;
  turns: SimulationTurn[];
  analytics: SimulationAnalytics | null;
  /** The simulation itself could not be loaded: nothing can be shown. */
  error: string | null;
  /** The turn history or the analytics failed: only the panels that need them show an error. */
  turnsError: string | null;
  analyticsError: string | null;
  /** True until the first load has settled. */
  loading: boolean;
  reload: () => Promise<void>;
}

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

/**
 * The simulation, its turn history and its analytics, requested together but settled
 * separately: a failed request leaves the others (and earlier data) on screen.
 */
export function useSimulationData(id: string): SimulationData {
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [turns, setTurns] = useState<SimulationTurn[]>([]);
  const [analytics, setAnalytics] = useState<SimulationAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnsError, setTurnsError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [sim, history, stats] = await Promise.allSettled([
      simulationApi.get(id),
      simulationApi.turns(id),
      simulationApi.analytics(id),
    ]);
    if (sim.status === 'fulfilled') {
      setSimulation(sim.value);
      setError(null);
    } else setError(errorText(sim.reason, 'Could not load the simulation'));
    if (history.status === 'fulfilled') {
      setTurns(history.value);
      setTurnsError(null);
    } else setTurnsError(errorText(history.reason, 'Could not load the turn history'));
    if (stats.status === 'fulfilled') {
      setAnalytics(stats.value);
      setAnalyticsError(null);
    } else setAnalyticsError(errorText(stats.reason, 'Could not load the analytics'));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { simulation, turns, analytics, error, turnsError, analyticsError, loading, reload };
}

export interface TurnRunner {
  job: SimulationJob | null;
  stages: PipelineStage[];
  socketStatus: SocketStatus;
  error: string | null;
  running: boolean;
  play: (decisions: Decision[]) => Promise<void>;
  cancel: () => Promise<void>;
}

const POLL_MS = 1500;

/**
 * Plays turns and follows their progress live over the WebSocket, falling back to polling
 * while the socket is down. Events are recorded per job, so a fast turn that finishes before
 * the POST response arrives is still shown correctly.
 */
export function useTurnRunner(
  simulationId: string,
  activeJobId: string | null | undefined,
  onFinished: (job: SimulationJob) => void,
): TurnRunner {
  const [job, setJob] = useState<SimulationJob | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const jobRef = useRef<SimulationJob | null>(null);
  const traces = useRef(new Map<string, JobTrace>());
  const finished = useRef(onFinished);
  finished.current = onFinished;

  const show = useCallback((incoming: SimulationJob) => {
    const trace = traces.current.get(incoming.jobId);
    const next = withTrace(incoming, trace);
    const previous = jobRef.current;
    jobRef.current = next;
    setJob(next);
    setStages(trace?.stages ?? []);
    const justFinished =
      !isActive(next) && (!previous || previous.jobId !== next.jobId || isActive(previous));
    if (justFinished) {
      setError(next.status === 'FAILED' ? describeJobError(next) : null);
      finished.current(next);
    }
  }, []);

  // Resume a job that was already running when the page opened.
  useEffect(() => {
    if (activeJobId && jobRef.current?.jobId !== activeJobId) {
      simulationApi
        .job(activeJobId)
        .then(show)
        .catch(() => {});
    }
  }, [activeJobId, show]);

  useEffect(() => {
    const onEvent = (event: WsServerMessage) => {
      const jobId = recordEvent(traces.current, event);
      const current = jobRef.current;
      if (jobId && current && jobId === current.jobId) show(current);
    };
    const socket = new SimulationSocket(simulationId, onEvent, setSocketStatus);
    socket.open();
    return () => socket.close();
  }, [simulationId, show]);

  useEffect(() => {
    if (!job || !isActive(job) || socketStatus === 'live') return;
    const timer = setInterval(() => {
      simulationApi
        .job(job.jobId)
        .then(show)
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [job, socketStatus, show]);

  const play = useCallback(
    async (decisions: Decision[]) => {
      setError(null);
      setStages([]);
      try {
        show(await simulationApi.playTurn(simulationId, decisions));
      } catch (err) {
        setError(errorText(err, 'Could not start the turn'));
      }
    },
    [simulationId, show],
  );

  const cancel = useCallback(async () => {
    const current = jobRef.current;
    if (!current) return;
    try {
      show(await simulationApi.cancel(current.jobId));
    } catch (err) {
      setError(errorText(err, 'Could not cancel'));
    }
  }, [show]);

  return { job, stages, socketStatus, error, running: isActive(job), play, cancel };
}
