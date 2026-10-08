import { Schema, model, type Types } from 'mongoose';
import type { AdminStats } from '@stackforge/shared';
import type { EngineClient } from '../../engine/engine-client.js';
import { UserModel } from '../auth/user.model.js';
import { AdviceModel } from '../simulations/advice.model.js';
import { JobModel } from '../simulations/job.model.js';
import { SimulationModel } from '../simulations/simulation.model.js';
import { TurnModel } from '../simulations/turn.model.js';
import { StartupModel } from '../startups/startup.model.js';

/** Reasons that mean no LLM request was made. */
const NO_REQUEST = ['LLM not configured', 'Advisor disabled'];

const agentAttempted = (path: string) => ({
  $cond: [
    {
      $or: [
        { $eq: [`$record.agentEffects.${path}.source`, 'llm'] },
        {
          $and: [
            { $eq: [`$record.agentEffects.${path}.source`, 'rules_fallback'] },
            { $ne: [`$record.agentEffects.${path}.fallbackReason`, 'LLM not configured'] },
          ],
        },
      ],
    },
    1,
    0,
  ],
});

const adviceAttempted = (path: string) => ({
  $cond: [
    {
      $and: [
        { $ne: [{ $type: path }, 'missing'] },
        {
          $or: [
            { $eq: [`${path}.available`, true] },
            { $not: [{ $in: [`${path}.unavailableReason`, NO_REQUEST] }] },
          ],
        },
      ],
    },
    1,
    0,
  ],
});

/** The raw counts behind every admin metric. Sums, so they add across sources. */
export interface MetricCounts {
  users: number;
  startups: number;
  simulations: number;
  failedJobs: number;
  turns: number;
  aiRequests: number;
  mlPredictions: number;
  /** Total and number of completed-job durations, for the average turn duration. */
  turnDurationMsTotal: number;
  turnDurationCount: number;
}

const COUNT_KEYS: (keyof MetricCounts)[] = [
  'users',
  'startups',
  'simulations',
  'failedJobs',
  'turns',
  'aiRequests',
  'mlPredictions',
  'turnDurationMsTotal',
  'turnDurationCount',
];

/**
 * Aggregate contributions of accounts that were deleted: numbers only, no ids or content, so
 * admin metrics stay complete after a user exercises their right to deletion.
 */
const deletedCountsSchema = new Schema(
  Object.fromEntries([
    ['_id', { type: String }],
    ...COUNT_KEYS.map((k) => [k, { type: Number, default: 0 }]),
  ]),
  { versionKey: false, collection: 'platformcounters' },
);
const DeletedCountsModel = model('DeletedCounts', deletedCountsSchema);
const DELETED = 'deleted-accounts';

/** Every metric's raw count, for the whole platform or for one owner. */
export async function metricCounts(ownerId?: Types.ObjectId): Promise<MetricCounts> {
  const owner = ownerId ? { ownerId } : {};
  const [users, startups, simulations, failedJobs, turnStats, duration, adviceStats] =
    await Promise.all([
      ownerId ? UserModel.countDocuments({ _id: ownerId }) : UserModel.countDocuments(),
      StartupModel.countDocuments(owner),
      SimulationModel.countDocuments(owner),
      JobModel.countDocuments({ ...owner, status: 'FAILED' }),
      TurnModel.aggregate<{
        turns: number;
        agentCalls: number;
        advisor: number;
        forecasts: number;
      }>([
        { $match: owner },
        {
          $group: {
            _id: null,
            turns: { $sum: 1 },
            agentCalls: {
              $sum: { $add: [agentAttempted('customer'), agentAttempted('competitor')] },
            },
            advisor: { $sum: adviceAttempted('$record.advice') },
            forecasts: { $sum: { $cond: [{ $eq: ['$record.forecast.available', true] }, 1, 0] } },
          },
        },
      ]),
      JobModel.aggregate<{ total: number; count: number }>([
        {
          $match: {
            ...owner,
            status: 'COMPLETED',
            startedAt: { $ne: null },
            completedAt: { $ne: null },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $subtract: ['$completedAt', '$startedAt'] } },
            count: { $sum: 1 },
          },
        },
      ]),
      AdviceModel.aggregate<{ count: number }>([
        { $match: owner },
        { $group: { _id: null, count: { $sum: adviceAttempted('$advice') } } },
      ]),
    ]);
  const t = turnStats[0] ?? { turns: 0, agentCalls: 0, advisor: 0, forecasts: 0 };
  return {
    users,
    startups,
    simulations,
    failedJobs,
    turns: t.turns,
    aiRequests: t.agentCalls + t.advisor + (adviceStats[0]?.count ?? 0),
    mlPredictions: t.forecasts,
    turnDurationMsTotal: duration[0]?.total ?? 0,
    turnDurationCount: duration[0]?.count ?? 0,
  };
}

/** Adds a deleted account's contribution to the anonymous totals. */
export async function recordDeletedCounts(counts: MetricCounts): Promise<void> {
  await DeletedCountsModel.updateOne(
    { _id: DELETED },
    { $inc: Object.fromEntries(COUNT_KEYS.map((k) => [k, counts[k]])) },
    { upsert: true },
  );
}

export class AdminService {
  constructor(private readonly engine: EngineClient) {}

  /** Live data plus the anonymous totals of deleted accounts. */
  async stats(): Promise<AdminStats> {
    const [live, deleted, info] = await Promise.all([
      metricCounts(),
      DeletedCountsModel.findById(DELETED).lean<Partial<MetricCounts>>(),
      this.engine.info().catch(() => null),
    ]);
    const c = Object.fromEntries(
      COUNT_KEYS.map((k) => [k, live[k] + (deleted?.[k] ?? 0)]),
    ) as unknown as MetricCounts;
    return {
      users: c.users,
      startups: c.startups,
      simulations: c.simulations,
      turnsPlayed: c.turns,
      averageTurnDurationMs: c.turnDurationCount
        ? c.turnDurationMsTotal / c.turnDurationCount
        : null,
      aiRequests: c.aiRequests,
      mlPredictions: c.mlPredictions,
      failedJobs: c.failedJobs,
      engineVersion: info?.engineVersion ?? null,
      modelVersion: info?.modelVersion ?? null,
      generatedAt: new Date().toISOString(),
    };
  }
}
