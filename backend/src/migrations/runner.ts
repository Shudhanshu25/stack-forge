import type mongoose from 'mongoose';
import type { Logger } from 'pino';

/** The driver database handle, as Mongoose's bundled driver types it. */
export type Db = NonNullable<typeof mongoose.connection.db>;

/** One versioned schema or data change. `up` must be safe to re-run if it fails halfway. */
export interface Migration {
  /** Sortable and unique, e.g. "001-baseline-indexes". Never rename a migration once applied. */
  id: string;
  description: string;
  up(db: Db, log: Logger): Promise<void>;
}

interface AppliedMigration {
  _id: string;
  description: string;
  appliedAt: Date;
  durationMs: number;
}

interface MigrationLock {
  _id: string;
  lockedAt: Date;
}

const COLLECTION = 'migrations';
const LOCK = '__lock__';
/** A lock older than this is from a crashed run and may be taken over. */
const STALE_LOCK_MS = 15 * 60 * 1000;

export class MigrationLockedError extends Error {}

/**
 * Applies, in id order, every migration not yet recorded in the `migrations` collection. A lock
 * document stops two deploys from migrating at once. Returns the ids applied by this run.
 */
export async function migrate(db: Db, migrations: Migration[], log: Logger): Promise<string[]> {
  const ids = migrations.map((m) => m.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate migration id');
  const ordered = [...migrations].sort((a, b) => a.id.localeCompare(b.id));

  const applied = db.collection<AppliedMigration>(COLLECTION);
  const locks = db.collection<MigrationLock>(COLLECTION);
  try {
    await locks.insertOne({ _id: LOCK, lockedAt: new Date() });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    const stale = await locks.findOneAndUpdate(
      { _id: LOCK, lockedAt: { $lt: new Date(Date.now() - STALE_LOCK_MS) } },
      { $set: { lockedAt: new Date() } },
    );
    if (!stale) throw new MigrationLockedError('Another migration run holds the lock');
    log.warn('took over a stale migration lock');
  }

  const done: string[] = [];
  try {
    const already = new Set(
      (await applied.find({ _id: { $ne: LOCK } }, { projection: { _id: 1 } }).toArray()).map(
        (d) => d._id,
      ),
    );
    for (const migration of ordered) {
      if (already.has(migration.id)) continue;
      const started = Date.now();
      log.info({ migration: migration.id }, 'applying migration');
      await migration.up(db, log.child({ migration: migration.id }));
      await applied.insertOne({
        _id: migration.id,
        description: migration.description,
        appliedAt: new Date(),
        durationMs: Date.now() - started,
      });
      done.push(migration.id);
    }
  } finally {
    await locks.deleteOne({ _id: LOCK });
  }
  return done;
}

/** Migrations recorded as applied, oldest first. */
export async function appliedMigrations(db: Db): Promise<string[]> {
  const rows = await db
    .collection<AppliedMigration>(COLLECTION)
    .find({ _id: { $ne: LOCK } })
    .sort({ _id: 1 })
    .toArray();
  return rows.map((r) => r._id);
}
