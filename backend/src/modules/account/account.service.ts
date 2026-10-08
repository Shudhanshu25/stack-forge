import mongoose from 'mongoose';
import type {
  AccountDeleteRequest,
  AdviceRecord,
  AIAdvice,
  DataExport,
  Session,
} from '@stackforge/shared';
import { AppError, notFound } from '../../errors.js';
import type { EventBus } from '../../queue/event-bus.js';
import type { TurnQueue } from '../../queue/turn-queue.js';
import { metricCounts, recordDeletedCounts } from '../admin/admin.service.js';
import { ActionTokenModel } from '../auth/action-token.model.js';
import { OtpCodeModel } from '../auth/otp-code.model.js';
import { verifyPassword } from '../auth/password.js';
import { RefreshTokenModel } from '../auth/refresh-token.model.js';
import { UserModel, toUserDto } from '../auth/user.model.js';
import { LlmUsageModel, toUsageRecord } from '../llm/llm-usage.model.js';
import { AdviceModel } from '../simulations/advice.model.js';
import { finishJob } from '../simulations/job-lifecycle.js';
import { ACTIVE_STATUSES, JobModel } from '../simulations/job.model.js';
import type { SimulationService } from '../simulations/simulation.service.js';
import { SimulationModel } from '../simulations/simulation.model.js';
import { TurnModel, toTurnDto } from '../simulations/turn.model.js';
import { StartupModel, toStartupDto } from '../startups/startup.model.js';

/** The user's rights over their data: a complete export, and deletion. */
export class AccountService {
  constructor(
    private readonly simulations: SimulationService,
    private readonly queue: TurnQueue,
    private readonly bus: EventBus,
  ) {}

  /** Everything stored about the user. Secrets (password and token hashes) are never included. */
  async export(userId: string, sessions: Session[]): Promise<DataExport> {
    const user = await UserModel.findById(userId);
    if (!user) throw notFound('User');
    const ownerId = user._id;
    const [startups, sims, turns, advice, usage] = await Promise.all([
      StartupModel.find({ ownerId }).sort({ createdAt: 1 }),
      SimulationModel.find({ ownerId }).sort({ createdAt: 1 }),
      TurnModel.find({ ownerId }).sort({ simulationId: 1, turnNumber: 1 }).lean(),
      AdviceModel.find({ ownerId }).sort({ createdAt: 1 }).lean(),
      LlmUsageModel.find({ userId: ownerId }).sort({ createdAt: 1 }),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      user: toUserDto(user),
      startups: startups.map(toStartupDto),
      simulations: await Promise.all(sims.map((s) => this.simulations.toDto(s))),
      turns: turns.map(toTurnDto),
      advice: advice.map((a): AdviceRecord => ({
        simulationId: a.simulationId.toString(),
        turnNumber: a.turnNumber,
        mode: a.mode as AdviceRecord['mode'],
        question: a.question ?? null,
        advice: a.advice as AIAdvice,
        createdAt: a.createdAt.toISOString(),
      })),
      sessions,
      llmUsage: usage.map(toUsageRecord),
    };
  }

  /**
   * Deletes the account and everything it owns, after confirming the password (if it has
   * one). Running turns are cancelled first. The user's contribution to admin metrics is kept
   * as anonymous counts, and LLM usage rows lose their user and simulation. The user document
   * goes last, so an interrupted deletion can simply be repeated.
   */
  async delete(userId: string, input: AccountDeleteRequest): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) throw notFound('User');
    if (user.passwordHash) {
      if (!input.password || !(await verifyPassword(user.passwordHash, input.password))) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Password is incorrect');
      }
    }
    const ownerId = user._id;

    const active = await JobModel.find({
      ownerId,
      status: mongoose.trusted({ $in: [...ACTIVE_STATUSES] }),
    });
    for (const job of active) {
      await this.queue.removeIfWaiting(job.id as string).catch(() => false);
      await finishJob(this.bus, job.id as string, 'CANCELLED');
    }

    await recordDeletedCounts(await metricCounts(ownerId));
    await LlmUsageModel.updateMany(
      { userId: ownerId },
      { $set: { userId: null, simulationId: null, callKey: null } },
    );
    await Promise.all([
      TurnModel.deleteMany({ ownerId }),
      JobModel.deleteMany({ ownerId }),
      AdviceModel.deleteMany({ ownerId }),
      SimulationModel.deleteMany({ ownerId }),
      StartupModel.deleteMany({ ownerId }),
      RefreshTokenModel.deleteMany({ userId: ownerId }),
      ActionTokenModel.deleteMany({ userId: ownerId }),
      OtpCodeModel.deleteMany({ userId: ownerId }),
    ]);
    await UserModel.deleteOne({ _id: ownerId });
  }
}
