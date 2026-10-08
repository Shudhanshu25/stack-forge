import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import type { SimulationJob } from '@stackforge/shared';

export const ACTIVE_STATUSES = ['QUEUED', 'RUNNING'] as const;

/**
 * A turn job. MongoDB is the source of truth for job status; BullMQ only schedules execution.
 * `activeLock` is true while the job is QUEUED or RUNNING and removed when it finishes; the
 * partial unique index on it allows at most one active job per simulation.
 */
const jobSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    simulationId: { type: Schema.Types.ObjectId, ref: 'Simulation', required: true, index: true },
    turnNumber: { type: Number, required: true },
    decisions: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'QUEUED',
      required: true,
    },
    progress: { type: Number, default: 0 },
    stage: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    error: { type: Schema.Types.Mixed, default: null },
    cancelRequested: { type: Boolean, default: false },
    activeLock: { type: Boolean },
    /** W3C trace context of the request that queued the job, so the worker continues its trace. */
    traceContext: { type: Schema.Types.Mixed, default: null },
    /** Client-supplied Idempotency-Key of the request that created the job, if any. */
    idempotencyKey: { type: String },
  },
  { timestamps: true, minimize: false },
);

jobSchema.index(
  { simulationId: 1 },
  {
    name: 'one_active_job_per_simulation',
    unique: true,
    partialFilterExpression: { activeLock: true },
  },
);

// Worker reconciliation (QUEUED/RUNNING) and the admin failed-job count.
jobSchema.index({ status: 1 });

// A repeated Idempotency-Key for the same simulation finds the original job.
jobSchema.index(
  { ownerId: 1, simulationId: 1, idempotencyKey: 1 },
  {
    name: 'idempotency_key_per_simulation',
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);

export type JobDoc = HydratedDocument<InferSchemaType<typeof jobSchema>>;
export const JobModel = model('Job', jobSchema);

export function toJobDto(job: JobDoc): SimulationJob {
  return {
    jobId: job.id as string,
    simulationId: job.simulationId.toString(),
    turnNumber: job.turnNumber,
    status: job.status as SimulationJob['status'],
    progress: job.progress ?? 0,
    stage: (job.stage as SimulationJob['stage']) ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    error: (job.error as SimulationJob['error']) ?? null,
    createdAt: job.createdAt.toISOString(),
  };
}
