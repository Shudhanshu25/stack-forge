import { Schema, model } from 'mongoose';
import type { SimulationTurn } from '@stackforge/shared';

/**
 * Turn records are append-only: written once by the worker, never updated. The unique index
 * makes a second write of the same turn fail, and the hooks below refuse every update path.
 */
const turnSchema = new Schema(
  {
    simulationId: { type: Schema.Types.ObjectId, ref: 'Simulation', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    turnNumber: { type: Number, required: true },
    // The engine's SimulationTurn, validated against simulation-turn.schema.json before insert.
    record: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

turnSchema.index({ simulationId: 1, turnNumber: 1 }, { unique: true });

const immutable = () => {
  throw new Error('Turn records are immutable');
};
turnSchema.pre('save', function (next) {
  if (!this.isNew) return immutable();
  next();
});
for (const op of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
] as const) {
  turnSchema.pre(op, immutable);
}

export const TurnModel = model('Turn', turnSchema);

export interface TurnDocLike {
  _id: { toString(): string };
  simulationId: { toString(): string };
  record: unknown;
  createdAt: Date;
}

export function toTurnDto(doc: TurnDocLike): SimulationTurn {
  return {
    ...(doc.record as SimulationTurn),
    id: doc._id.toString(),
    simulationId: doc.simulationId.toString(),
    createdAt: doc.createdAt.toISOString(),
  };
}
