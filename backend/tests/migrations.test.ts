import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger.js';
import { MIGRATIONS } from '../src/migrations/index.js';
import {
  appliedMigrations,
  migrate,
  MigrationLockedError,
  type Migration,
} from '../src/migrations/runner.js';
import { SimulationModel } from '../src/modules/simulations/simulation.model.js';

const log = createLogger('silent');
const db = () => mongoose.connection.db!;

describe('migrations', () => {
  it('applies every migration once, in order, and records it', async () => {
    const first = await migrate(db(), MIGRATIONS, log);
    expect(first).toEqual(MIGRATIONS.map((m) => m.id).sort());
    expect(await appliedMigrations(db())).toEqual(first);
    expect(await migrate(db(), MIGRATIONS, log)).toEqual([]);
  });

  it('builds the reviewed indexes and drops the ones they supersede', async () => {
    await SimulationModel.collection.createIndex({ ownerId: 1 }, { name: 'ownerId_1' });
    await migrate(db(), MIGRATIONS, log);
    const names = (await SimulationModel.collection.indexes()).map((i) => i.name);
    expect(names).toContain('ownerId_1_startupId_1_createdAt_-1');
    expect(names).not.toContain('ownerId_1');
  });

  it('refuses to run while another run holds the lock, and takes over a stale lock', async () => {
    await db()
      .collection<{ _id: string; lockedAt: Date }>('migrations')
      .insertOne({ _id: '__lock__', lockedAt: new Date() });
    await expect(migrate(db(), MIGRATIONS, log)).rejects.toBeInstanceOf(MigrationLockedError);
    expect(await appliedMigrations(db())).toEqual([]);

    await db()
      .collection<{ _id: string; lockedAt: Date }>('migrations')
      .updateOne(
        { _id: '__lock__' },
        { $set: { lockedAt: new Date(Date.now() - 60 * 60 * 1000) } },
      );
    expect(await migrate(db(), MIGRATIONS, log)).toHaveLength(MIGRATIONS.length);
  });

  it('a failing migration is not recorded, stops the run and releases the lock', async () => {
    const ran: string[] = [];
    const steps: Migration[] = [
      { id: '900-ok', description: 'ok', up: async () => void ran.push('900') },
      {
        id: '901-fails',
        description: 'fails',
        up: async () => {
          throw new Error('boom');
        },
      },
      { id: '902-after', description: 'never', up: async () => void ran.push('902') },
    ];
    await expect(migrate(db(), steps, log)).rejects.toThrow('boom');
    expect(ran).toEqual(['900']);
    expect(await appliedMigrations(db())).toEqual(['900-ok']);
    // The lock was released, so a fixed run continues where it stopped.
    steps[1] = { id: '901-fails', description: 'fixed', up: async () => void ran.push('901') };
    expect(await migrate(db(), steps, log)).toEqual(['901-fails', '902-after']);
  });
});
