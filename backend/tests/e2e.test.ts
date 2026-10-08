/**
 * End to end: the real simulation service (FastAPI, deterministic stub LLM) behind the real
 * backend. Register, create a startup, make a decision, run a turn, view results, ask the CEO.
 * Redis is replaced by the in-process queue; everything else is the production code path.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { HttpEngineClient } from '../src/engine/engine-client.js';
import { createLogger } from '../src/logger.js';
import { MemoryEventBus } from '../src/queue/event-bus.js';
import { TurnProcessor } from '../src/worker/turn-processor.js';
import { InlineQueue, authHeader, novaTech, register, testConfig } from './helpers.js';

const SIMULATION_DIR = resolve(import.meta.dirname, '../../simulation');
const PYTHON =
  process.env.SIM_PYTHON ??
  [join(SIMULATION_DIR, '.venv/Scripts/python.exe'), join(SIMULATION_DIR, '.venv/bin/python')].find(
    existsSync,
  );

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => done(port));
    });
  });
}

async function waitForHealth(url: string, ms: number): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${url}/health`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('simulation service did not start');
}

describe.skipIf(!PYTHON)('end to end with the real simulation service', () => {
  let child: ChildProcess;
  let baseUrl: string;

  beforeAll(async () => {
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    child = spawn(PYTHON!, ['-m', 'app.main'], {
      cwd: SIMULATION_DIR,
      env: {
        ...process.env,
        APP_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: String(port),
        LLM_PROVIDER: 'stub',
        LLM_API_KEY: '',
        LOG_LEVEL: 'WARNING',
      },
      stdio: 'ignore',
    });
    await waitForHealth(baseUrl, 60_000);
  }, 90_000);

  afterAll(() => {
    child?.kill();
  });

  it('register → startup → decision → turn → results → ask the CEO', async () => {
    const engine = new HttpEngineClient(baseUrl, 15_000, 60_000);
    const queue = new InlineQueue();
    const bus = new MemoryEventBus();
    const logger = createLogger('silent');
    const app = createApp({
      config: testConfig(),
      logger,
      healthChecks: {
        mongodb: async () => undefined,
        redis: async () => undefined,
        simulationEngine: async () => undefined,
      },
      engine,
      queue,
      bus,
    });
    const worker = new TurnProcessor(engine, bus, logger);

    // Register and create a startup.
    const user = await register(app);
    const auth = authHeader(user);
    const startup = await request(app)
      .post('/api/v1/startups')
      .set(auth)
      .send(novaTech)
      .expect(201);

    // Start a simulation with agents (the stub LLM answers them).
    const sim = await request(app)
      .post(`/api/v1/startups/${startup.body.id}/simulation`)
      .set(auth)
      .send({ seed: 2024, agentMode: 'llm' })
      .expect(201);
    const simId = sim.body.id as string;
    expect(sim.body).toMatchObject({ currentTurn: 0, agentMode: 'llm' });

    // Make a decision: preview it, then play the turn.
    const decisions = [
      { type: 'MARKETING', value: 5_000_000 },
      { type: 'HIRING', value: 5 },
    ];
    const preview = await request(app)
      .post(`/api/v1/simulations/${simId}/preview`)
      .set(auth)
      .send({ decisions })
      .expect(200);
    expect(preview.body.turnNumber).toBe(1);

    const { jobId } = (
      await request(app)
        .post(`/api/v1/simulations/${simId}/turns`)
        .set(auth)
        .send({ decisions })
        .expect(202)
    ).body;
    await worker.process(queue.waiting.shift()!);
    const job = await request(app).get(`/api/v1/jobs/${jobId}`).set(auth).expect(200);
    expect(job.body.status).toBe('COMPLETED');

    // View results.
    const after = await request(app).get(`/api/v1/simulations/${simId}`).set(auth).expect(200);
    expect(after.body.currentTurn).toBe(1);
    const turns = await request(app)
      .get(`/api/v1/simulations/${simId}/turns`)
      .set(auth)
      .expect(200);
    const [turn] = turns.body.turns;
    expect(turn.turnNumber).toBe(1);
    expect(turn.agentEffects.customer.source).toBe('llm');
    expect(Number.isInteger(turn.stateAfter.cash)).toBe(true);
    const analytics = await request(app)
      .get(`/api/v1/simulations/${simId}/analytics`)
      .set(auth)
      .expect(200);
    expect(analytics.body.currentTurn).toBe(1);
    expect(analytics.body.kpis.cash.value).toBe(turn.stateAfter.cash);

    // Ask the CEO.
    const advice = await request(app)
      .post(`/api/v1/simulations/${simId}/advice`)
      .set(auth)
      .send({ mode: 'EXPLAIN', question: 'Why did cash change?' })
      .expect(200);
    expect(advice.body).toMatchObject({ available: true, mode: 'EXPLAIN' });
    expect(advice.body.summary).toContain('Stub AI CEO');
  }, 120_000);
});
