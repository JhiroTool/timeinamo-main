import * as SQLite from 'expo-sqlite';

import type { Database } from '@/types/database';
import { toUtcTimestamp } from '@/utils/time';

import { DatabaseInitializationError } from './errors';
import { latestSchemaVersion, migrations } from './migrations';

const DATABASE_NAME = 'timeinamo.db';

let databasePromise: Promise<Database> | null = null;

interface UserVersionRow {
  user_version: number;
}

interface IntegrityRow {
  quick_check: string;
}

interface MigrationRow {
  version: number;
  name: string;
}

async function configureConnection(database: Database): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;
  `);
}

async function applyMigrations(database: Database): Promise<void> {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error('Migration versions must be unique, contiguous, and start at 1.');
    }
  });

  const versionRow = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion > latestSchemaVersion) {
    throw new Error(
      `Database schema ${currentVersion} is newer than supported version ${latestSchemaVersion}.`,
    );
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await database.withExclusiveTransactionAsync(async (transaction) => {
      const transactionVersion = await transaction.getFirstAsync<UserVersionRow>(
        'PRAGMA user_version',
      );
      if ((transactionVersion?.user_version ?? 0) !== migration.version - 1) {
        throw new Error(`Unexpected schema version before migration ${migration.version}.`);
      }

      await transaction.execAsync(migration.sql);
      await transaction.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        toUtcTimestamp(),
      );
      await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

async function verifyDatabase(database: Database): Promise<void> {
  const foreignKeyFailures = await database.getAllAsync<Record<string, unknown>>(
    'PRAGMA foreign_key_check',
  );
  if (foreignKeyFailures.length > 0) {
    throw new Error('Foreign key verification failed.');
  }

  const integrity = await database.getFirstAsync<IntegrityRow>('PRAGMA quick_check');
  if (integrity?.quick_check !== 'ok') {
    throw new Error(`SQLite integrity check failed: ${integrity?.quick_check ?? 'unknown error'}`);
  }

  const appliedMigrations = await database.getAllAsync<MigrationRow>(
    'SELECT version, name FROM schema_migrations ORDER BY version',
  );
  const migrationLedgerMatches =
    appliedMigrations.length === migrations.length &&
    appliedMigrations.every(
      (applied, index) =>
        applied.version === migrations[index]?.version &&
        applied.name === migrations[index]?.name,
    );
  if (!migrationLedgerMatches) {
    throw new Error('The database migration ledger does not match the application schema.');
  }
}

async function openAndInitializeDatabase(): Promise<Database> {
  let database: Database | null = null;
  try {
    database = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await configureConnection(database);
    await applyMigrations(database);
    await verifyDatabase(database);
    return database;
  } catch (error) {
    await database?.closeAsync().catch(() => undefined);
    throw new DatabaseInitializationError('Could not initialize the local database.', error);
  }
}

export function initializeDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = openAndInitializeDatabase().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

