import { attendanceInvariantsSql } from './002_attendance_invariants.js';
import { initialSchemaSql } from './001_initial_schema.js';
import { setupPreferencesSql } from './003_setup_preferences.js';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export const migrations: readonly Migration[] = [
  { version: 1, name: 'initial_schema', sql: initialSchemaSql },
  { version: 2, name: 'attendance_invariants', sql: attendanceInvariantsSql },
  { version: 3, name: 'setup_preferences', sql: setupPreferencesSql },
] as const;

export const latestSchemaVersion = migrations.at(-1)?.version ?? 0;

