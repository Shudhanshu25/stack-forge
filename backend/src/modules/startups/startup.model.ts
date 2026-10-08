import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import type { Location, Startup, StartupConfiguration } from '@stackforge/shared';

const startupSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    product: {
      name: { type: String, required: true },
      description: { type: String, default: '' },
    },
    // Null for startups created before locations existed (they use the neutral profile).
    location: { type: Schema.Types.Mixed, default: null },
    // Validated against startup-configuration.schema.json before every write.
    configuration: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, minimize: false },
);

// A user's startups, newest first.
startupSchema.index({ ownerId: 1, createdAt: -1 });

export type StartupDoc = HydratedDocument<InferSchemaType<typeof startupSchema>>;
export const StartupModel = model('Startup', startupSchema);

export function toStartupDto(doc: StartupDoc): Startup {
  return {
    id: doc.id as string,
    ownerId: doc.ownerId.toString(),
    name: doc.name,
    product: { name: doc.product!.name, description: doc.product!.description },
    location: (doc.location as Location | null | undefined) ?? null,
    configuration: doc.configuration as StartupConfiguration,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
