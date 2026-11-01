import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pause, Play, SkipForward } from 'lucide-react';
import type { Simulation } from '@stackforge/shared';
import type { TurnRunner } from '../../hooks/useSimulation';
import { turnBlockedReason } from '../dashboard/DecisionPanel';

export type Speed = 1 | 2 | 5;

/** Seconds between auto-played months at each speed. */
export const AUTOPLAY_DELAY_MS: Record<Speed, number> = { 1: 8000, 2: 4000, 5: 1500 };

export interface SimulationChrome {
  simulation: Simulation;
  runner: TurnRunner;
}

type SetChrome = (chrome: SimulationChrome | null) => void;

// Two contexts: the setter never changes, so a simulation can register its controls without
// re-rendering itself each time they change (which would register them again, endlessly).
const ChromeContext = createContext<SimulationChrome | null>(null);
const SetChromeContext = createContext<SetChrome>(() => {});

/** Lets the open simulation put its controls into the app shell's top bar. */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<SimulationChrome | null>(null);
  return (
    <SetChromeContext.Provider value={setChrome}>
      <ChromeContext.Provider value={chrome}>{children}</ChromeContext.Provider>
    </SetChromeContext.Provider>
  );
}

/** The open simulation's controls, or null (no simulation, or outside a ShellProvider). */
export function useShell(): { chrome: SimulationChrome | null } {
  return { chrome: useContext(ChromeContext) };
}

/** Registers the simulation's controls with the shell for as long as the caller is mounted. */
export function useRegisterSimulationChrome(chrome: SimulationChrome | null): void {
  const setChrome = useContext(SetChromeContext);
  useEffect(() => {
    setChrome(chrome);
  }, [chrome, setChrome]);
  useEffect(() => () => setChrome(null), [setChrome]);
}

/**
 * Auto-play: plays the next month with the current plan, waits, and repeats until paused or a
 * turn cannot be played. One month is one turn; the engine computes every number.
 */
export function useAutoplay(simulation: Simulation | null, runner: TurnRunner | null) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = simulation && runner ? turnBlockedReason(simulation, runner.running) : 'Loading';
  const failed = runner?.job?.status === 'FAILED';
  const terminal = simulation ? simulation.status !== 'ACTIVE' : false;

  useEffect(() => {
    if (failed || terminal) setPlaying(false);
  }, [failed, terminal]);

  useEffect(() => {
    if (!playing || blocked !== null || !runner) return;
    timer.current = setTimeout(() => void runner.play([]), AUTOPLAY_DELAY_MS[speed]);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // A new turn (currentTurn) re-arms the timer.
  }, [playing, blocked, speed, runner, simulation?.currentTurn]);

  const toggle = useCallback(() => setPlaying((p) => !p), []);
  return { playing, toggle, speed, setSpeed, blocked };
}

const SPEEDS: Speed[] = [1, 2, 5];

/** The persistent simulation control in the top bar: month, status, play/pause, step, speed. */
export function SimulationControllerView({
  simulation,
  runner,
  autoplay,
}: {
  simulation: Simulation;
  runner: TurnRunner;
  autoplay: ReturnType<typeof useAutoplay>;
}) {
  const month = simulation.currentTurn;
  const quarter = Math.max(1, Math.ceil(Math.max(month, 1) / 3));
  const running = runner.running;
  const status =
    simulation.status === 'BANKRUPT'
      ? 'Bankrupt'
      : simulation.status !== 'ACTIVE'
        ? simulation.status.charAt(0) + simulation.status.slice(1).toLowerCase()
        : running
          ? `Simulating month ${month + 1}`
          : autoplay.playing
            ? `Auto-playing · ${autoplay.speed}x`
            : 'Paused';
  const progress = running ? (runner.job?.progress ?? 0) : autoplay.playing ? 100 : 0;
  const live = running || autoplay.playing;
  const canStep = autoplay.blocked === null;
  return (
    <div className="sim-ctl" role="group" aria-label="Simulation controls">
      <div className="sim-ctl-info">
        <span
          className={`sim-live ${live ? 'on' : ''} ${simulation.status === 'BANKRUPT' ? 'bad' : ''}`}
          aria-hidden
        />
        <div className="sim-ctl-text">
          <div className="sim-ctl-title num">
            Month {month} <span className="muted">· Q{quarter} cycle</span>
          </div>
          <div className="sim-ctl-sub">
            <span
              className="sim-ctl-bar"
              role="progressbar"
              aria-label="Turn progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <i style={{ width: `${progress}%` }} />
            </span>
            <span aria-live="polite">{status}</span>
          </div>
        </div>
      </div>
      <span className="sim-ctl-sep" aria-hidden />
      <button
        type="button"
        className="icon-btn sm"
        onClick={autoplay.toggle}
        aria-pressed={autoplay.playing}
        aria-label={autoplay.playing ? 'Pause auto-play' : 'Auto-play months'}
        title={autoplay.playing ? 'Pause auto-play' : 'Auto-play months with the current plan'}
        disabled={!autoplay.playing && !canStep}
      >
        {autoplay.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
      </button>
      <button
        type="button"
        className="icon-btn sm"
        onClick={() => void runner.play([])}
        disabled={!canStep}
        aria-label="Advance one month"
        title={autoplay.blocked ?? 'Play the next month with the current plan'}
      >
        <SkipForward size={16} aria-hidden />
      </button>
      <div className="seg sm" role="group" aria-label="Auto-play speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={autoplay.speed === s ? 'on' : ''}
            aria-pressed={autoplay.speed === s}
            onClick={() => autoplay.setSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}

/** The controller as the shell shows it: only while a simulation is open. */
export function ShellSimulationController() {
  const { chrome } = useShell();
  const autoplay = useAutoplay(chrome?.simulation ?? null, chrome?.runner ?? null);
  if (!chrome) return null;
  return (
    <SimulationControllerView
      simulation={chrome.simulation}
      runner={chrome.runner}
      autoplay={autoplay}
    />
  );
}
