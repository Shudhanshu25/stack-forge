import mongoose from 'mongoose';
import type { LlmCall, LlmUsageSummary, StartupProfile } from '@stackforge/shared';
import { StartupModel } from '../startups/startup.model.js';
import { LlmUsageModel } from './llm-usage.model.js';

const startOfUtcDay = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/**
 * The per-user daily LLM token quota. Usage is what the simulation service reported for each
 * call (cache hits cost nothing). A quota of 0 means no daily limit.
 */
export class LlmUsageService {
  constructor(private readonly dailyQuota: number) {}

  async usedToday(userId: string, now = new Date()): Promise<number> {
    const [row] = await LlmUsageModel.aggregate<{ tokens: number }>([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startOfUtcDay(now) },
        },
      },
      { $group: { _id: null, tokens: { $sum: { $add: ['$promptTokens', '$completionTokens'] } } } },
    ]);
    return row?.tokens ?? 0;
  }

  /** Tokens the user may still spend today; null when there is no daily limit. */
  async allowance(userId: string): Promise<number | null> {
    if (!this.dailyQuota) return null;
    return Math.max(0, this.dailyQuota - (await this.usedToday(userId)));
  }

  async summary(userId: string, now = new Date()): Promise<LlmUsageSummary> {
    const used = await this.usedToday(userId, now);
    const quota = this.dailyQuota;
    const resetsAt = new Date(startOfUtcDay(now).getTime() + 24 * 3_600_000);
    return {
      usedToday: used,
      dailyQuota: quota,
      remaining: quota ? Math.max(0, quota - used) : 0,
      exhausted: quota > 0 && used >= quota,
      resetsAt: resetsAt.toISOString(),
    };
  }

  /**
   * Records the calls of one turn or advice request. `keyPrefix` makes it idempotent: a turn
   * retried after its record was written does not count its tokens twice.
   */
  async record(
    userId: unknown,
    simulationId: unknown,
    turnNumber: number,
    calls: LlmCall[] | undefined,
    keyPrefix: string,
  ): Promise<void> {
    if (!calls?.length) return;
    const docs = calls.map((c, i) => ({
      userId,
      simulationId,
      turnNumber,
      purpose: c.purpose,
      model: c.model,
      promptVersion: c.promptVersion,
      promptTokens: c.promptTokens,
      completionTokens: c.completionTokens,
      cached: c.cached,
      outcome: c.outcome,
      callKey: `${keyPrefix}:${i}`,
    }));
    try {
      await LlmUsageModel.insertMany(docs, { ordered: false });
    } catch (err) {
      // Duplicates (a retried turn) are expected and skipped; anything else is real.
      const writeErrors = (err as { writeErrors?: { code?: number; err?: { code?: number } }[] })
        .writeErrors;
      const allDuplicates =
        writeErrors?.length && writeErrors.every((e) => (e.code ?? e.err?.code) === 11000);
      if (!allDuplicates) throw err;
    }
  }
}

/** The founder's own words about a startup, for the agents and advisor (as untrusted data). */
export async function startupProfile(startupId: unknown): Promise<StartupProfile | undefined> {
  const startup = await StartupModel.findById(startupId).lean();
  if (!startup) return undefined;
  return {
    name: startup.name,
    productName: startup.product?.name ?? startup.name,
    ...(startup.product?.description ? { productDescription: startup.product.description } : {}),
  };
}
