// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { simulationApi } from '../api/endpoints';
import { CeoPanel } from '../components/dashboard/CeoPanel';
import { ToastProvider } from '../components/feedback/Toaster';
import { turnsFixture } from '../test/dom';
import { LIGHT, mockMatchMedia } from '../test/dom';
import { ThemeProvider } from '../theme/ThemeContext';
import { CommandPaletteButton, CommandPaletteProvider } from './CommandPalette';
import { CommandRegistryProvider, useCommandSource } from './registry';

const logout = vi.fn();
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Asha', role: 'USER', emailVerified: true },
    logout,
  }),
}));
vi.mock('../api/endpoints', () => ({
  startupApi: {
    list: vi.fn(async () => [
      {
        id: 'st2',
        name: 'Chai Point',
        product: { name: 'Chai' },
        configuration: { industry: 'FOOD_AND_BEVERAGE' },
      },
    ]),
  },
  simulationApi: {
    listForStartup: vi.fn(async () => [{ id: 'sim2' }]),
    report: vi.fn(async () => {}),
    advise: vi.fn(async () => ({ available: false, unavailableReason: 'test' })),
  },
}));

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

/** A panel that registers a command, as the decision panel does for "Submit turn". */
function Panel({ onSubmit, blocked }: { onSubmit: () => void; blocked?: string }) {
  useCommandSource('test-panel', [
    {
      id: 'turn.submit',
      group: 'Simulation',
      label: 'Submit turn 13',
      disabledReason: blocked ?? null,
      run: onSubmit,
    },
  ]);
  return <p>dashboard</p>;
}

function mount(path: string, panel?: React.ReactNode) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>
          <CommandRegistryProvider>
            <CommandPaletteProvider>
              <CommandPaletteButton />
              <Routes>
                <Route path="*" element={panel ?? null} />
              </Routes>
              <Where />
            </CommandPaletteProvider>
          </CommandRegistryProvider>
        </ToastProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const search = () => screen.getByRole('combobox', { name: 'Search commands' });
const options = () => screen.getAllByRole('option');
const activeOption = () =>
  document.getElementById(search().getAttribute('aria-activedescendant') ?? '');
const press = (key: string, init: Partial<KeyboardEvent> = {}) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init });
const openWithShortcut = () => act(() => press('k', { ctrlKey: true }));

beforeEach(() => {
  localStorage.clear();
  mockMatchMedia({ [LIGHT]: false });
  Element.prototype.scrollIntoView = () => {}; // not implemented by jsdom
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    fn(0);
    return 0;
  });
  logout.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('command palette', () => {
  it('opens with Ctrl+K, focuses the search box and closes again with Ctrl+K', () => {
    mount('/startups');
    openWithShortcut();
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeTruthy();
    expect(document.activeElement).toBe(search());
    openWithShortcut();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens with Cmd+K too', () => {
    mount('/startups');
    act(() => press('k', { metaKey: true }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('runs a command by typing, arrowing and Enter', () => {
    mount('/simulations/sim1');
    openWithShortcut();
    fireEvent.change(search(), { target: { value: 'analytics' } });
    expect(activeOption()?.textContent).toContain('Analytics');
    act(() => press('Enter'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe('/simulations/sim1/analytics');
  });

  it('fuzzy-matches command names', () => {
    mount('/simulations/sim1');
    openWithShortcut();
    fireEvent.change(search(), { target: { value: 'tmln' } });
    expect(options()[0]!.textContent).toContain('Timeline');
    fireEvent.change(search(), { target: { value: 'xyzzy' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText(/No commands match/)).toBeTruthy();
  });

  it('moves the selection with the arrow keys, wrapping around', () => {
    mount('/startups');
    openWithShortcut();
    const first = activeOption()!.id;
    act(() => press('ArrowDown'));
    expect(activeOption()!.id).not.toBe(first);
    act(() => press('ArrowUp'));
    expect(activeOption()!.id).toBe(first);
    act(() => press('ArrowUp'));
    expect(activeOption()!.id).toBe(options().at(-1)!.id);
  });

  it('shows unavailable commands disabled, with the reason, and does not run them', () => {
    mount('/startups');
    openWithShortcut();
    fireEvent.change(search(), { target: { value: 'submit turn' } });
    const submit = options()[0]!;
    expect(submit.getAttribute('aria-disabled')).toBe('true');
    expect(submit.textContent).toContain('Open a simulation first');
    act(() => press('Enter'));
    expect(screen.getByRole('dialog')).toBeTruthy(); // still open: nothing ran
  });

  it('runs commands registered by the mounted panel in place of the stand-ins', () => {
    const onSubmit = vi.fn();
    mount('/simulations/sim1', <Panel onSubmit={onSubmit} />);
    openWithShortcut();
    fireEvent.change(search(), { target: { value: 'submit' } });
    expect(activeOption()!.textContent).toBe('Submit turn 13');
    act(() => press('Enter'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('a registered command can be unavailable with its own reason', () => {
    mount('/simulations/sim1', <Panel onSubmit={() => {}} blocked="A turn is already running" />);
    openWithShortcut();
    fireEvent.change(search(), { target: { value: 'submit' } });
    expect(activeOption()!.textContent).toContain('A turn is already running');
  });

  it('keeps focus inside while open and returns it to the trigger on Escape', () => {
    mount('/startups');
    const trigger = screen.getByRole('button', { name: /Commands/ });
    trigger.focus();
    act(() => trigger.click());
    act(() => press('Tab'));
    expect(document.activeElement).toBe(search());
    act(() => press('Tab', { shiftKey: true }));
    expect(document.activeElement).toBe(search());
    act(() => press('Escape'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('asks the AI CEO in each mode, exports reports and opens scenarios', async () => {
    mount('/simulations/sim1', <CeoPanel simulationId="sim1" latest={turnsFixture.at(-1)!} />);
    for (const [label, mode] of [
      ['Explain', 'EXPLAIN'],
      ['Analyze', 'ANALYZE'],
      ['Scenario', 'SCENARIO'],
    ] as const) {
      openWithShortcut();
      fireEvent.change(search(), { target: { value: `ask ai ceo ${label}` } });
      expect(activeOption()!.textContent).toBe(`Ask the AI CEO: ${label}`);
      await act(async () => press('Enter'));
      expect(simulationApi.advise).toHaveBeenLastCalledWith('sim1', { mode });
    }

    openWithShortcut();
    fireEvent.change(search(), { target: { value: 'export pdf' } });
    await act(async () => press('Enter'));
    expect(simulationApi.report).toHaveBeenCalledWith('sim1', 'pdf');
    await waitFor(() => expect(screen.getByText('PDF report ready')).toBeTruthy());

    openWithShortcut();
    fireEvent.change(search(), { target: { value: 'scenario comparison' } });
    act(() => press('Enter'));
    expect(screen.getByTestId('where').textContent).toBe('/simulations/sim1/scenarios');
  });

  it('lists every required command', async () => {
    mount('/simulations/sim1');
    openWithShortcut();
    await waitFor(() => expect(screen.getByText('Switch to Chai Point')).toBeTruthy());
    const labels = options().map((o) => o.textContent);
    for (const label of [
      'Dashboard',
      'Analytics',
      'Timeline',
      'Open scenario comparison',
      'Submit turn',
      'Ask the AI CEO: Explain',
      'Ask the AI CEO: Analyze',
      'Ask the AI CEO: Scenario',
      'Switch to light theme',
      'Export report as CSV',
      'Switch to Chai Point',
      'Log out',
    ]) {
      expect(
        labels.some((l) => l?.startsWith(label)),
        label,
      ).toBe(true);
    }
  });

  it('switches startup, toggles the theme and logs out', async () => {
    mount('/simulations/sim1');
    openWithShortcut();
    await waitFor(() => screen.getByText('Switch to Chai Point'));
    fireEvent.change(search(), { target: { value: 'chai' } });
    await act(async () => press('Enter'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/simulations/sim2'));

    openWithShortcut();
    fireEvent.change(search(), { target: { value: 'light theme' } });
    act(() => press('Enter'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    openWithShortcut();
    fireEvent.change(search(), { target: { value: 'log out' } });
    act(() => press('Enter'));
    expect(logout).toHaveBeenCalled();
  });
});
