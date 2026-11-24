import type { Database } from '@/types/database';
import { toUtcTimestamp } from '@/utils/time';

import { DatabaseRecoveryRequiredError } from './errors';

export const recoveredProfileName = 'Recovered profile';

interface ForeignKeyFailure {
  table: string;
  parent: string;
}

const profileChildTables = new Set(['work_settings', 'attendance_sessions', 'activity_logs']);

function describeFailures(failures: ForeignKeyFailure[]): Error {
  const relationships = [...new Set(failures.map(({ table, parent }) => `${table} → ${parent}`))];
  return new Error(`Foreign key verification found ${failures.length} invalid relationships (${relationships.join(', ')}).`);
}

export async function verifyProfileRelationships(database: Database, recover: boolean): Promise<void> {
  const failures = await database.getAllAsync<ForeignKeyFailure>('PRAGMA foreign_key_check');
  if (!failures.length) return;

  const failure = describeFailures(failures);
  if (!failures.every(({ table, parent }) => parent === 'profiles' && profileChildTables.has(table))) {
    throw failure;
  }

  const profile = await database.getFirstAsync('SELECT 1 FROM profiles LIMIT 1');
  const unsupportedOwner = await database.getFirstAsync(`
    SELECT 1 FROM work_settings WHERE profile_id <> 1
    UNION ALL SELECT 1 FROM attendance_sessions WHERE profile_id <> 1
    UNION ALL SELECT 1 FROM activity_logs WHERE profile_id <> 1
    LIMIT 1
  `);
  if (profile || unsupportedOwner) throw failure;
  if (!recover) throw new DatabaseRecoveryRequiredError(failure);

  // Recover ownership with an incomplete profile. Setup will ask for the user's own information.
  await database.execAsync('BEGIN IMMEDIATE');
  try {
    const now = toUtcTimestamp();
    await database.runAsync(
      `INSERT INTO profiles (id, full_name, created_at, updated_at)
       VALUES (1, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
      recoveredProfileName,
      now,
      now,
    );
    const remaining = await database.getAllAsync<ForeignKeyFailure>('PRAGMA foreign_key_check');
    if (remaining.length) throw describeFailures(remaining);
    await database.execAsync('COMMIT');
  } catch (error) {
    await database.execAsync('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
