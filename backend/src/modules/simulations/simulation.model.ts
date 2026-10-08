import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * A simulation's identity and settings. The configuration and initial state are snapshotted at
 * start. Progress lives in the turn records; currentTurn, status and activeJobId are
 * conveniences kept in step by the worker.
 */
const simulationSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startupId: { type: Schema.Types.ObjectId, ref: 'Startup', required: true },
    seed: { type: Number, required: true },
    agentMode: { type: String, enum: ['rules', 'llm'], required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'BANKRUPT', 'COMPLETED', 'ARCHIVED'],
      default: 'ACTIVE',
      required: true,
    },
    engineVersion: { type: String, required: true },
    configuration: { type: Schema.Types.Mixed, required: true },
    initialState: { type: Schema.Types.Mixed, required: true },
    currentTurn: { type: Number, default: 0, required: true },
    activeJobId: { type: String, default: null },
  },
  { timestamps: true, minimize: false },
);

// A startup's simulations for their owner, newest first (also serves owner-only queries).
simulationSchema.index({ ownerId: 1, startupId: 1, createdAt: -1 });

export type SimulationDoc = HydratedDocument<InferSchemaType<typeof simulationSchema>>;
export const SimulationModel = model('Simulation', simulationSchema);
