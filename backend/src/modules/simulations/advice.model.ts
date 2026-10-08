import { Schema, model } from 'mongoose';

/** One on-demand AI CEO request and its answer (append-only; counted by the admin view). */
const adviceSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    simulationId: { type: Schema.Types.ObjectId, ref: 'Simulation', required: true, index: true },
    turnNumber: { type: Number, required: true },
    mode: { type: String, required: true },
    question: { type: String, default: null },
    advice: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

export const AdviceModel = model('Advice', adviceSchema);
