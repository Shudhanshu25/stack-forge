/**
 * BullMQ against a real Redis. Runs only when TEST_REDIS_URL is set, e.g.
 *   TEST_REDIS_URL=redis://127.0.0.1:6379/15 npm test -w backend
 * The test flushes that database.
 */
import { Worker } from 'bullmq';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBullConnection, createRedis, createSubscriberRedis } from '../src/db.js';
import { createLogger } from '../src/logger.js';
import { JobModel } from '../src/modules/simulations/job.model.js';
import { RedisEventBus, type SimulationEvent } from '../src/queue/event-bus.js';
import { BullTurnQueue, TURN_QUEUE, type TurnJobData } from '../src/queue/turn-queue.js';
import { createApp } from '../src/app.js';
import { TurnProcessor } from '../src/worker/turn-processor.js';
import { FixtureEngine, authHeader, novaTech, register, testConfig } from './helpers.js';

const redisUrl = process.env.TEST_REDIS_URL;

describe.skipIf(!redisUrl)('BullMQ turn queue', () => {
  const logger = createLogger('silent');
  let queue: BullTurnQueue;
  let bus: RedisEventBus;
  let publisher: ReturnType<typeof createRedis>;

  beforeAll(async () => {
    publisher = createRedis(redisUrl!, logger);
    // Fail-fast connections have no offline queue: wait until they are connected.
    await new Promise((resolve) => publisher.once('ready', resolve));
    await publisher.flushdb();
    queue = new BullTurnQueue(createBullConnection(redisUrl!, { failFast: true }));
    await queue.ready();
    bus = new RedisEventBus(publisher, () => createSubscriberRedis(redisUrl!));
  });

  afterAll(async () => {
    await queue?.close();
    await publisher?.quit();
  });

  it('runs a turn through the queue and relays events over pub/sub', async () => {
    const engine = new FixtureEngine();
    const app = createApp({
      config: testConfig(),
      logger,
      healthChecks: {
        mongodb: async () => {},
        redis: async () => {},
        simulationEngine: async () => {},
      },
      engine,
      queue,
      bus,
    });
    const received: SimulationEvent[] = [];
    const unsubscribe = await bus.subscribe((e) => received.push(e));

    const user = await register(app);
    const startup = await request(app)
      .post('/api/v1/startups')
      .set(authHeader(user))
      .send(novaTech);
    const sim = await request(app)
      .post(`/api/v1/startups/${startup.body.id}/simulation`)
      .set(authHeader(user))
      .send({ seed: 5 });

    // Queued while no worker runs: the job waits in Redis and can be cancelled.
    const first = await request(app)
      .post(`/api/v1/simulations/${sim.body.id}/turns`)
      .set(authHeader(user))
      .send({ decisions: [] })
      .expect(202);
    const cancelled = await request(app)
      .post(`/api/v1/jobs/${first.body.jobId}/cancel`)
      .set(authHeader(user))
      .expect(202);
    expect(cancelled.body.status).toBe('CANCELLED');

    const worker = new Worker<TurnJobData>(
      TURN_QUEUE,
      async (job) => new TurnProcessor(engine, bus, logger).process(job.data.jobId),
      { connection: createBullConnection(redisUrl!) },
    );
    const second = await request(app)
      .post(`/api/v1/simulations/${sim.body.id}/turns`)
      .set(authHeader(user))
      .send({ decisions: [] })
      .expect(202);

    const deadline = Date.now() + 10_000;
    while ((await JobModel.findById(second.body.jobId))!.status !== 'COMPLETED') {
      if (Date.now() > deadline) throw new Error('job did not complete');
      await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise((r) => setTimeout(r, 100));
    const stages = received
      .filter((e) => e.type === 'stage' && e.jobId === second.body.jobId)
      .map((e) => e.stage);
    expect(stages).toEqual(['PROCESSING_DECISION', 'UPDATING_FINANCIAL_MODEL', 'COMPLETE']);

    await worker.close();
    await unsubscribe();
  }, 20_000);
});
