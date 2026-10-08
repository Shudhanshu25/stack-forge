// Turn worker: runs queued turn jobs against the simulation service. Start with `npm run worker`.
import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { loadConfig } from './config.js';
import { connectMongo, createBullConnection, createRedis, createSubscriberRedis } from './db.js';
import { HttpEngineClient } from './engine/engine-client.js';
import { createLogger } from './logger.js';
import { serveMetrics } from './observability/metrics.js';
import { initSentry } from './observability/sentry.js';
import { initTracing } from './observability/tracing.js';
import { LlmUsageService } from './modules/llm/llm-usage.service.js';
import { JobModel } from './modules/simulations/job.model.js';
import { RedisEventBus } from './queue/event-bus.js';
import { BullTurnQueue, TURN_QUEUE, type TurnJobData } from './queue/turn-queue.js';
import { TurnProcessor } from './worker/turn-processor.js';

const config = loadConfig();
const logger = createLogger(config.logLevel, 'worker');
const tracing = initTracing('stackforge-worker');
initSentry('worker');
const metricsServer = serveMetrics(config.workerMetricsPort, (err) =>
  logger.warn({ err: err.message, port: config.workerMetricsPort }, 'metrics endpoint unavailable'),
);

await connectMongo(config.mongodbUri, logger, { waitForFirstConnection: true });
const publisher = createRedis(config.redisUrl, logger);
const bus = new RedisEventBus(publisher, () => createSubscriberRedis(config.redisUrl));
const engine = new HttpEngineClient(
  config.simulationUrl,
  config.engineTimeoutMs,
  config.pipelineTimeoutMs,
);
const processor = new TurnProcessor(
  engine,
  bus,
  logger,
  new LlmUsageService(config.llmUserDailyTokenQuota),
);

const worker = new Worker<TurnJobData>(
  TURN_QUEUE,
  async (job) => processor.process(job.data.jobId),
  { connection: createBullConnection(config.redisUrl), concurrency: config.workerConcurrency },
);
worker.on('error', (err) => logger.warn({ err: err.message }, 'worker connection error'));
worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'job crashed'));

/**
 * Jobs MongoDB still considers active but the queue no longer runs (Redis lost them, or BullMQ
 * gave up after MongoDB was down) would block their simulation; put them back. The processor
 * is idempotent, so a job that already wrote its turn just completes.
 */
const reconcileQueue = new BullTurnQueue(createBullConnection(config.redisUrl, { failFast: true }));
async function reconcile(): Promise<void> {
  const active = await JobModel.find({
    status: mongoose.trusted({ $in: ['QUEUED', 'RUNNING'] }),
  }).select('_id');
  for (const job of active) {
    const id = job.id as string;
    const outcome = await reconcileQueue.requeue(id);
    if (outcome !== 'present') logger.info({ jobId: id, outcome }, 'requeued stalled job');
  }
}
const RECONCILE_MS = 60_000;
await reconcile().catch((err: unknown) => logger.warn({ err: String(err) }, 'reconcile skipped'));
const reconcileTimer = setInterval(() => {
  reconcile().catch((err: unknown) => logger.warn({ err: String(err) }, 'reconcile skipped'));
}, RECONCILE_MS);
logger.info({ concurrency: config.workerConcurrency }, 'worker ready');

async function shutdown(signal: string) {
  logger.info({ signal }, 'worker shutting down');
  // close() waits for running jobs to finish.
  clearInterval(reconcileTimer);
  metricsServer.close();
  await Promise.allSettled([
    worker.close(),
    publisher.quit(),
    reconcileQueue.close(),
    tracing?.shutdown(),
  ]);
  await mongoose.disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
