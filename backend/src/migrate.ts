/**
 * Applies pending MongoDB migrations, then exits. Run before starting a new release:
 *   npm run migrate -w backend            (development)
 *   node dist/migrate.js                  (in the api image; the deploy step does this)
 *   node dist/migrate.js --status         (list applied and pending migrations)
 */
import mongoose from 'mongoose';
import { loadConfig } from './config.js';
import { connectMongo } from './db.js';
import { createLogger } from './logger.js';
import { MIGRATIONS } from './migrations/index.js';
import { appliedMigrations, migrate } from './migrations/runner.js';

const config = loadConfig();
const logger = createLogger(config.logLevel, 'migrate');

try {
  await connectMongo(config.mongodbUri, logger, { waitForFirstConnection: true });
  const db = mongoose.connection.db!;
  if (process.argv.includes('--status')) {
    const applied = new Set(await appliedMigrations(db));
    for (const m of MIGRATIONS) {
      logger.info({ migration: m.id, applied: applied.has(m.id) }, m.description);
    }
  } else {
    const done = await migrate(db, MIGRATIONS, logger);
    logger.info({ applied: done, total: MIGRATIONS.length }, 'migrations complete');
  }
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  logger.error({ err }, 'migration failed');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
}
