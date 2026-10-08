import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import type { LlmUsageRecord } from '@stackforge/shared';

/**
 * One LLM call (agent or AI CEO), recorded per user, simulation and prompt version. Feeds the
 * daily token quota and the data export. When an account is deleted its rows are kept for
 * cost accounting with the user and simulation removed.
 */
const llmUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    simulationId: { type: Schema.Types.ObjectId, ref: 'Simulation', default: null },
    turnNumber: { type: Number, default: null },
    purpose: { type: String, required: true },
    model: { type: String, required: true },
    promptVersion: { type: String, required: true },
    promptTokens: { type: Number, required: true, min: 0 },
    completionTokens: { type: Number, required: true, min: 0 },
    cached: { type: Boolean, default: false },
    outcome: { type: String, required: true },
    /** Idempotency for retried turns: one row per call of a turn. */
    callKey: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'llmusage' },
);
// The daily quota sums a user's tokens since the start of the UTC day.
llmUsageSchema.index({ userId: 1, createdAt: -1 });
llmUsageSchema.index(
  { callKey: 1 },
  { unique: true, partialFilterExpression: { callKey: { $type: 'string' } } },
);

export type LlmUsageDoc = HydratedDocument<InferSchemaType<typeof llmUsageSchema>>;
export const LlmUsageModel = model('LlmUsage', llmUsageSchema);

export function toUsageRecord(doc: LlmUsageDoc): LlmUsageRecord {
  return {
    simulationId: doc.simulationId?.toString() ?? null,
    turnNumber: doc.turnNumber ?? null,
    purpose: doc.purpose,
    model: doc.model,
    promptVersion: doc.promptVersion,
    promptTokens: doc.promptTokens,
    completionTokens: doc.completionTokens,
    cached: doc.cached,
    outcome: doc.outcome,
    createdAt: doc.createdAt.toISOString(),
  };
}
