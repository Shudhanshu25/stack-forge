import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, Route } from '@playwright/test';

/**
 * Serves /api/v1 from the backend's recorded fixtures (a real 12-turn SaaS run and its
 * analytics), so the accessibility check renders every main view with realistic data and no
 * running backend.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
const run = read('backend/tests/fixtures/saas-run.json');
const analytics = read('backend/tests/fixtures/saas-analytics.json');
const templates = readdirSync(path.join(root, 'shared/templates/industries'))
  .sort()
  .map((f) => read(`shared/templates/industries/${f}`));

const now = '2026-10-06T10:00:00.000Z';
export const user = {
  id: 'u1',
  email: 'founder@example.com',
  name: 'Asha Founder',
  role: 'USER',
  createdAt: now,
  onboardingCompleted: true,
  emailVerified: true,
  hasPassword: true,
  googleLinked: false,
};
const startup = {
  id: 'st1',
  ownerId: 'u1',
  name: 'NovaTech',
  product: { name: 'Nova CRM', description: 'CRM for small businesses' },
  location: { country: 'IN', state: 'KA', city: 'Bengaluru', cityId: 'bengaluru', tier: 'METRO' },
  configuration: run.configuration,
  createdAt: now,
  updatedAt: now,
};
const records = run.records.map((r: object, i: number) => ({
  ...r,
  id: `t${i + 1}`,
  simulationId: 'sim1',
  createdAt: now,
}));
const simulation = {
  id: 'sim1',
  ownerId: 'u1',
  startupId: 'st1',
  seed: run.seed,
  agentMode: 'rules',
  status: 'ACTIVE',
  engineVersion: run.engineVersion,
  currentTurn: records.length,
  configuration: run.configuration,
  currentState: records.at(-1).stateAfter,
  activeJobId: null,
  createdAt: now,
  updatedAt: now,
  startupName: 'NovaTech',
  productName: 'Nova CRM',
};

/** Like the real API: 202 with an empty body (password reset, resend confirmation). */
const ACCEPTED = Symbol('202 Accepted');

const ROUTES: [string, RegExp, unknown][] = [
  ['POST', /\/auth\/refresh$/, { user, accessToken: 'test-token', accessTokenExpiresIn: 900 }],
  ['GET', /\/auth\/me$/, user],
  ['GET', /\/auth\/options$/, { google: true }],
  ['GET', /\/auth\/sessions$/, {
    sessions: [
      { id: 'f1', device: 'Chrome on Windows', signedInAt: now, lastUsedAt: now, current: true },
      { id: 'f2', device: 'Safari on iOS', signedInAt: now, lastUsedAt: now, current: false },
    ],
  }],
  ['GET', /\/account\/llm-usage$/, {
    usedToday: 12_400, dailyQuota: 200_000, remaining: 187_600, exhausted: false,
    resetsAt: '2026-10-07T00:00:00.000Z',
  }],
  ['POST', /\/auth\/password-reset$/, ACCEPTED],
  ['GET', /\/industry-templates$/, { templates }],
  ['GET', /\/locations$/, {
    dataVersion: 'test', country: 'IN',
    tiers: [
      { tier: 'METRO', label: 'Metro', description: 'Class X city' },
      { tier: 'TIER_2', label: 'Tier 2', description: 'Class Y city' },
      { tier: 'TIER_3', label: 'Tier 3', description: 'Any smaller city' },
    ],
    states: [{ code: 'KA', name: 'Karnataka', cities: [{ id: 'bengaluru', name: 'Bengaluru', tier: 'METRO' }] }],
  }],
  ['POST', /\/locations\/profile$/, run.configuration.locationProfile],
  ['GET', /\/startups$/, { startups: [startup] }],
  ['GET', /\/startups\/st1$/, startup],
  ['GET', /\/startups\/st1\/simulations$/, { simulations: [simulation] }],
  ['GET', /\/simulations\/sim1$/, simulation],
  ['GET', /\/simulations\/sim1\/turns$/, { turns: records }],
  ['GET', /\/simulations\/sim1\/analytics$/, analytics],
]; // prettier-ignore

/** Signed-in by default; pass signedIn=false for the guest pages. */
export async function mockApi(page: Page, { signedIn = true } = {}) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!signedIn && url.pathname.endsWith('/auth/refresh')) {
      return route.fulfill({
        status: 401,
        json: {
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Session expired', details: null },
        },
      });
    }
    const match = ROUTES.find(([method, re]) => method === req.method() && re.test(url.pathname));
    if (match?.[2] === ACCEPTED) return route.fulfill({ status: 202, body: '' });
    if (match) return route.fulfill({ status: 200, json: match[2] });
    return route.fulfill({
      status: 404,
      json: {
        error: {
          code: 'NOT_FOUND',
          message: `No mock for ${req.method()} ${url.pathname}`,
          details: null,
        },
      },
    });
  });
  // No live socket in the check: the app falls back to polling.
  await page.routeWebSocket(/\/api\/v1\/ws/, (ws) => ws.close());
}
