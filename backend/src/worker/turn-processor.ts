import { isDeepStrictEqual } from 'node:util';
import { SpanKind } from '@opentelemetry/api';
import type { Logger } from 'pino';
import type {
  AgentMode,
  Decision,
  JobError,
  SimulationState,
  SimulationTurn,
  StartupConfiguration,
} from '@stackforge/shared';
import { check } from '../contracts.js';
import { EngineError, type EngineClient } from '../engine/engine-client.js';
import { isDatabaseUnavailable } from '../http/error-handler.js';
import { LlmUsageService, startupProfile } from '../modules/llm/llm-usage.service.js';
import { finishJob, publishJob } from '../modules/simulations/job-lifecycle.js';
import { JobModel, type JobDoc } from '../modules/simulations/job.model.js';
import { SimulationModel } from '../modules/simulations/simulation.model.js';
import { TurnModel } from '../modules/simulations/turn.model.js';
import { recentSummaries } from '../modules/simulations/turn-summary.js';
import { jobDuration } from '../observability/metrics.js';
import { reportError } from '../observability/sentry.js';
import { activeTraceId, contextFrom, inSpan } from '../observability/tracing.js';
import type { EventBus } from '../queue/event-bus.js';

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

/**
 * Runs one turn job: claims it, streams the Python pipeline, relays each stage, and appends the
 * turn record. Idempotent, so a job retried after a crash finishes cleanly. A failure leaves the
 * simulation at its previous turn because the record is only written at the very end.
 */
export class TurnProcessor {
  constructor(
    private readonly engine: EngineClient,
    private readonly bus: EventBus,
    private readonly logger: Logger,
    private readonly usage: LlmUsageService = new LlmUsageService(0),
  ) {}

  async process(jobId: string): Promise<void> {
    const job = await this.claim(jobId);
    if (!job) return;
    const timer = jobDuration.startTimer();
    // Continues the trace of the API request that queued the turn.
    await inSpan(
      'turn.job',
      {
        'stackforge.job_id': jobId,
        'stackforge.simulation_id': job.simulationId.toString(),
        'stackforge.turn': job.turnNumber,
      },
      () => this.run(jobId, job),
      contextFrom(job.traceContext),
      SpanKind.CONSUMER,
    ).finally(async () => {
      const final = await JobModel.findById(jobId)
        .select('status')
        .lean()
        .catch(() => null);
      timer({ outcome: final?.status?.toLowerCase() ?? 'unrecorded' });
    });
  }

  private async run(jobId: string, job: JobDoc): Promise<void> {
    const simulationId = job.simulationId.toString();
    const log = this.logger.child({
      jobId,
      simulationId,
      turn: job.turnNumber,
      userId: job.ownerId.toString(),
    });

    try {
      const sim = await SimulationModel.findById(job.simulationId);
      if (!sim)
        return void (await this.fail(jobId, 'SIMULATION_NOT_FOUND', 'Simulation was deleted'));
      log.info({ engineVersion: sim.engineVersion }, 'turn started');

      // Retried after the record was written but before the job was marked done.
      if (await TurnModel.exists({ simulationId: sim._id, turnNumber: job.turnNumber })) {
        await this.complete(jobId, simulationId, job.turnNumber);
        return;
      }

      const previous = await TurnModel.findOne({ simulationId: sim._id })
        .sort({ turnNumber: -1 })
        .lean();
      const lastTurn = previous?.turnNumber ?? 0;
      if (lastTurn !== job.turnNumber - 1) {
        return void (await this.fail(
          jobId,
          'TURN_OUT_OF_ORDER',
          `Expected turn ${lastTurn + 1}, job is for turn ${job.turnNumber}`,
        ));
      }
      const state = previous
        ? (previous.record as SimulationTurn).stateAfter
        : (sim.initialState as SimulationState);

      const outcome = await this.engine.runTurn(
        {
          state,
          decisions: job.decisions as Decision[],
          configuration: sim.configuration as StartupConfiguration,
          seed: sim.seed,
          turnNumber: job.turnNumber,
          agentMode: sim.agentMode as AgentMode,
          engineVersion: sim.engineVersion,
          memory: await recentSummaries(sim._id, job.turnNumber),
          startupProfile: await startupProfile(sim.startupId),
          tokenAllowance: await this.usage.allowance(job.ownerId.toString()),
        },
        async ({ stage, progress }) => {
          await JobModel.updateOne({ _id: jobId }, { $set: { stage, progress } });
          await this.bus.publish({
            type: 'stage',
            simulationId,
            jobId,
            turnNumber: job.turnNumber,
            stage,
            progress,
          });
        },
        jobId,
      );

      if (await this.cancelRequested(jobId)) {
        log.info('turn cancelled before its record was written');
        await finishJob(this.bus, jobId, 'CANCELLED');
        return;
      }
      if ('error' in outcome) {
        log.info({ code: outcome.error.code }, 'turn rejected by the pipeline');
        await this.fail(jobId, outcome.error.code, outcome.error.message, outcome.error.details);
        return;
      }

      const record = outcome.record;
      const issues = check('simulation-turn.schema.json', record);
      if (
        issues ||
        record.turnNumber !== job.turnNumber ||
        !isDeepStrictEqual(record.stateBefore, state)
      ) {
        log.error({ issues }, 'pipeline returned an inconsistent turn record');
        await this.fail(
          jobId,
          'ENGINE_CONTRACT_VIOLATION',
          'The engine returned an invalid turn record',
        );
        return;
      }

      try {
        await TurnModel.create({
          simulationId: sim._id,
          ownerId: sim.ownerId,
          turnNumber: record.turnNumber,
          record,
        });
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
      }
      await this.usage.record(
        sim.ownerId,
        sim._id,
        record.turnNumber,
        record.llmUsage?.calls,
        `turn:${simulationId}:${record.turnNumber}`,
      );
      await SimulationModel.updateOne(
        { _id: sim._id },
        {
          $max: { currentTurn: record.turnNumber },
          $set: { status: record.stateAfter.cash < 0 ? 'BANKRUPT' : 'ACTIVE' },
        },
      );
      await this.complete(jobId, simulationId, job.turnNumber);
      log.info(
        { cash: record.stateAfter.cash, customers: record.stateAfter.customers },
        'turn completed',
      );
    } catch (err) {
      log.error({ err }, 'turn failed');
      if (!(err instanceof EngineError)) {
        reportError(err, {
          jobId,
          simulationId,
          userId: job.ownerId.toString(),
          traceId: activeTraceId(),
        });
      }
      const [code, message] =
        err instanceof EngineError
          ? [err.code, err.message]
          : isDatabaseUnavailable(err)
            ? ['DATABASE_UNAVAILABLE', 'The database was unavailable; the turn was not saved']
            : ['INTERNAL_ERROR', 'The turn failed unexpectedly'];
      await this.fail(jobId, code, message).catch(() => {
        throw err; // MongoDB is down too: BullMQ retries the job, and reconcile revives it later.
      });
    }
  }

  /** QUEUED -> RUNNING. A RUNNING job is resumed (worker crashed mid-turn). */
  private async claim(jobId: string) {
    const claimed = await JobModel.findOneAndUpdate(
      { _id: jobId, status: 'QUEUED' },
      { $set: { status: 'RUNNING', startedAt: new Date() } },
      { new: true },
    );
    if (claimed) {
      await publishJob(this.bus, claimed);
      return claimed;
    }
    return JobModel.findOne({ _id: jobId, status: 'RUNNING' });
  }

  private async cancelRequested(jobId: string): Promise<boolean> {
    return Boolean(await JobModel.exists({ _id: jobId, cancelRequested: true }));
  }

  private async complete(jobId: string, simulationId: string, turnNumber: number): Promise<void> {
    await this.bus.publish({
      type: 'stage',
      simulationId,
      jobId,
      turnNumber,
      stage: 'COMPLETE',
      progress: 100,
    });
    await finishJob(this.bus, jobId, 'COMPLETED', null, { progress: 100, stage: 'COMPLETE' });
  }

  private async fail(
    jobId: string,
    code: string,
    message: string,
    details?: unknown,
  ): Promise<void> {
    const error: JobError =
      details === undefined || details === null ? { code, message } : { code, message, details };
    await finishJob(this.bus, jobId, 'FAILED', error);
  }
}
