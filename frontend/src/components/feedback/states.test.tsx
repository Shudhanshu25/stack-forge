// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIAdvice, SimulationAnalytics, SimulationJob } from '@stackforge/shared';
import type { SimulationData, TurnRunner } from '../../hooks/useSimulation';
import { AnalyticsPage } from '../../pages/AnalyticsPage';
import { DashboardPage, jobToast, turnToasts } from '../../pages/DashboardPage';
import { ScenariosPage } from '../../pages/ScenariosPage';
import { SimulationLayout } from '../../pages/SimulationLayout';
import { StartupListPage } from '../../pages/StartupListPage';
import { TimelinePage } from '../../pages/TimelinePage';
import {
  analyticsFixture,
  freshSimulation,
  LIGHT,
  mockMatchMedia,
  simulationFixture,
  turnsFixture,
} from '../../test/dom';
import { ThemeProvider } from '../../theme/ThemeContext';
import { CeoPanel } from '../dashboard/CeoPanel';
import { PanelBoundary } from './States';
import { TOAST_MS, ToastProvider, useToast } from './Toaster';

const api = vi.hoisted(() => ({
  startupList: vi.fn(),
  advise: vi.fn(),
  scenario: vi.fn(),
  llmUsage: vi.fn(),
}));
vi.mock('../../api/endpoints', () => ({
  startupApi: { list: api.startupList },
  simulationApi: { advise: api.advise, scenario: api.scenario, preview: vi.fn() },
  accountApi: { llmUsage: api.llmUsage },
}));

const hooks = vi.hoisted(() => ({ data: null as unknown, runner: null as unknown }));
vi.mock('../../hooks/useSimulation', () => ({
  useSimulationData: () => hooks.data,
  useTurnRunner: () => hooks.runner,
}));
vi.mock('../../onboarding/Onboarding', () => ({
  useTour: () => ({ active: false, stepId: null, advance: () => {}, finish: async () => {} }),
}));

const reload = vi.fn(async () => {});
function simData(overrides: Partial<SimulationData> = {}): SimulationData {
  return {
    simulation: simulationFixture,
    turns: turnsFixture,
    analytics: analyticsFixture,
    error: null,
    turnsError: null,
    analyticsError: null,
    loading: false,
    reload,
    ...overrides,
  };
}
const runner: TurnRunner = {
  job: null,
  stages: [],
  socketStatus: 'live',
  error: null,
  running: false,
  play: vi.fn(async () => {}),
  cancel: vi.fn(async () => {}),
};

function Providers({ children, path }: { children: React.ReactNode; path: string }) {
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    </ThemeProvider>
  );
}

function simulationAt(path: string, data: SimulationData) {
  hooks.data = data;
  return render(
    <Providers path={path}>
      <Routes>
        <Route path="/simulations/:id" element={<SimulationLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="scenarios" element={<ScenariosPage />} />
          <Route path="timeline" element={<TimelinePage />} />
        </Route>
      </Routes>
    </Providers>,
  );
}

const heading = (name: string) => screen.getByRole('heading', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  mockMatchMedia({ [LIGHT]: false });
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  hooks.runner = runner;
  api.llmUsage.mockResolvedValue({ exhausted: false });
  vi.clearAllMocks();
  api.llmUsage.mockResolvedValue({ exhausted: false });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('loading states', () => {
  it('a loading simulation shows a skeleton shaped like the view, not a spinner', () => {
    simulationAt('/simulations/sim1', simData({ simulation: null, loading: true }));
    expect(screen.getByRole('status', { name: 'Loading the dashboard' })).toBeTruthy();
    cleanup();
    simulationAt('/simulations/sim1/analytics', simData({ simulation: null, loading: true }));
    expect(screen.getByRole('status', { name: 'Loading analytics' })).toBeTruthy();
    cleanup();
    simulationAt('/simulations/sim1/timeline', simData({ simulation: null, loading: true }));
    expect(screen.getByRole('status', { name: 'Loading the turn history' })).toBeTruthy();
    expect(document.querySelector('.spinner')).toBeNull();
  });
});

describe('empty states', () => {
  it('no startups yet: says what will appear and offers to create one', async () => {
    api.startupList.mockResolvedValue([]);
    render(
      <Providers path="/startups">
        <StartupListPage />
      </Providers>,
    );
    await waitFor(() => heading('No startups yet'));
    expect(screen.getByRole('link', { name: 'Create your first startup' })).toBeTruthy();
  });

  it('a simulation with no turns offers to play the first one', () => {
    simulationAt(
      '/simulations/sim1',
      simData({ simulation: freshSimulation, turns: [], analytics: null }),
    );
    expect(heading('No turns played yet')).toBeTruthy();
    fireEvent.click(button('Play turn 1 with the starting plan'));
    expect(runner.play).toHaveBeenCalledWith([]);
  });

  it('analytics with too little history points to the first turn', () => {
    const short = { ...analyticsFixture, series: analyticsFixture.series.slice(0, 1) };
    simulationAt(
      '/simulations/sim1/analytics',
      simData({ analytics: short as SimulationAnalytics }),
    );
    expect(heading('Not enough history yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Play your first turn' })).toBeTruthy();
  });

  it('advisor unavailable: shows the reason and offers to ask again', async () => {
    const latest = {
      ...turnsFixture.at(-1)!,
      advice: { available: false, unavailableReason: 'Daily AI quota reached' } as AIAdvice,
    };
    api.advise.mockResolvedValue({ available: false, unavailableReason: 'still no key' });
    render(
      <Providers path="/">
        <CeoPanel simulationId="sim1" latest={latest} />
      </Providers>,
    );
    expect(heading('AI CEO unavailable')).toBeTruthy();
    expect(screen.getByText(/Daily AI quota reached/)).toBeTruthy();
    await act(async () => fireEvent.click(button('Ask again')));
    expect(api.advise).toHaveBeenCalledWith('sim1', { mode: 'ANALYZE' });
  });

  it('a turn without an analysis is shown as the advisor being unavailable', () => {
    const latest = { ...turnsFixture.at(-1)!, advice: undefined };
    render(
      <Providers path="/">
        <CeoPanel simulationId="sim1" latest={latest} />
      </Providers>,
    );
    expect(heading('AI CEO unavailable')).toBeTruthy();
  });

  it('no scenario run: explains the comparison and runs it', async () => {
    api.scenario.mockReturnValue(new Promise(() => {}));
    simulationAt('/simulations/sim1/scenarios', simData());
    expect(heading('No scenario run yet')).toBeTruthy();
    await act(async () => fireEvent.click(button('Compare the two branches')));
    expect(api.scenario).toHaveBeenCalledTimes(1);
  });

  it('timeline with no turns links to the dashboard', () => {
    simulationAt('/simulations/sim1/timeline', simData({ turns: [] }));
    expect(heading('No turns yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Play your first turn' })).toBeTruthy();
  });
});

describe('error states', () => {
  it('the simulation failing to load offers a retry', () => {
    simulationAt('/simulations/sim1', simData({ simulation: null, error: 'Server error' }));
    expect(heading('✕ The simulation could not be loaded')).toBeTruthy();
    fireEvent.click(button('Retry'));
    expect(reload).toHaveBeenCalled();
  });

  it('failed analytics leave the rest of the dashboard working', () => {
    simulationAt(
      '/simulations/sim1',
      simData({ analytics: null, analyticsError: 'Analytics timed out' }),
    );
    expect(heading('✕ Key metrics and charts could not be loaded')).toBeTruthy();
    expect(heading('✕ The market could not be loaded')).toBeTruthy();
    // The decisions and the AI CEO are still there.
    expect(heading(`Decisions for turn ${simulationFixture.currentTurn + 1}`)).toBeTruthy();
    expect(heading('AI CEO')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]!);
    expect(reload).toHaveBeenCalled();
  });

  it('a failed turn history shows errors in the AI CEO panel and on the timeline', () => {
    simulationAt('/simulations/sim1', simData({ turns: [], turnsError: 'History unavailable' }));
    expect(heading('✕ The latest analysis could not be loaded')).toBeTruthy();
    cleanup();
    simulationAt('/simulations/sim1/timeline', simData({ turns: [], turnsError: 'Nope' }));
    fireEvent.click(button('Retry'));
    expect(reload).toHaveBeenCalled();
  });

  it('analytics failing on their own page offer a retry', () => {
    simulationAt('/simulations/sim1/analytics', simData({ analytics: null, analyticsError: 'x' }));
    fireEvent.click(button('Retry'));
    expect(reload).toHaveBeenCalled();
  });

  it('the startup list failing offers a retry that loads it', async () => {
    api.startupList.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    render(
      <Providers path="/startups">
        <StartupListPage />
      </Providers>,
    );
    await waitFor(() => heading('✕ Your startups could not be loaded'));
    fireEvent.click(button('Retry'));
    await waitFor(() => heading('No startups yet'));
  });

  it('a scenario comparison that fails can be retried', async () => {
    api.scenario
      .mockRejectedValueOnce(new Error('boom'))
      .mockReturnValueOnce(new Promise(() => {}));
    simulationAt('/simulations/sim1/scenarios', simData());
    await act(async () => fireEvent.click(button('Compare the two branches')));
    expect(heading('✕ The comparison could not be run')).toBeTruthy();
    await act(async () => fireEvent.click(button('Retry')));
    expect(api.scenario).toHaveBeenCalledTimes(2);
  });

  it('a panel that crashes while rendering is contained, with a retry', () => {
    let broken = true;
    function Fragile() {
      if (broken) throw new Error('render failure');
      return <p>recovered</p>;
    }
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <PanelBoundary name="Market">
          <Fragile />
        </PanelBoundary>
        <p>neighbour panel</p>
      </>,
    );
    expect(heading('✕ Market could not be shown')).toBeTruthy();
    expect(screen.getByText('neighbour panel')).toBeTruthy();
    broken = false;
    fireEvent.click(button('Retry'));
    expect(screen.getByText('recovered')).toBeTruthy();
    quiet.mockRestore();
  });
});

describe('toasts', () => {
  function Notify({ kind }: { kind: 'success' | 'error' }) {
    const { notify } = useToast();
    return (
      <button type="button" onClick={() => notify({ kind, title: `${kind} toast` })}>
        notify {kind}
      </button>
    );
  }

  it('are announced: errors assertively and persistently, others politely and briefly', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Notify kind="success" />
        <Notify kind="error" />
      </ToastProvider>,
    );
    fireEvent.click(button('notify success'));
    fireEvent.click(button('notify error'));
    const polite = screen.getByRole('status');
    const assertive = screen.getByRole('alert');
    expect(polite.getAttribute('aria-live')).toBe('polite');
    expect(polite.textContent).toContain('success toast');
    expect(assertive.textContent).toContain('error toast');
    act(() => vi.advanceTimersByTime(TOAST_MS + 10));
    expect(polite.textContent).not.toContain('success toast');
    expect(assertive.textContent).toContain('error toast');
    fireEvent.click(button('Dismiss: error toast'));
    expect(assertive.textContent).toBe('');
  });

  it('report network loss and recovery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const { api: request } = await import('../../api/client');
    render(<ToastProvider>{null}</ToastProvider>);
    await act(async () => {
      await request('/startups').catch(() => {});
    });
    expect(screen.getByRole('alert').textContent).toContain('Connection lost');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    );
    await act(async () => {
      await request('/startups');
    });
    expect(screen.getByRole('status').textContent).toContain('Back online');
    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it('turn outcomes: complete, quota reached (rules mode), failed and cancelled', () => {
    const [previous, latest] = turnsFixture.slice(-2);
    const quota = { ...latest!, llmUsage: { dailyQuotaExhausted: true } } as typeof latest;
    const toasts = turnToasts(quota!, previous!);
    expect(toasts[0]).toMatchObject({
      kind: 'success',
      title: `Turn ${latest!.turnNumber} complete`,
    });
    expect(toasts[1]).toMatchObject({ kind: 'warning', title: 'Daily AI quota reached' });
    expect(toasts[1]!.body).toContain('rules mode');
    const job = { turnNumber: 13 } as SimulationJob;
    expect(jobToast({ ...job, status: 'FAILED', error: null } as SimulationJob)?.kind).toBe(
      'error',
    );
    expect(jobToast({ ...job, status: 'CANCELLED' } as SimulationJob)?.kind).toBe('info');
    expect(jobToast({ ...job, status: 'COMPLETED' } as SimulationJob)).toBeNull();
  });
});
