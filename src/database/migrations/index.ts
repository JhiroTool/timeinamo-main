import { attendanceInvariantsSql } from './002_attendance_invariants.js';
import { initialSchemaSql } from './001_initial_schema.js';
import { setupPreferencesSql } from './003_setup_preferences.js';
import { attendanceHistorySql } from './004_attendance_history.js';
import { journalReportingSql } from './005_journal_reporting.js';
import { performanceIndexesSql } from './006_performance_indexes.js';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export const migrations: readonly Migration[] = [
  { version: 1, name: 'initial_schema', sql: initialSchemaSql },
  { version: 2, name: 'attendance_invariants', sql: attendanceInvariantsSql },
  { version: 3, name: 'setup_preferences', sql: setupPreferencesSql },
  { version: 4, name: 'attendance_history', sql: attendanceHistorySql },
  { version: 5, name: 'journal_reporting', sql: journalReportingSql },
  { version: 6, name: 'performance_indexes', sql: performanceIndexesSql },
] as const;

export const latestSchemaVersion = migrations.at(-1)?.version ?? 0;

