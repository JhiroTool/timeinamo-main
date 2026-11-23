import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { initialSchemaSql } from '../src/database/migrations/001_initial_schema.js';
import { attendanceInvariantsSql } from '../src/database/migrations/002_attendance_invariants.js';
import { setupPreferencesSql } from '../src/database/migrations/003_setup_preferences.js';

const migrations = [
  { version: 1, name: 'initial_schema', sql: initialSchemaSql },
  { version: 2, name: 'attendance_invariants', sql: attendanceInvariantsSql },
  { version: 3, name: 'setup_preferences', sql: setupPreferencesSql },
];

const testDirectory = mkdtempSync(join(tmpdir(), 'timeinamo-db-check-'));
const databasePath = join(testDirectory, 'restart-check.db');
let database = new DatabaseSync(databasePath);
database.exec('PRAGMA foreign_keys = ON;');

for (const migration of migrations) {
  database.exec('BEGIN EXCLUSIVE;');
  try {
    database.exec(migration.sql);
    database
      .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
      .run(migration.version, migration.name, '2026-01-01T00:00:00.000Z');
    database.exec(`PRAGMA user_version = ${migration.version};`);
    database.exec('COMMIT;');
  } catch (error) {
    database.exec('ROLLBACK;');
    throw error;
  }
}

const objects = database
  .prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index')")
  .all();
for (const table of [
  'profiles',
  'work_settings',
  'attendance_sessions',
  'attendance_corrections',
  'activity_logs',
]) {
  assert(objects.some((object) => object.type === 'table' && object.name === table));
}
for (const index of ['uq_attendance_session_workday', 'uq_attendance_single_active']) {
  assert(objects.some((object) => object.type === 'index' && object.name === index));
}

const insertProfile = database.prepare(`
  INSERT INTO profiles (id, full_name, created_at, updated_at)
  VALUES (1, 'Schema Check', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
`);
insertProfile.run();

const insertSession = database.prepare(`
  INSERT INTO attendance_sessions (
    profile_id, work_date, clock_in_at, status, created_at, updated_at
  ) VALUES (1, ?, ?, 'active', ?, ?)
`);
insertSession.run(
  '2026-01-01',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z',
);

assert.throws(() =>
  insertSession.run(
    '2026-01-02',
    '2026-01-02T00:00:00.000Z',
    '2026-01-02T00:00:00.000Z',
    '2026-01-02T00:00:00.000Z',
  ),
);

database.prepare(`
  UPDATE attendance_sessions
  SET status = 'completed', clock_out_at = '2026-01-01T08:00:00.000Z',
      break_duration_seconds = 3600, worked_duration_seconds = 25200,
      updated_at = '2026-01-01T08:00:00.000Z'
  WHERE id = 1
`).run();

assert.throws(() =>
  database.prepare(`
    INSERT INTO attendance_sessions (
      profile_id, work_date, clock_in_at, status, clock_out_at,
      worked_duration_seconds, created_at, updated_at
    ) VALUES (
      1, '2026-01-01', '2026-01-01T09:00:00.000Z', 'completed',
      '2026-01-01T10:00:00.000Z', 3600,
      '2026-01-01T10:00:00.000Z', '2026-01-01T10:00:00.000Z'
    )
  `).run(),
);

assert.throws(() =>
  database.prepare(`
    INSERT INTO activity_logs (
      profile_id, work_date, content, created_at, updated_at
    ) VALUES (
      999, '2026-01-01', 'Invalid owner',
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
    )
  `).run(),
);

assert.equal(database.prepare('PRAGMA foreign_key_check').all().length, 0);
assert.equal(database.prepare('PRAGMA quick_check').get().quick_check, 'ok');
assert.equal(database.prepare('PRAGMA user_version').get().user_version, 3);

database.prepare(`
  UPDATE profiles
  SET company_name = 'Persistence Check', job_title = 'Intern',
      internship_start_date = '2026-01-01', required_minutes = 24000,
      setup_completed_at = '2026-01-01T00:00:00.000Z'
  WHERE id = 1
`).run();
database.prepare(`
  INSERT INTO work_settings (
    profile_id, workdays_mask, work_start_minutes, work_end_minutes,
    target_minutes, default_break_minutes, timezone, time_format, date_format,
    created_at, updated_at
  ) VALUES (
    1, 62, 480, 900, 360, 60, 'Asia/Manila', '12h', 'mdy',
    '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
  )
`).run();

// Changing a future-session default must never rewrite historical attendance.
database.prepare('UPDATE work_settings SET default_break_minutes = 30 WHERE profile_id = 1').run();

database.close();

// Reopen the same file to simulate a full app/database restart.
database = new DatabaseSync(databasePath);
database.exec('PRAGMA foreign_keys = ON;');
const persistedSetup = database.prepare(`
  SELECT p.full_name, p.required_minutes, p.setup_completed_at,
         w.default_break_minutes, w.timezone
  FROM profiles p JOIN work_settings w ON w.profile_id = p.id
  WHERE p.id = 1
`).get();
assert.equal(persistedSetup.full_name, 'Schema Check');
assert.equal(persistedSetup.required_minutes, 24000);
assert.equal(persistedSetup.default_break_minutes, 30);
assert.equal(persistedSetup.timezone, 'Asia/Manila');
assert.ok(persistedSetup.setup_completed_at);
assert.equal(
  database.prepare('SELECT break_duration_seconds FROM attendance_sessions WHERE id = 1').get()
    .break_duration_seconds,
  3600,
);
assert.equal(database.prepare('PRAGMA quick_check').get().quick_check, 'ok');
database.close();
rmSync(testDirectory, { recursive: true, force: true });
console.log('Database migrations, invariants, and restart persistence validated successfully.');

