import mongoose, { isValidObjectId } from 'mongoose';
import type { Decision, SimulationJob } from '@stackforge/shared';
import { AppError, notFound } from '../../errors.js';
import { traceHeaders } from '../../observability/tracing.js';
import type { EventBus } from '../../queue/event-bus.js';
import type { TurnQueue } from '../../queue/turn-queue.js';
import { finishJob, publishJob } from './job-lifecycle.js';
import { JobModel, toJobDto, type JobDoc } from './job.model.js';
import { SimulationModel } from './simulation.model.js';
import { assertActive, type SimulationService } from './simulation.service.js';

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;
const duplicateIndex = (err: unknown) =>
  (err as { message?: string })?.message?.includes('idempotency_key_per_simulation')
    ? 'idempotency'
    : 'active';

/** The result of submitting a turn: the job, and whether it was created by an earlier request. */
export interface TurnSubmission {
  job: SimulationJob;
  replayed: boolean;
}

const sameDecisions = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A job still QUEUED this long while Redis is unreachable is failed instead of left waiting. */
export const QUEUE_STALL_MS = 15_000;

/** Resolves true when the queue's Redis answers. */
export type QueueCheck = () => Promise<boolean>;

export class JobService {
  constructor(
    private readonly simulations: SimulationService,
    private readonly queue: TurnQueue,
    private readonly bus: EventBus,
    private readonly queueReachable: QueueCheck = async () => true,
  ) {}

  private async findOwned(ownerId: string, id: string): Promise<JobDoc> {
    if (!isValidObjectId(id)) throw notFound('Job');
    const job = await JobModel.findOne({ _id: id, ownerId });
    if (!job) throw notFound('Job');
    return job;
  }

  async get(ownerId: string, id: string): Promise<SimulationJob> {
    const job = await this.findOwned(ownerId, id);
    return toJobDto((await this.failIfQueueLost(job)) ?? job);
  }

  /**
   * Redis went down after the job was queued: the worker cannot see it, so rather than leaving
   * it "queued" indefinitely, fail it clearly. Nothing was written; if Redis comes back the
   * worker skips the job, since it only claims QUEUED jobs.
   */
  private async failIfQueueLost(job: JobDoc): Promise<JobDoc | null> {
    if (job.status !== 'QUEUED' || Date.now() - job.createdAt.getTime() < QUEUE_STALL_MS) {
      return null;
    }
    if (await this.queueReachable()) return null;
    return finishJob(this.bus, job.id as string, 'FAILED', {
      code: 'QUEUE_UNAVAILABLE',
      message: 'The job queue became unavailable before the turn started; nothing was changed',
    });
  }

  /**
   * Creates and enqueues the next turn. At most one job per simulation may be active. With an
   * idempotency key, a repeated request returns the job the first one created instead of
   * playing another turn; reusing the key with different decisions is rejected.
   */
  async enqueueTurn(
    ownerId: string,
    simulationId: string,
    decisions: Decision[],
    idempotencyKey?: string,
  ): Promise<TurnSubmission> {
    const sim = await this.simulations.findOwned(ownerId, simulationId);
    if (idempotencyKey) {
      const previous = await this.byIdempotencyKey(ownerId, sim._id, idempotencyKey, decisions);
      if (previous) return previous;
    }
    assertActive(sim);

    let job: JobDoc;
    try {
      job = await JobModel.create({
        ownerId,
        simulationId: sim._id,
        turnNumber: sim.currentTurn + 1,
        decisions,
        activeLock: true,
        traceContext: traceHeaders(),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      });
    } catch (err) {
      if (isDuplicateKey(err) && idempotencyKey && duplicateIndex(err) === 'idempotency') {
        // A concurrent request with the same key won the race.
        const previous = await this.byIdempotencyKey(ownerId, sim._id, idempotencyKey, decisions);
        if (previous) return previous;
      }
      if (isDuplicateKey(err)) {
        throw new AppError(409, 'TURN_IN_PROGRESS', 'A turn is already queued or running', {
          activeJobId: sim.activeJobId,
        });
      }
      throw err;
    }
    await SimulationModel.updateOne({ _id: sim._id }, { $set: { activeJobId: job.id } });

    try {
      await this.queue.enqueue(job.id as string);
    } catch {
      await finishJob(this.bus, job.id as string, 'FAILED', {
        code: 'QUEUE_UNAVAILABLE',
        message: 'The job queue is unavailable; the turn was not started',
      });
      throw new AppError(
        503,
        'QUEUE_UNAVAILABLE',
        'The job queue is unavailable, try again shortly',
      );
    }
    await publishJob(this.bus, job);
    return { job: toJobDto(job), replayed: false };
  }

  private async byIdempotencyKey(
    ownerId: string,
    simulationId: unknown,
    key: string,
    decisions: Decision[],
  ): Promise<TurnSubmission | null> {
    const job = await JobModel.findOne({ ownerId, simulationId, idempotencyKey: key });
    if (!job) return null;
    if (!sameDecisions(job.decisions, decisions)) {
      throw new AppError(
        422,
        'IDEMPOTENCY_KEY_REUSED',
        'This Idempotency-Key was already used with different decisions',
      );
    }
    return { job: toJobDto((await this.failIfQueueLost(job)) ?? job), replayed: true };
  }

  /**
   * Cancels a job. A queued job is removed and cancelled at once; a running job is flagged and
   * the worker stops before writing the turn. Finished jobs cannot be cancelled.
   */
  async cancel(ownerId: string, id: string): Promise<SimulationJob> {
    const job = await this.findOwned(ownerId, id);
    if (job.status !== 'QUEUED' && job.status !== 'RUNNING') {
      throw new AppError(409, 'JOB_FINISHED', `The job is already ${job.status.toLowerCase()}`);
    }
    // With Redis down a queued job cannot start, so it can be cancelled without asking Redis.
    const removable =
      job.status === 'QUEUED' &&
      (await this.queue.removeIfWaiting(job.id as string).catch(() => true));
    if (removable) {
      const cancelled = await finishJob(this.bus, job.id as string, 'CANCELLED');
      if (cancelled) return toJobDto(cancelled);
    }
    // Running (or picked up while we looked): ask the worker to stop.
    const flagged = await JobModel.findOneAndUpdate(
      { _id: job._id, status: mongoose.trusted({ $in: ['QUEUED', 'RUNNING'] }) },
      { $set: { cancelRequested: true } },
      { new: true },
    );
    return toJobDto(flagged ?? (await this.findOwned(ownerId, id)));
  }
}
