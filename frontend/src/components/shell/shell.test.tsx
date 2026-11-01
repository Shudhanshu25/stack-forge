// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Simulation } from '@stackforge/shared';
import type { TurnRunner } from '../../hooks/useSimulation';
import { greeting } from '../../pages/DashboardPage';
import { simulationFixture } from '../../test/dom';
import { MAIN_NAV, SECONDARY_NAV, hrefFor, isCurrent, pageTitle } from './nav';
import {
  AUTOPLAY_DELAY_MS,
  ShellProvider,
  SimulationControllerView,
  useAutoplay,
  useRegisterSimulationChrome,
  useShell,
} from './SimulationController';

const simulation = simulationFixture as unknown as Simulation;

function runner(overrides: Partial<TurnRunner> = {}): TurnRunner {
  return {
    job: null,
    stages: [],
    socketStatus: 'live',
    error: null,
    running: false,
    play: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    ...overrides,
  };
}

const item = (key: string) => [...MAIN_NAV, ...SECONDARY_NAV].find((i) => i.key === key)!;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('navigation', () => {
  it('points simulation destinations at the open simulation', () => {
    expect(hrefFor(item('overview'), 's1')).toBe('/simulations/s1');
    expect(hrefFor(item('finance'), 's1')).toBe('/simulations/s1/analytics/financial');
    expect(hrefFor(item('advisor'), 's1')).toBe('/simulations/s1/advisor');
    expect(hrefFor(item('team'), 's1')).toBe('/simulations/s1/decisions#hiring');
    expect(hrefFor(item('notifications'), 's1')).toBe('/simulations/s1/timeline');
  });

  it('falls back to the startup list without a simulation', () => {
    expect(hrefFor(item('finance'), null)).toBe('/startups');
    expect(hrefFor(item('settings'), null)).toBe('/account');
  });

  it('marks exactly one main item current', () => {
    const current = (path: string, hash = '') =>
      MAIN_NAV.filter((i) => isCurrent(i, path, hash)).map((i) => i.key);
    expect(current('/simulations/s1')).toEqual(['overview']);
    expect(current('/simulations/s1/analytics')).toEqual(['finance']);
    expect(current('/simulations/s1/analytics/market')).toEqual(['market']);
    expect(current('/simulations/s1/decisions', '#pricing')).toEqual(['product']);
    expect(current('/simulations/s1/decisions', '#hiring')).toEqual(['team']);
    expect(current('/startups/new')).toEqual(['startup']);
  });

  it('names the page for the breadcrumb', () => {
    expect(pageTitle('/simulations/s1/scenarios')).toBe('Business Strategy');
    expect(pageTitle('/simulations/s1/decisions')).toBe('Decisions');
    expect(pageTitle('/account')).toBe('Settings');
    expect(pageTitle('/startups/new')).toBe('New startup');
  });
});

describe('greeting', () => {
  it('uses the time of day and the first name', () => {
    expect(greeting('Asha Founder', new Date(2026, 0, 1, 9))).toBe('Good morning, Asha');
    expect(greeting('Asha', new Date(2026, 0, 1, 14))).toBe('Good afternoon, Asha');
    expect(greeting(undefined, new Date(2026, 0, 1, 20))).toBe('Good evening');
  });
});

describe('shell registration', () => {
  it('a simulation registering new controls on every render does not loop', () => {
    function Registers() {
      const [, setN] = useState(0);
      // A new object each render, as the layout produces when the runner changes.
      useRegisterSimulationChrome({ simulation, runner: runner() });
      return (
        <button type="button" onClick={() => setN((n) => n + 1)}>
          rerender
        </button>
      );
    }
    function Shows() {
      const { chrome } = useShell();
      return <p>{chrome ? chrome.simulation.startupName : 'none'}</p>;
    }
    render(
      <ShellProvider>
        <Shows />
        <Registers />
      </ShellProvider>,
    );
    expect(screen.getByText(simulation.startupName)).toBeTruthy();
    fireEvent.click(screen.getByText('rerender'));
    expect(screen.getByText(simulation.startupName)).toBeTruthy();
  });
});

function Controller({ sim, run }: { sim: Simulation; run: TurnRunner }) {
  const autoplay = useAutoplay(sim, run);
  return <SimulationControllerView simulation={sim} runner={run} autoplay={autoplay} />;
}

describe('simulation controller', () => {
  it('advances one month with the current plan', () => {
    const run = runner();
    render(<Controller sim={simulation} run={run} />);
    expect(screen.getByText(`Month ${simulation.currentTurn}`, { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Advance one month' }));
    expect(run.play).toHaveBeenCalledWith([]);
  });

  it('auto-plays at the chosen speed until paused', () => {
    vi.useFakeTimers();
    const run = runner();
    render(<Controller sim={simulation} run={run} />);
    fireEvent.click(screen.getByRole('button', { name: '5x' }));
    fireEvent.click(screen.getByRole('button', { name: 'Auto-play months' }));
    act(() => vi.advanceTimersByTime(AUTOPLAY_DELAY_MS[5]));
    expect(run.play).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pause auto-play' }));
    act(() => vi.advanceTimersByTime(AUTOPLAY_DELAY_MS[1] * 2));
    expect(run.play).toHaveBeenCalledTimes(1);
  });

  it('cannot play once the startup is bankrupt', () => {
    const run = runner();
    render(<Controller sim={{ ...simulation, status: 'BANKRUPT' }} run={run} />);
    expect(screen.getByText('Bankrupt')).toBeTruthy();
    const step = screen.getByRole('button', { name: 'Advance one month' }) as HTMLButtonElement;
    expect(step.disabled).toBe(true);
  });
});
