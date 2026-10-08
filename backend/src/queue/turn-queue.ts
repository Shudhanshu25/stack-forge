import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export const TURN_QUEUE = 'turns';

export interface TurnJobData {
  jobId: string;
}

/** Schedules turn jobs for the worker. Job status itself lives in MongoDB. */
export interface TurnQueue {
  enqueue(jobId: string): Promise<void>;
  /** Removes a job that has not started. Returns false if the worker already has it. */
  removeIfWaiting(jobId: string): Promise<boolean>;
  close(): Promise<void>;
}

/** BullMQ waits for Redis to reconnect indefinitely; a request must not. */
const ENQUEUE_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Redis did not respond in time')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class BullTurnQueue implements TurnQueue {
  private readonly queue: Queue<TurnJobData>;

  constructor(
    connection: Redis,
    private readonly timeoutMs = ENQUEUE_TIMEOUT_MS,
  ) {
    this.queue = new Queue<TurnJobData>(TURN_QUEUE, {
      connection,
      defaultJobOptions: {
        // The processor marks expected failures (rejected decisions, engine down) FAILED
        // itself and returns; only infrastructure errors (MongoDB down) throw and are retried.
        attempts: 4,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  async enqueue(jobId: string): Promise<void> {
    // The MongoDB job id doubles as the BullMQ id, so enqueuing twice is a no-op.
    await withTimeout(this.queue.add('turn', { jobId }, { jobId }), this.timeoutMs);
  }

  async removeIfWaiting(jobId: string): Promise<boolean> {
    const job = await withTimeout(this.queue.getJob(jobId), this.timeoutMs);
    if (!job) return true;
    const state = await job.getState();
    if (state !== 'waiting' && state !== 'delayed' && state !== 'prioritized') return false;
    try {
      await job.remove();
      return true;
    } catch {
      return false; // picked up by a worker in the meantime
    }
  }

  /**
   * Puts a job back on the queue: retries it if BullMQ gave up on it, adds it if Redis no
   * longer has it, and leaves it alone if it is waiting or running.
   */
  async requeue(jobId: string): Promise<'retried' | 'added' | 'present'> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      await this.enqueue(jobId);
      return 'added';
    }
    const state = await job.getState();
    if (state === 'failed') {
      await job.retry();
      return 'retried';
    }
    if (state === 'completed') {
      await job.remove();
      await this.enqueue(jobId);
      return 'added';
    }
    return 'present';
  }

  /** Jobs per state, for the queue-depth metric. */
  async counts(): Promise<Record<string, number>> {
    return withTimeout(
      this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed'),
      this.timeoutMs,
    );
  }

  async has(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;
    const state = await job.getState();
    return state !== 'completed' && state !== 'failed' && state !== 'unknown';
  }

  /** Resolves once the Redis connection is usable. */
  async ready(): Promise<void> {
    await this.queue.waitUntilReady();
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}
