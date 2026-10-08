import mongoose from 'mongoose';
import type { JobError, JobStatus, PipelineStage } from '@stackforge/shared';
import type { EventBus } from '../../queue/event-bus.js';
import { JobModel, toJobDto, type JobDoc } from './job.model.js';
import { SimulationModel } from './simulation.model.js';

type FinalStatus = Extract<JobStatus, 'COMPLETED' | 'FAILED' | 'CANCELLED'>;

/**
 * Moves an active job to a final status, releases the one-active-job lock and clears the
 * simulation's activeJobId. Only succeeds from QUEUED or RUNNING, so it is safe to call twice.
 */
export async function finishJob(
  bus: EventBus,
  jobId: string,
  status: FinalStatus,
  error: JobError | null = null,
  extra: { progress?: number; stage?: PipelineStage | null } = {},
): Promise<JobDoc | null> {
  const job = await JobModel.findOneAndUpdate(
    { _id: jobId, status: mongoose.trusted({ $in: ['QUEUED', 'RUNNING'] }) },
    {
      $set: { status, error, completedAt: new Date(), ...extra },
      $unset: { activeLock: 1 },
    },
    { new: true },
  );
  if (!job) return null;
  await SimulationModel.updateOne(
    { _id: job.simulationId, activeJobId: jobId },
    { $set: { activeJobId: null } },
  );
  await publishJob(bus, job);
  return job;
}

export async function publishJob(bus: EventBus, job: JobDoc): Promise<void> {
  await bus.publish({
    type: 'job',
    simulationId: job.simulationId.toString(),
    jobId: job.id as string,
    turnNumber: job.turnNumber,
    job: toJobDto(job),
  });
}
