import * as SQLite from 'expo-sqlite';

import type { Database } from '@/types/database';
import { toUtcTimestamp } from '@/utils/time';

import { DatabaseInitializationError, DatabaseRecoveryRequiredError } from './errors';
import { latestSchemaVersion, migrations } from './migrations';
import { verifyProfileRelationships } from './recoverMissingProfile';

const DATABASE_NAME = 'timeinamo.db';
type InitializationStage = 'open' | 'configure' | 'migrate' | 'verify';
const stageCodes: Record<InitializationStage, string> = {
  open: 'DB-OPEN',
  configure: 'DB-CONFIGURE',
  migrate: 'DB-MIGRATE',
  verify: 'DB-VERIFY',
};

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
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;
  `);
}

async function readSchemaVersion(database: Database): Promise<number> {
  const versionRow = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version;
  if (currentVersion === undefined || !Number.isInteger(currentVersion) || currentVersion < 0) {
    throw new Error('Could not read a valid SQLite schema version.');
  }

  if (currentVersion > latestSchemaVersion) {
    throw new Error(
      `Database schema ${currentVersion} is newer than supported version ${latestSchemaVersion}.`,
    );
  }
  return currentVersion;
}

async function applyMigrations(database: Database): Promise<void> {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error('Migration versions must be unique, contiguous, and start at 1.');
    }
  });

  if (await readSchemaVersion(database) === latestSchemaVersion) return;

  // Startup owns this connection until verification completes.
  await database.execAsync('BEGIN IMMEDIATE');
  try {
    const currentVersion = await readSchemaVersion(database);
    for (const migration of migrations.slice(currentVersion)) {
      await database.execAsync(migration.sql);
      await database.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        toUtcTimestamp(),
      );
      await database.execAsync(`PRAGMA user_version = ${migration.version}`);
    }
    await database.execAsync('COMMIT');
  } catch (error) {
    await database.execAsync('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

async function verifyDatabase(database: Database, recoverMissingProfile: boolean): Promise<void> {
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
  await verifyProfileRelationships(database, recoverMissingProfile);
}

async function openAndInitializeDatabase(recoverMissingProfile: boolean): Promise<Database> {
  let database: Database | null = null;
  let stage: InitializationStage = 'open';
  try {
    database = await SQLite.openDatabaseAsync(DATABASE_NAME);
    stage = 'configure';
    await configureConnection(database);
    stage = 'migrate';
    await applyMigrations(database);
    stage = 'verify';
    await verifyDatabase(database, recoverMissingProfile);
    return database;
  } catch (error) {
    await database?.closeAsync().catch(() => undefined);
    const code = stageCodes[stage];
    if (__DEV__) {
      const detail = error instanceof DatabaseRecoveryRequiredError ? error.cause : error;
      const message = detail instanceof Error ? detail.message : String(detail);
      console.warn(`[TimeInamo ${code}] SQLite startup failed: ${message}`);
    }
    if (error instanceof DatabaseRecoveryRequiredError) throw error;
    throw new DatabaseInitializationError(`Could not initialize the local database (${code}).`, error);
  }
}

export function initializeDatabase({ recoverMissingProfile = false } = {}): Promise<Database> {
  if (!databasePromise) {
    databasePromise = openAndInitializeDatabase(recoverMissingProfile).catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

