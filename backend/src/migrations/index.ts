import { AdviceModel } from '../modules/simulations/advice.model.js';
import { JobModel } from '../modules/simulations/job.model.js';
import { SimulationModel } from '../modules/simulations/simulation.model.js';
import { TurnModel } from '../modules/simulations/turn.model.js';
import { ActionTokenModel } from '../modules/auth/action-token.model.js';
import { OtpCodeModel } from '../modules/auth/otp-code.model.js';
import { RefreshTokenModel } from '../modules/auth/refresh-token.model.js';
import { UserModel } from '../modules/auth/user.model.js';
import { LlmUsageModel } from '../modules/llm/llm-usage.model.js';
import { neutralProfile } from '../modules/locations/location.service.js';
import { StartupModel } from '../modules/startups/startup.model.js';
import type { Migration } from './runner.js';

const MODELS = [
  UserModel,
  RefreshTokenModel,
  ActionTokenModel,
  OtpCodeModel,
  StartupModel,
  SimulationModel,
  TurnModel,
  JobModel,
  AdviceModel,
  LlmUsageModel,
];

/** Drops an index if it exists (re-runnable). */
async function dropIndexIfExists(
  db: Parameters<Migration['up']>[0],
  collection: string,
  name: string,
): Promise<void> {
  const exists = await db
    .collection(collection)
    .indexExists(name)
    .catch(() => false);
  if (exists) await db.collection(collection).dropIndex(name);
}

/** Every migration, in order. Append new ones; never edit or reorder applied ones. */
export const MIGRATIONS: Migration[] = [
  {
    id: '001-baseline-indexes',
    description: 'Create every index the models declare (production does not auto-index)',
    async up(_db, log) {
      for (const model of MODELS) {
        await model.createIndexes();
        log.info({ collection: model.collection.name }, 'indexes ensured');
      }
    },
  },
  {
    id: '002-owner-query-indexes',
    description:
      'Index review: compound owner indexes for sorted lists, a job status index; drop the single-field indexes they supersede',
    async up(db) {
      await StartupModel.createIndexes();
      await SimulationModel.createIndexes();
      await JobModel.createIndexes();
      await dropIndexIfExists(db, StartupModel.collection.name, 'ownerId_1');
      await dropIndexIfExists(db, SimulationModel.collection.name, 'ownerId_1');
      await dropIndexIfExists(db, SimulationModel.collection.name, 'startupId_1');
    },
  },
  {
    id: '003-existing-users-verified',
    description:
      'Email verification arrived in Milestone 8: accounts created before it count as verified',
    async up(db) {
      // Only users that predate the field; new accounts are created with emailVerifiedAt: null.
      await db
        .collection('users')
        .updateMany({ emailVerifiedAt: { $exists: false } }, [
          { $set: { emailVerifiedAt: '$createdAt' } },
        ]);
      await UserModel.createIndexes();
      await ActionTokenModel.createIndexes();
      await LlmUsageModel.createIndexes();
    },
  },
  {
    id: '004-password-reset-codes',
    description: 'Password reset by emailed 6-digit code: the otpcodes collection and its indexes',
    async up() {
      await OtpCodeModel.createIndexes();
    },
  },
  {
    id: '005-neutral-location',
    description:
      'Startup locations arrived in Milestone 10: earlier startups and simulations get the neutral profile',
    async up(db) {
      // Every index at 1.0: the engine applies no location effect, so these simulations keep
      // computing (and replaying) exactly as before, on their own engine version.
      const locationProfile = neutralProfile();
      await db
        .collection('startups')
        .updateMany({ location: { $exists: false } }, { $set: { location: null } });
      for (const name of ['startups', 'simulations']) {
        await db
          .collection(name)
          .updateMany(
            { 'configuration.locationProfile': { $exists: false } },
            { $set: { 'configuration.locationProfile': locationProfile } },
          );
      }
    },
  },
];
