import { Redis } from 'ioredis';
import mongoose from 'mongoose';
import type { Logger } from 'pino';

// Second layer against operator injection: filters passed to queries are sanitised, so
// server-side operators in filters ($in, $gt) must be wrapped in mongoose.trusted().
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);
// While MongoDB is unreachable, queries fail after 2.5 s (mapped to 503 SERVICE_UNAVAILABLE)
// instead of hanging for Mongoose's default 10 s.
mongoose.set('bufferTimeoutMS', 2500);
// In production indexes are built by migrations (npm run migrate), not on every start.
mongoose.set('autoIndex', process.env.NODE_ENV !== 'production');

/**
 * Connects to MongoDB, retrying every 5s while it is down so the API can start (and report the
 * outage). With waitForFirstConnection the promise resolves only once connected (the worker
 * cannot do anything useful before that).
 */
export function connectMongo(
  uri: string,
  logger: Logger,
  { waitForFirstConnection = false } = {},
): Promise<void> {
  return new Promise((resolve) => {
    const attempt = async (): Promise<void> => {
      try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
        logger.info('mongodb connected');
        resolve();
      } catch (err) {
        logger.warn({ err: (err as Error).message }, 'mongodb unavailable, retrying in 5s');
        const retry = setTimeout(() => void attempt(), 5000);
        // A caller waiting for the first connection (the worker) must stay alive meanwhile.
        if (!waitForFirstConnection) retry.unref();
      }
    };
    void attempt();
    if (!waitForFirstConnection) resolve();
  });
}

export async function pingMongo(): Promise<void> {
  const db = mongoose.connection.db;
  if (mongoose.connection.readyState !== 1 || !db) throw new Error('mongodb not connected');
  await db.admin().ping();
}

/** General-purpose client (health checks, pub/sub). Fails fast while Redis is down. */
export function createRedis(url: string, logger: Logger): Redis {
  const redis = new Redis(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  let reported = false;
  redis.on('ready', () => {
    reported = false;
    logger.info('redis connected');
  });
  redis.on('error', (err) => {
    if (!reported) logger.warn({ err: err.message }, 'redis unavailable, retrying');
    reported = true;
  });
  return redis;
}

/**
 * Pub/sub subscriber. Unlike createRedis it queues commands while disconnected, so subscribing
 * at startup waits for Redis instead of failing, and ioredis re-subscribes after reconnects.
 */
export function createSubscriberRedis(url: string): Redis {
  const redis = new Redis(url, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  redis.on('error', () => {
    // Reconnects automatically; outages show in /health/services.
  });
  return redis;
}

/**
 * Connection for BullMQ. Workers need maxRetriesPerRequest null so they block and resume across
 * Redis restarts; the API's queue uses failFast so enqueuing fails immediately when Redis is
 * down instead of hanging the request.
 */
export function createBullConnection(url: string, { failFast = false } = {}): Redis {
  const redis = new Redis(url, {
    maxRetriesPerRequest: failFast ? 1 : null,
    enableOfflineQueue: !failFast,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  redis.on('error', () => {
    // Reported through health checks and job failures; avoid one log line per retry.
  });
  return redis;
}
