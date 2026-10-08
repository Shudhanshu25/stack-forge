import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { simulationOpenApiFrom } from './modules/docs/docs.routes.js';
import { loadConfig } from './config.js';
import {
  connectMongo,
  createBullConnection,
  createRedis,
  createSubscriberRedis,
  pingMongo,
} from './db.js';
import { HttpEngineClient } from './engine/engine-client.js';
import { createLogger } from './logger.js';
import { registerQueueDepth } from './observability/metrics.js';
import { initSentry } from './observability/sentry.js';
import { initTracing } from './observability/tracing.js';
import { TokenService } from './modules/auth/tokens.js';
import { simulationEngineCheck } from './modules/health/health.service.js';
import { RedisEventBus } from './queue/event-bus.js';
import { BullTurnQueue } from './queue/turn-queue.js';
import { SimulationSocketServer } from './ws/ws-server.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);
initTracing('stackforge-api');
initSentry('api');

void connectMongo(config.mongodbUri, logger);
const redis = createRedis(config.redisUrl, logger);
const queue = new BullTurnQueue(createBullConnection(config.redisUrl, { failFast: true }));
registerQueueDepth(() => queue.counts());
const bus = new RedisEventBus(redis, () => createSubscriberRedis(config.redisUrl));
const tokens = new TokenService(config);

const app = createApp({
  config,
  logger,
  tokens,
  simulationOpenApi: simulationOpenApiFrom(config.simulationUrl),
  healthChecks: {
    mongodb: pingMongo,
    redis: () => redis.ping(),
    simulationEngine: simulationEngineCheck(config.simulationUrl),
  },
  engine: new HttpEngineClient(
    config.simulationUrl,
    config.engineTimeoutMs,
    config.pipelineTimeoutMs,
  ),
  queue,
  bus,
});

const server = createServer(app);
const sockets = new SimulationSocketServer(server, tokens, bus, config.corsOrigin, logger);
void sockets.start().catch((err: unknown) => logger.warn({ err }, 'event relay not started'));

server.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'api listening');
});

function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  void sockets.close();
  server.close(() => {
    void Promise.allSettled([mongoose.disconnect(), redis.quit(), queue.close()]).then(() =>
      process.exit(0),
    );
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
