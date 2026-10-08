import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import type { Startup } from '@stackforge/shared';
import { ApiError } from '../api/client';
import { startupApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/feedback/Toaster';
import { REPORT_FORMATS, useReportExport } from '../hooks/useReportExport';
import { fuzzyFilter } from '../lib/fuzzy';
import { openStartupSimulation } from '../lib/openStartup';
import { useTheme } from '../theme/ThemeContext';
import { useRegisteredCommands, type Command, type CommandGroup } from './registry';

const GROUPS: CommandGroup[] = [
  'Simulation',
  'AI CEO',
  'Go to',
  'Startups',
  'Account',
  'Appearance',
];
const NO_SIMULATION = 'Open a simulation first';
const NOT_ON_DASHBOARD = 'Available on a simulation dashboard';

interface PaletteState {
  open: boolean;
  /** Opens the palette; it animates from `trigger` and returns focus to it on close. */
  show: (trigger?: HTMLElement | null) => void;
}

const PaletteContext = createContext<PaletteState | null>(null);

export const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Ctrl+K (Cmd+K on a Mac) toggles the palette anywhere in the app when signed in. */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);

  const show = useCallback((from?: HTMLElement | null) => {
    trigger.current = from ?? (document.activeElement as HTMLElement | null);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    const back = trigger.current;
    // After the dialog unmounts, focus returns to whatever opened it (if still on the page).
    requestAnimationFrame(() => {
      if (back?.isConnected) back.focus();
      else document.getElementById('main')?.focus();
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) close();
        else show();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user, open, show, close]);

  const value = useMemo(() => ({ open, show }), [open, show]);
  return (
    <PaletteContext.Provider value={value}>
      {children}
      {open && user && <CommandPalette onClose={close} trigger={trigger.current} />}
    </PaletteContext.Provider>
  );
}

export function useCommandPalette(): PaletteState {
  const state = useContext(PaletteContext);
  if (!state) throw new Error('useCommandPalette must be used inside CommandPaletteProvider');
  return state;
}

/** The visible header button for the palette. */
export function CommandPaletteButton() {
  const { show } = useCommandPalette();
  const shortcut = isMac() ? '⌘K' : 'Ctrl K';
  return (
    <button
      type="button"
      className="icon-button"
      onClick={(e) => show(e.currentTarget)}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
    >
      Commands <kbd aria-hidden>{shortcut}</kbd>
    </button>
  );
}

type StartupList = { state: 'loading' } | { state: 'error' } | { state: 'ready'; list: Startup[] };

/** The commands that do not depend on a mounted panel. */
function useGlobalCommands(startups: StartupList): Command[] {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { theme, preference, toggle, setPreference } = useTheme();
  const { notify } = useToast();
  const simulationId =
    matchPath({ path: '/simulations/:id', end: false }, pathname)?.params.id ?? null;
  const exportReport = useReportExport(simulationId);
  const sim = (path = '') => `/simulations/${simulationId}${path}`;
  const needSim = simulationId ? null : NO_SIMULATION;

  const commands: Command[] = [
    // Simulation views and actions. Submit turn and the AI CEO are registered by their panels
    // on the dashboard; these disabled stand-ins explain where they are available.
    {
      id: 'turn.submit',
      group: 'Simulation',
      label: 'Submit turn',
      keywords: 'play turn next month',
      disabledReason: needSim ?? NOT_ON_DASHBOARD,
      run: () => {},
    },
    {
      id: 'go.scenarios',
      group: 'Simulation',
      label: 'Open scenario comparison',
      keywords: 'scenarios view what if branch compare go to',
      disabledReason: needSim,
      run: () => navigate(sim('/scenarios')),
    },
    ...REPORT_FORMATS.map((format): Command => ({
      id: `export.${format}`,
      group: 'Simulation',
      label: `Export report as ${format.toUpperCase()}`,
      keywords: 'download report export',
      disabledReason: needSim,
      run: () => exportReport(format),
    })),
    ...(['Explain', 'Analyze', 'Scenario'] as const).map((mode): Command => ({
      id: `ceo.${mode.toLowerCase()}`,
      group: 'AI CEO',
      label: `Ask the AI CEO: ${mode}`,
      keywords: 'advisor advice question',
      disabledReason: needSim ?? NOT_ON_DASHBOARD,
      run: () => {},
    })),
    {
      id: 'go.dashboard',
      group: 'Go to',
      label: 'Dashboard',
      keywords: 'kpi home overview',
      disabledReason: needSim,
      run: () => navigate(sim()),
    },
    {
      id: 'go.analytics',
      group: 'Go to',
      label: 'Analytics',
      keywords: 'charts financial customers market decisions forecasts',
      disabledReason: needSim,
      run: () => navigate(sim('/analytics')),
    },
    {
      id: 'go.timeline',
      group: 'Go to',
      label: 'Timeline',
      keywords: 'history turns',
      disabledReason: needSim,
      run: () => navigate(sim('/timeline')),
    },
    {
      id: 'go.startups',
      group: 'Go to',
      label: 'Your startups',
      keywords: 'list home',
      run: () => navigate('/startups'),
    },
    {
      id: 'go.new-startup',
      group: 'Go to',
      label: 'New startup',
      keywords: 'create wizard',
      run: () => navigate('/startups/new'),
    },
    {
      id: 'go.account',
      group: 'Go to',
      label: 'Account',
      keywords: 'profile sessions export delete usage',
      run: () => navigate('/account'),
    },
    ...(user?.role === 'ADMIN'
      ? [
          {
            id: 'go.admin',
            group: 'Go to' as const,
            label: 'Admin',
            keywords: 'statistics',
            run: () => navigate('/admin'),
          },
        ]
      : []),
    {
      id: 'go.privacy',
      group: 'Go to',
      label: 'Privacy',
      run: () => navigate('/privacy'),
    },
    ...startupCommands(startups, async (startup) => {
      try {
        const simulation = await openStartupSimulation(startup);
        navigate(`/simulations/${simulation.id}`);
      } catch (err) {
        notify({
          kind: 'error',
          title: `Could not open ${startup.name}`,
          body: err instanceof ApiError ? err.message : undefined,
        });
      }
    }),
    {
      id: 'theme.toggle',
      group: 'Appearance',
      label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`,
      keywords: 'toggle theme dark light mode colour color appearance',
      run: toggle,
    },
    {
      id: 'theme.system',
      group: 'Appearance',
      label: 'Use the system theme',
      keywords: 'theme automatic os default',
      disabledReason: preference === 'system' ? 'Already following the system' : null,
      run: () => setPreference('system'),
    },
    {
      id: 'auth.logout',
      group: 'Account',
      label: 'Log out',
      keywords: 'sign out exit',
      run: () => logout(),
    },
  ];
  return commands;
}

function startupCommands(
  startups: StartupList,
  open: (startup: Startup) => Promise<void>,
): Command[] {
  if (startups.state === 'loading') {
    return [
      {
        id: 'startup.loading',
        group: 'Startups',
        label: 'Switch startup',
        disabledReason: 'Loading your startups…',
        run: () => {},
      },
    ];
  }
  if (startups.state === 'error') {
    return [
      {
        id: 'startup.error',
        group: 'Startups',
        label: 'Switch startup',
        disabledReason: 'Your startups could not be loaded',
        run: () => {},
      },
    ];
  }
  if (startups.list.length === 0) {
    return [
      {
        id: 'startup.none',
        group: 'Startups',
        label: 'Switch startup',
        disabledReason: 'You have no startups yet',
        run: () => {},
      },
    ];
  }
  return startups.list.map((s) => ({
    id: `startup.${s.id}`,
    group: 'Startups' as const,
    label: `Switch to ${s.name}`,
    keywords: `startup company ${s.product.name} ${s.configuration.industry}`,
    run: () => open(s),
  }));
}

/**
 * The palette: a modal dialog with a search box (combobox) over a list of commands. Arrow
 * keys move, Enter runs, Escape closes; Tab stays inside; focus returns to the trigger on
 * close. Unavailable commands stay listed, disabled, with the reason.
 */
function CommandPalette({
  onClose,
  trigger,
}: {
  onClose: () => void;
  trigger: HTMLElement | null;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [startups, setStartups] = useState<StartupList>({ state: 'loading' });
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-option-${i}`;
  const registered = useRegisteredCommands();
  const global = useGlobalCommands(startups);

  useEffect(() => {
    input.current?.focus();
    let cancelled = false;
    startupApi
      .list()
      .then((list) => !cancelled && setStartups({ state: 'ready', list }))
      .catch(() => !cancelled && setStartups({ state: 'error' }));
    return () => {
      cancelled = true;
    };
  }, []);

  // Panel-registered commands replace their global stand-ins (same id).
  const own = registered();
  const all = [
    ...global.map((c) => own.get(c.id) ?? c),
    ...[...own.values()].filter((c) => !global.some((g) => g.id === c.id)),
  ];
  const ordered = GROUPS.flatMap((g) => all.filter((c) => c.group === g));
  const results = fuzzyFilter(
    query,
    ordered,
    (c) => c.label,
    (c) => `${c.group} ${c.keywords ?? ''}`,
  );
  const current = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    document.getElementById(optionId(current))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionId is stable per listId
  }, [current, listId]);

  function run(command: Command | undefined) {
    if (!command || command.disabledReason) return;
    onClose();
    void command.run();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(results.length ? (current + 1) % results.length : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(results.length ? (current - 1 + results.length) % results.length : 0);
    } else if (e.key === 'Home' && e.ctrlKey) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && e.ctrlKey) {
      e.preventDefault();
      setActive(Math.max(0, results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[current]);
    } else if (e.key === 'Tab') {
      // Focus trap: the dialog's only focus stop is the search box.
      e.preventDefault();
      input.current?.focus();
    }
  }

  // Open from the trigger: the panel grows from the point of the button that opened it.
  const [originStyle, setOriginStyle] = useState<CSSProperties>();
  useLayoutEffect(() => {
    const panel = dialog.current;
    if (!trigger?.isConnected || !panel) return;
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    setOriginStyle({
      '--origin': `${t.left + t.width / 2 - p.left}px ${t.top + t.height / 2 - p.top}px`,
    } as CSSProperties);
  }, [trigger]);

  let lastGroup: CommandGroup | null = null;
  return (
    <div
      className="palette-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        style={originStyle}
      >
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={results.length ? optionId(current) : undefined}
          aria-label="Search commands"
          placeholder="Type a command or search…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
        />
        <ul className="palette-list" id={listId} role="listbox" aria-label="Commands">
          {results.length === 0 && (
            <li className="palette-group" role="presentation">
              No commands match “{query}”
            </li>
          )}
          {results.map((c, i) => {
            const heading = !query.trim() && c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <PaletteOption
                key={c.id}
                id={optionId(i)}
                command={c}
                heading={heading}
                selected={i === current}
                onHover={() => setActive(i)}
                onRun={() => run(c)}
              />
            );
          })}
        </ul>
        <div className="palette-foot" aria-hidden>
          <span>↑↓ move</span>
          <span>Enter run</span>
          <span>Esc close</span>
        </div>
        <p className="sr-only" aria-live="polite">
          {results.length} command{results.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}

function PaletteOption({
  id,
  command,
  heading,
  selected,
  onHover,
  onRun,
}: {
  id: string;
  command: Command;
  heading: string | null;
  selected: boolean;
  onHover: () => void;
  onRun: () => void;
}) {
  const disabled = Boolean(command.disabledReason);
  return (
    <>
      {heading && (
        <li className="palette-group" role="presentation" aria-hidden>
          {heading}
        </li>
      )}
      <li
        id={id}
        role="option"
        className="palette-option"
        aria-selected={selected}
        aria-disabled={disabled || undefined}
        onMouseMove={onHover}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onRun}
      >
        <span>{command.label}</span>
        {disabled && (
          <span className="reason">
            <span className="sr-only">, unavailable: </span>
            {command.disabledReason}
          </span>
        )}
      </li>
    </>
  );
}
