/**
 * Reliability: each infrastructure failure gives the user a clear error and never leaves a
 * partial turn. LLM timeout and ML-model failure are handled inside the simulation service
 * (see simulation/tests/test_pipeline_llm.py and test_advisor_and_forecast.py).
 */
import { spawn } from 'node:child_process';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createBullConnection } from '../src/db.js';
import { HttpEngineClient } from '../src/engine/engine-client.js';
import { createLogger } from '../src/logger.js';
import { JobModel } from '../src/modules/simulations/job.model.js';
import { QUEUE_STALL_MS } from '../src/modules/simulations/job.service.js';
import { SimulationModel } from '../src/modules/simulations/simulation.model.js';
import { TurnModel } from '../src/modules/simulations/turn.model.js';
import { StartupModel } from '../src/modules/startups/startup.model.js';
import { MemoryEventBus } from '../src/queue/event-bus.js';
import { BullTurnQueue } from '../src/queue/turn-queue.js';
import { TurnProcessor } from '../src/worker/turn-processor.js';
import {
  FixtureEngine,
  InlineQueue,
  authHeader,
  fixture,
  harness,
  novaTech,
  register,
  testConfig,
} from './helpers.js';

const up = async () => undefined;
const DEAD_ENGINE = 'http://127.0.0.1:9';

afterEach(() => {
  vi.restoreAllMocks();
});

function appWith(parts: { engine?: unknown; queue?: unknown }) {
  return createApp({
    config: testConfig(),
    logger: createLogger('silent'),
    healthChecks: { mongodb: up, redis: up, simulationEngine: up },
    engine: (parts.engine ?? new FixtureEngine()) as FixtureEngine,
    queue: (parts.queue ?? new InlineQueue()) as InlineQueue,
    bus: new MemoryEventBus(),
  });
}

/** A user with a startup and a simulation stored directly (no engine needed). */
async function seeded(app: ReturnType<typeof appWith>) {
  const user = await register(app);
  const startup = await StartupModel.create({
    ownerId: user.body.user.id,
    name: novaTech.name,
    product: novaTech.product,
    location: null,
    configuration: fixture.configuration,
  });
  const sim = await SimulationModel.create({
    ownerId: user.body.user.id,
    startupId: startup.id,
    seed: fixture.seed,
    agentMode: 'rules',
    engineVersion: fixture.engineVersion,
    configuration: fixture.configuration,
    initialState: fixture.initialState,
  });
  return { user, startupId: startup.id as string, simulationId: sim.id as string };
}

describe('FastAPI unavailable', () => {
  const engine = new HttpEngineClient(DEAD_ENGINE, 500, 500);

  it('starting a simulation or previewing returns 503 with a clear message', async () => {
    const app = appWith({ engine });
    const { user, startupId, simulationId } = await seeded(app);
    const start = await request(app)
      .post(`/api/v1/startups/${startupId}/simulation`)
      .set(authHeader(user))
      .send({})
      .expect(503);
    expect(start.body.error).toMatchObject({
      code: 'SIMULATION_ENGINE_UNAVAILABLE',
      message: 'The simulation engine is unavailable',
    });
    expect(await SimulationModel.countDocuments({ startupId })).toBe(1); // only the seeded one
    const preview = await request(app)
      .post(`/api/v1/simulations/${simulationId}/preview`)
      .set(authHeader(user))
      .send({ decisions: [] })
      .expect(503);
    expect(preview.body.error.code).toBe('SIMULATION_ENGINE_UNAVAILABLE');
  });

  it('a turn fails with ENGINE_UNAVAILABLE and writes nothing', async () => {
    const queue = new InlineQueue();
    const app = appWith({ engine, queue });
    const { user, simulationId } = await seeded(app);
    const { jobId } = (
      await request(app)
        .post(`/api/v1/simulations/${simulationId}/turns`)
        .set(authHeader(user))
        .send({ decisions: [] })
        .expect(202)
    ).body;
    await new TurnProcessor(engine, new MemoryEventBus(), createLogger('silent')).process(jobId);
    const job = await request(app).get(`/api/v1/jobs/${jobId}`).set(authHeader(user));
    expect(job.body).toMatchObject({
      status: 'FAILED',
      error: { code: 'ENGINE_UNAVAILABLE', message: 'The simulation engine is unavailable' },
    });
    expect(await TurnModel.countDocuments({ simulationId })).toBe(0);
    const sim = await request(app).get(`/api/v1/simulations/${simulationId}`).set(authHeader(user));
    expect(sim.body).toMatchObject({ currentTurn: 0, activeJobId: null });
  });
});

describe('Redis unavailable', () => {
  it('playing a turn returns 503, releases the lock and writes nothing', async () => {
    const queue = new BullTurnQueue(
      createBullConnection('redis://127.0.0.1:1', { failFast: true }),
    );
    try {
      const app = appWith({ queue });
      const { user, simulationId } = await seeded(app);
      const started = Date.now();
      const res = await request(app)
        .post(`/api/v1/simulations/${simulationId}/turns`)
        .set(authHeader(user))
        .send({ decisions: [] })
        .expect(503);
      expect(Date.now() - started).toBeLessThan(5000);
      expect(res.body.error).toMatchObject({
        code: 'QUEUE_UNAVAILABLE',
        message: 'The job queue is unavailable, try again shortly',
      });
      expect(await JobModel.countDocuments({ simulationId, activeLock: true })).toBe(0);
      expect(await TurnModel.countDocuments({ simulationId })).toBe(0);
    } finally {
      await queue.close().catch(() => {});
    }
  });
});

describe('Redis lost after a turn was queued', () => {
  const down = async () => {
    throw new Error('redis down');
  };

  async function queuedTurn(h: ReturnType<typeof harness>) {
    const { user, simulationId } = await seeded(h.app);
    const { jobId } = (
      await request(h.app)
        .post(`/api/v1/simulations/${simulationId}/turns`)
        .set(authHeader(user))
        .send({ decisions: [] })
        .expect(202)
    ).body;
    return { user, simulationId, jobId: jobId as string };
  }

  const age = (jobId: string, ms: number) =>
    JobModel.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(jobId) },
      { $set: { createdAt: new Date(Date.now() - ms) } },
    );

  it('a job stuck in the queue fails clearly instead of waiting forever', async () => {
    const h = harness({}, { redis: down });
    const { user, simulationId, jobId } = await queuedTurn(h);

    // Not stalled yet: still reported as queued.
    let job = await request(h.app).get(`/api/v1/jobs/${jobId}`).set(authHeader(user)).expect(200);
    expect(job.body.status).toBe('QUEUED');

    await age(jobId, QUEUE_STALL_MS + 1000);
    job = await request(h.app).get(`/api/v1/jobs/${jobId}`).set(authHeader(user)).expect(200);
    expect(job.body).toMatchObject({
      status: 'FAILED',
      error: {
        code: 'QUEUE_UNAVAILABLE',
        message: 'The job queue became unavailable before the turn started; nothing was changed',
      },
    });
    const sim = await request(h.app)
      .get(`/api/v1/simulations/${simulationId}`)
      .set(authHeader(user));
    expect(sim.body).toMatchObject({ currentTurn: 0, activeJobId: null });

    // If Redis comes back and delivers the job, the worker skips it: no turn is written.
    await h.drain();
    expect(await TurnModel.countDocuments({ simulationId })).toBe(0);
  });

  it('a long queue with Redis up is left alone', async () => {
    const h = harness();
    const { user, jobId } = await queuedTurn(h);
    await age(jobId, QUEUE_STALL_MS + 1000);
    const job = await request(h.app).get(`/api/v1/jobs/${jobId}`).set(authHeader(user)).expect(200);
    expect(job.body.status).toBe('QUEUED');
  });

  it('a queued job can still be cancelled while Redis is down', async () => {
    const h = harness();
    const { user, jobId } = await queuedTurn(h);
    vi.spyOn(h.queue, 'removeIfWaiting').mockRejectedValueOnce(new Error('Redis did not respond'));
    const res = await request(h.app)
      .post(`/api/v1/jobs/${jobId}/cancel`)
      .set(authHeader(user))
      .expect(202);
    expect(res.body.status).toBe('CANCELLED');
  });
});

describe('MongoDB unavailable', () => {
  it('a worker started while MongoDB is down waits for it instead of exiting', async () => {
    // Imports connectMongo the way worker.ts does and waits for a database that is not there.
    const script = [
      "import { connectMongo } from './src/db.ts';",
      "import { createLogger } from './src/logger.ts';",
      "await connectMongo('mongodb://127.0.0.1:1/x', createLogger('silent'), { waitForFirstConnection: true });",
    ].join(' ');
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', script],
      {
        cwd: process.cwd(),
        stdio: 'ignore',
      },
    );
    const exited = new Promise<number | null>((done) => child.once('exit', done));
    const outcome = await Promise.race([
      exited,
      new Promise<'alive'>((done) => setTimeout(() => done('alive'), 6000)),
    ]);
    child.kill();
    expect(outcome).toBe('alive');
  }, 15_000);

  it('requests fail fast with 503 SERVICE_UNAVAILABLE', async () => {
    const h = harness();
    const user = await register(h.app);
    await mongoose.disconnect();
    try {
      const started = Date.now();
      const res = await request(h.app).get('/api/v1/startups').set(authHeader(user)).expect(503);
      expect(Date.now() - started).toBeLessThan(5000);
      expect(res.body.error).toEqual({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database is unavailable, try again shortly',
        details: null,
      });
    } finally {
      await mongoose.connect(process.env.TEST_MONGO_URI!);
    }
  });

  it('a turn whose record cannot be saved fails clearly and leaves no partial turn', async () => {
    const h = harness();
    const { user, simulationId } = await seeded(h.app);
    const { jobId } = (
      await request(h.app)
        .post(`/api/v1/simulations/${simulationId}/turns`)
        .set(authHeader(user))
        .send({ decisions: [] })
    ).body;
    const networkError = Object.assign(new Error('connection reset'), {
      name: 'MongoNetworkError',
    });
    vi.spyOn(TurnModel, 'create').mockRejectedValueOnce(networkError);
    await h.drain();
    const job = await JobModel.findById(jobId);
    expect(job).toMatchObject({
      status: 'FAILED',
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The database was unavailable; the turn was not saved',
      },
    });
    expect(await TurnModel.countDocuments({ simulationId })).toBe(0);
  });

  it('when even the failure cannot be recorded, the job throws so BullMQ retries it', async () => {
    const h = harness();
    const { user, simulationId } = await seeded(h.app);
    const { jobId } = (
      await request(h.app)
        .post(`/api/v1/simulations/${simulationId}/turns`)
        .set(authHeader(user))
        .send({ decisions: [] })
    ).body;
    const down = Object.assign(new Error('connection reset'), { name: 'MongoNetworkError' });
    // The claim succeeds; saving the turn and every later write fail.
    const original = JobModel.findOneAndUpdate.bind(JobModel);
    let calls = 0;
    vi.spyOn(JobModel, 'findOneAndUpdate').mockImplementation(((
      ...args: Parameters<typeof original>
    ) => {
      calls += 1;
      if (calls === 1) return original(...args);
      throw down;
    }) as typeof JobModel.findOneAndUpdate);
    vi.spyOn(TurnModel, 'create').mockRejectedValueOnce(down);
    await expect(h.processor.process(jobId)).rejects.toThrow('connection reset');
    expect(await TurnModel.countDocuments({ simulationId })).toBe(0);
  });
});
