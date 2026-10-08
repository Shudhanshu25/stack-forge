import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import request from 'supertest';
import type {
  AIAdvice,
  AdvisorRequest,
  AuthResponse,
  DecisionPreview,
  EngineAnalyticsRequest,
  EngineInfoResponse,
  EnginePreviewRequest,
  EngineScenarioRequest,
  EngineStartRequest,
  EngineStartResponse,
  LocationCatalog,
  LocationProfile,
  LocationProfileRequest,
  PipelineError,
  PipelineTurnRequest,
  ScenarioComparison,
  SimulationAnalytics,
  SimulationState,
  SimulationTurn,
  StartupConfiguration,
  StartupCreateRequest,
} from '@stackforge/shared';
import { createApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';
import {
  EngineError,
  type EngineClient,
  type PipelineOutcome,
  type StageUpdate,
} from '../src/engine/engine-client.js';
import { createLogger } from '../src/logger.js';
import type { HealthChecks } from '../src/modules/health/health.service.js';
import { MemoryEventBus } from '../src/queue/event-bus.js';
import type { TurnQueue } from '../src/queue/turn-queue.js';
import type { GoogleIdentity, GoogleOAuth } from '../src/modules/auth/google.js';
import { UserModel } from '../src/modules/auth/user.model.js';
import { MemoryEmailSender } from '../src/modules/email/email.js';
import { LlmUsageService } from '../src/modules/llm/llm-usage.service.js';
import { TurnProcessor } from '../src/worker/turn-processor.js';

const up = async () => undefined;

export interface EngineFixture {
  engineVersion: string;
  seed: number;
  configuration: StartupConfiguration;
  initialState: SimulationState;
  records: SimulationTurn[];
}

/** A real 12-turn SaaS run produced by the Python engine (python -m runner.fixture). */
export const fixture: EngineFixture = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'saas-run.json'),
    'utf8',
  ),
);

/** Analytics computed by the real simulation service for the fixture run (python -m runner.fixture). */
export const analyticsFixture: SimulationAnalytics = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'saas-analytics.json'),
    'utf8',
  ),
);

/** A small location catalog: Karnataka (Bengaluru listed) and Maharashtra (no listed city). */
export const locationCatalogFixture: LocationCatalog = {
  dataVersion: 'test',
  country: 'IN',
  tiers: [
    { tier: 'METRO', label: 'Metro', description: 'X city' },
    { tier: 'TIER_2', label: 'Tier 2', description: 'Y city' },
    { tier: 'TIER_3', label: 'Tier 3', description: 'Z city' },
  ],
  states: [
    {
      code: 'KA',
      name: 'Karnataka',
      cities: [{ id: 'bengaluru', name: 'Bengaluru', tier: 'METRO' }],
    },
    { code: 'MH', name: 'Maharashtra', cities: [] },
  ],
};

/** Replays the fixture run: turn n returns the fixture's record n, whatever the decisions. */
export class FixtureEngine implements EngineClient {
  readonly calls: string[] = [];
  readonly turnRequests: PipelineTurnRequest[] = [];
  readonly adviceRequests: AdvisorRequest[] = [];
  /** Next runTurn throws this (for example ENGINE_UNAVAILABLE). */
  throwNext: EngineError | null = null;
  /** Next runTurn returns this pipeline error instead of a record. */
  rejectNext: PipelineError | null = null;
  /** Runs between the last stage and the result, e.g. to cancel a running job. */
  beforeResult: (() => Promise<void>) | null = null;
  /** Edits the next record before it is returned. */
  alterNext: ((record: SimulationTurn) => void) | null = null;

  async locations(): Promise<LocationCatalog> {
    this.calls.push('locations');
    return structuredClone(locationCatalogFixture);
  }

  /** Bengaluru (listed) or any known state by tier; ZZ and unknown cities are refused. */
  async locationProfile(req: LocationProfileRequest): Promise<LocationProfile> {
    this.calls.push(`locationProfile:${req.cityId ?? req.tier}`);
    if (req.state === 'ZZ' || (req.cityId && req.cityId !== 'bengaluru')) {
      throw new EngineError('UNKNOWN_LOCATION', `unknown location: ${req.cityId ?? req.state}`);
    }
    if (req.cityId === 'bengaluru' && req.state !== 'KA') {
      throw new EngineError('UNKNOWN_LOCATION', 'Bengaluru is not in that state');
    }
    const listed = req.cityId === 'bengaluru';
    const index = (value: number) => ({ value, isEstimate: !listed, source: 'test fixture' });
    return {
      dataVersion: 'test',
      basis: listed ? 'LISTED_CITY' : 'STATE_AND_TIER',
      country: 'IN',
      state: req.state,
      stateName: req.state === 'KA' ? 'Karnataka' : req.state,
      city: listed ? 'Bengaluru' : (req.city ?? null),
      cityId: listed ? 'bengaluru' : null,
      tier: listed ? 'METRO' : (req.tier ?? null),
      indices: {
        salaryIndex: index(listed ? 1.3 : 0.9),
        operatingCostIndex: index(listed ? 1.2 : 0.85),
        purchasingPower: index(1.4),
        localMarketSize: index(listed ? 1.2 : 0.7),
        talentAvailability: index(listed ? 1.4 : 0.7),
        competitionDensity: index(listed ? 1.4 : 0.8),
        fundingAccess: index(listed ? 1.5 : 0.6),
        infrastructure: index(listed ? 1.1 : 0.9),
        regulatoryBurden: index(0.95),
      },
    };
  }

  async start(req: EngineStartRequest): Promise<EngineStartResponse> {
    this.calls.push(`start:${req.seed}`);
    return { state: structuredClone(fixture.initialState), engineVersion: fixture.engineVersion };
  }

  async preview(req: EnginePreviewRequest): Promise<DecisionPreview> {
    this.calls.push(`preview:${req.turnNumber}`);
    return {
      turnNumber: req.turnNumber,
      label: 'Simulation estimate',
      decisionResults: req.decisions.map((decision) => ({
        decision,
        status: 'ACCEPTED' as const,
        effects: [{ metric: 'customers', direction: 'UP' as const, magnitude: 'SMALL' as const }],
      })),
      combinedEffects: [],
    };
  }

  async advise(req: AdvisorRequest): Promise<AIAdvice> {
    this.adviceRequests.push(req);
    return {
      available: true,
      mode: req.mode,
      ...(req.question ? { question: req.question } : {}),
      summary: 'Customers grew while costs stayed flat.',
      positiveFactors: ['More customers'],
      negativeFactors: ['Still loss-making'],
      keyRisk: 'Cash runway',
      keyOpportunity: 'Word of mouth',
      recommendation: 'Keep marketing steady',
      reasoning: 'Marketing brought customers.',
      confidence: 0.6,
      modelVersion: 'fake',
    };
  }

  async analytics(req: EngineAnalyticsRequest): Promise<SimulationAnalytics> {
    this.calls.push(`analytics:${req.records.length}`);
    return structuredClone(analyticsFixture);
  }

  async scenario(req: EngineScenarioRequest): Promise<ScenarioComparison> {
    this.calls.push(`scenario:${req.horizon}`);
    const branch = (label: string, i: number) => ({
      label,
      decisions: req.branches[i]!.decisions,
      rejections: [],
      bankruptAtTurn: null,
      turns: [
        {
          turn: req.state.turn + 1,
          revenue: 100 + i,
          profit: -5,
          customers: 3,
          churnRate: 0,
          cash: 900,
        },
      ],
      totals: { revenue: 100 + i, profit: -5, endCash: 900, endCustomers: 3, averageChurnRate: 0 },
    });
    return {
      startTurn: req.state.turn + 1,
      horizon: req.horizon,
      label: 'Simulation estimate',
      agentMode: 'rules',
      branches: [branch('Baseline', 0), branch('Alternative', 1)],
      differences: [{ metric: 'revenue', baseline: 100, alternative: 101, difference: 1 }],
    };
  }

  async info(): Promise<EngineInfoResponse> {
    return {
      engineVersion: fixture.engineVersion,
      modelVersion: 'forecast-test',
      trainingDatasetVersion: 'ds-test',
      llmConfigured: false,
      agentModel: 'agent',
      advisorModel: 'advisor',
    };
  }

  async replay(): Promise<never> {
    throw new Error('not used');
  }

  async runTurn(
    req: PipelineTurnRequest,
    onStage: (update: StageUpdate) => Promise<void>,
  ): Promise<PipelineOutcome> {
    this.calls.push(`turn:${req.turnNumber}`);
    this.turnRequests.push(req);
    if (this.throwNext) {
      const err = this.throwNext;
      this.throwNext = null;
      throw err;
    }
    await onStage({ stage: 'PROCESSING_DECISION', progress: 45 });
    if (this.rejectNext) {
      const error = this.rejectNext;
      this.rejectNext = null;
      return { error };
    }
    await onStage({ stage: 'UPDATING_FINANCIAL_MODEL', progress: 90 });
    const hook = this.beforeResult;
    this.beforeResult = null;
    await hook?.();
    const record = structuredClone(fixture.records[req.turnNumber - 1]!);
    record.decisions = req.decisions;
    this.alterNext?.(record);
    this.alterNext = null;
    return { record };
  }
}

/** In-memory queue: tests decide when queued jobs run. */
export class InlineQueue implements TurnQueue {
  readonly waiting: string[] = [];
  failNext = false;

  async enqueue(jobId: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('redis down');
    }
    if (!this.waiting.includes(jobId)) this.waiting.push(jobId);
  }

  async removeIfWaiting(jobId: string): Promise<boolean> {
    const i = this.waiting.indexOf(jobId);
    if (i < 0) return false;
    this.waiting.splice(i, 1);
    return true;
  }

  async close(): Promise<void> {}
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  return loadConfig({ authRateLimitMax: 1000, logLevel: 'silent', ...overrides });
}

/**
 * Google stand-in: checks PKCE like Google does (the verifier must hash to the challenge sent
 * with the authorization request) and returns `identity`.
 */
export class FakeGoogleOAuth implements GoogleOAuth {
  enabled = true;
  identity: GoogleIdentity = {
    sub: 'google-sub-1',
    email: 'googler@example.com',
    emailVerified: true,
    name: 'Goo Gler',
  };
  private challenges = new Map<string, string>(); // code -> challenge

  authorizationUrl(state: string, codeChallenge: string): string {
    const code = `code-${state}`;
    this.challenges.set(code, codeChallenge);
    return `https://accounts.google.test/auth?state=${state}&code=${code}`;
  }

  async exchange(code: string, codeVerifier: string): Promise<GoogleIdentity> {
    const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
    if (this.challenges.get(code) !== challenge) throw new Error('PKCE verification failed');
    return this.identity;
  }
}

export function harness(overrides: Partial<Config> = {}, healthChecks: Partial<HealthChecks> = {}) {
  const config = testConfig(overrides);
  const logger = createLogger('silent');
  const engine = new FixtureEngine();
  const queue = new InlineQueue();
  const bus = new MemoryEventBus();
  const email = new MemoryEmailSender();
  const google = new FakeGoogleOAuth();
  const app = createApp({
    config,
    logger,
    healthChecks: { mongodb: up, redis: up, simulationEngine: up, ...healthChecks },
    engine,
    queue,
    bus,
    email,
    google,
  });
  const processor = new TurnProcessor(
    engine,
    bus,
    logger,
    new LlmUsageService(config.llmUserDailyTokenQuota),
  );
  /** Runs every queued job, like the worker would. */
  const drain = async () => {
    while (queue.waiting.length) await processor.process(queue.waiting.shift()!);
  };
  return { app, config, engine, queue, bus, processor, drain, email, google };
}

export function testApp(
  overrides: Partial<Config> = {},
  healthChecks: Partial<HealthChecks> = {},
): Express {
  return harness(overrides, healthChecks).app;
}

export const STRONG_PASSWORD = 'Correct-Horse-42';

let counter = 0;
export function uniqueEmail(prefix = 'founder'): string {
  counter += 1;
  return `${prefix}${counter}@example.com`;
}

export interface RegisteredUser {
  email: string;
  accessToken: string;
  refreshCookie: string;
  body: AuthResponse;
}

export function refreshCookieOf(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('sf_refresh='));
  if (!cookie) throw new Error('No refresh cookie set');
  return cookie.split(';')[0]!;
}

/**
 * Registers a user and marks the email verified, as most tests need a user who can simulate.
 * Use registerUnverified for the verification flow itself.
 */
export async function register(app: Express, email = uniqueEmail()): Promise<RegisteredUser> {
  const user = await registerUnverified(app, email);
  await UserModel.updateOne({ email }, { $set: { emailVerifiedAt: new Date() } });
  return user;
}

export async function registerUnverified(
  app: Express,
  email = uniqueEmail(),
): Promise<RegisteredUser> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: STRONG_PASSWORD, name: 'Test Founder' })
    .expect(201);
  return {
    email,
    accessToken: res.body.accessToken,
    refreshCookie: refreshCookieOf(res),
    body: res.body,
  };
}

export const authHeader = (user: RegisteredUser) => ({
  Authorization: `Bearer ${user.accessToken}`,
});

export const novaTech: StartupCreateRequest = {
  name: 'NovaTech',
  industry: 'SAAS',
  businessModel: 'SUBSCRIPTION',
  initialCapital: 100_000_000, // ₹10,00,000
  product: { name: 'Nova CRM', description: 'CRM for small businesses' },
  initialPrice: 49_900, // ₹499
  marketSize: 200_000,
  difficulty: 'NORMAL',
  location: { country: 'IN', state: 'KA', city: 'Bengaluru', cityId: 'bengaluru', tier: 'METRO' },
};
