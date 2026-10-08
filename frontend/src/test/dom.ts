import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Simulation, SimulationAnalytics, SimulationTurn } from '@stackforge/shared';

/**
 * Test helpers for component tests (jsdom). jsdom has no matchMedia, so tests install a
 * controllable one: set which queries match and fire "change" like an OS setting switch.
 */
export interface MediaControl {
  set: (query: string, matches: boolean) => void;
}

export function mockMatchMedia(initial: Record<string, boolean> = {}): MediaControl {
  const state = new Map(Object.entries(initial));
  const listeners = new Map<string, Set<(e: MediaQueryListEvent) => void>>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return state.get(query) ?? false;
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)!.add(fn);
    },
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
      listeners.get(query)?.delete(fn);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;
  return {
    set(query, matches) {
      state.set(query, matches);
      listeners.get(query)?.forEach((fn) => fn({ matches, media: query } as MediaQueryListEvent));
    },
  };
}

export const LIGHT = '(prefers-color-scheme: light)';
export const REDUCED = '(prefers-reduced-motion: reduce)';

// The backend's recorded engine run (12 SaaS turns) and its analytics, as the e2e mock uses.
const root = path.resolve(process.cwd(), '..');
const read = (p: string) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
const run = read('backend/tests/fixtures/saas-run.json');
export const analyticsFixture = read(
  'backend/tests/fixtures/saas-analytics.json',
) as SimulationAnalytics;

export const turnsFixture = (
  run.records as Omit<SimulationTurn, 'id' | 'simulationId' | 'createdAt'>[]
).map((r, i) => ({
  ...r,
  id: `t${i + 1}`,
  simulationId: 'sim1',
  createdAt: '2026-10-06T10:00:00.000Z',
})) as SimulationTurn[];

export const simulationFixture = {
  id: 'sim1',
  ownerId: 'u1',
  startupId: 'st1',
  seed: run.seed,
  agentMode: 'rules',
  status: 'ACTIVE',
  engineVersion: run.engineVersion,
  currentTurn: turnsFixture.length,
  configuration: run.configuration,
  currentState: turnsFixture.at(-1)!.stateAfter,
  activeJobId: null,
  createdAt: '2026-10-06T10:00:00.000Z',
  updatedAt: '2026-10-06T10:00:00.000Z',
  startupName: 'NovaTech',
  productName: 'Nova CRM',
} as unknown as Simulation;

/** A simulation that has not played a turn yet. */
export const freshSimulation = {
  ...simulationFixture,
  currentTurn: 0,
  currentState: run.initialState,
} as Simulation;
