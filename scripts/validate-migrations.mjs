import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { initialSchemaSql } from '../src/database/migrations/001_initial_schema.js';
import { attendanceInvariantsSql } from '../src/database/migrations/002_attendance_invariants.js';
import { setupPreferencesSql } from '../src/database/migrations/003_setup_preferences.js';
import { attendanceHistorySql } from '../src/database/migrations/004_attendance_history.js';
import { journalReportingSql } from '../src/database/migrations/005_journal_reporting.js';
import { performanceIndexesSql } from '../src/database/migrations/006_performance_indexes.js';
import { calculateAttendanceDurations } from '../src/services/attendanceCalculations.js';
import {
  buildRecentWeeklyTotals,
  calculateOjtProgress,
  formatProgressHours,
  getMondayWeekStart,
} from '../src/services/ojtProgressCalculations.js';
import {
  buildAttendanceCsv,
  createAttendanceCsvFilename,
  escapeCsvCell,
  protectSpreadsheetCell,
} from '../src/services/csvExport.js';

const migrations = [
  { version: 1, name: 'initial_schema', sql: initialSchemaSql },
  { version: 2, name: 'attendance_invariants', sql: attendanceInvariantsSql },
  { version: 3, name: 'setup_preferences', sql: setupPreferencesSql },
  { version: 4, name: 'attendance_history', sql: attendanceHistorySql },
  { version: 5, name: 'journal_reporting', sql: journalReportingSql },
  { version: 6, name: 'performance_indexes', sql: performanceIndexesSql },
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
for (const index of [
  'uq_attendance_session_workday',
  'uq_attendance_single_active',
  'idx_activity_logs_profile_search',
  'idx_activity_logs_attendance',
  'idx_attendance_completed_timeline',
  'idx_activity_logs_profile_timeline',
]) {
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

const duplicateTimeOut = database.prepare(`
  UPDATE attendance_sessions
  SET clock_out_at = '2026-01-01T09:00:00.000Z'
  WHERE id = 1 AND status IN ('active', 'on_break')
`).run();
assert.equal(duplicateTimeOut.changes, 0);

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

const correctDurations = calculateAttendanceDurations(
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T07:00:00.000Z',
  3600,
);
assert.deepEqual(correctDurations, { elapsedSeconds: 25200, creditedSeconds: 21600 });
assert.throws(() =>
  calculateAttendanceDurations(
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T01:00:00.000Z',
    -1,
  ),
);

const emptyProgress = calculateOjtProgress(0, 24000, 0, 360);
assert.equal(emptyProgress.percentage, 0);
assert.equal(emptyProgress.remainingSeconds, 1440000);
assert.equal(emptyProgress.estimatedRemainingWorkdays, 67);
assert.equal(emptyProgress.averageSecondsPerDay, 0);

const partialProgress = calculateOjtProgress(1080000, 24000, 50, 360);
assert.equal(partialProgress.percentage, 75);
assert.equal(partialProgress.remainingSeconds, 360000);
assert.equal(partialProgress.estimatedRemainingWorkdays, 17);
assert.equal(partialProgress.averageSecondsPerDay, 21600);

const exactProgress = calculateOjtProgress(1440000, 24000, 60, null);
assert.equal(exactProgress.percentage, 100);
assert.equal(exactProgress.goalCompleted, true);
assert.equal(exactProgress.estimatedRemainingWorkdays, 0);
const unscheduledProgress = calculateOjtProgress(1080000, 24000, 50, null);
assert.equal(unscheduledProgress.remainingSeconds, partialProgress.remainingSeconds);
assert.equal(unscheduledProgress.estimatedRemainingWorkdays, null);
assert.throws(() => calculateOjtProgress(1080000, 24000, 50, 0));
assert.equal(formatProgressHours(0), '0');
assert.equal(formatProgressHours(60), '<0.1');
assert.equal(formatProgressHours(455400), '126.5');

const exceededProgress = calculateOjtProgress(1620000, 24000, 60, 360);
assert.equal(exceededProgress.percentage, 112.5);
assert.equal(exceededProgress.remainingSeconds, 0);
assert.equal(exceededProgress.estimatedRemainingWorkdays, 0);
assert.equal(exceededProgress.goalCompleted, true);

assert.equal(getMondayWeekStart('2026-11-22'), '2026-11-16');
assert.deepEqual(
  buildRecentWeeklyTotals(
    [
      { workDate: '2026-11-16', creditedSeconds: 3600 },
      { workDate: '2026-11-22', creditedSeconds: 7200 },
      { workDate: '2026-11-23', creditedSeconds: 1800 },
      { workDate: '2026-11-23', creditedSeconds: 3600 },
    ],
    '2026-11-23',
    3,
  ),
  [
    { weekStart: '2026-11-09', creditedSeconds: 0, completedWorkdays: 0 },
    { weekStart: '2026-11-16', creditedSeconds: 10800, completedWorkdays: 2 },
    { weekStart: '2026-11-23', creditedSeconds: 5400, completedWorkdays: 1 },
  ],
);
assert.throws(() =>
  calculateAttendanceDurations(
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T01:00:00.000Z',
    1.5,
  ),
);
assert.throws(() =>
  calculateAttendanceDurations(
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T01:00:00.000Z',
    3601,
  ),
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
assert.equal(database.prepare('PRAGMA user_version').get().user_version, 6);

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

// Create manual and automatic completed records for history/filter testing.
database.prepare(`
  INSERT INTO attendance_sessions (
    profile_id, work_date, clock_in_at, clock_out_at, break_duration_seconds,
    worked_duration_seconds, status, entry_source, created_at, updated_at
  ) VALUES (
    1, '2026-01-02', '2026-01-02T00:00:00.000Z', '2026-01-02T07:00:00.000Z',
    3600, 21600, 'completed', 'manual',
    '2026-01-02T07:00:00.000Z', '2026-01-02T07:00:00.000Z'
  )
`).run();

// Journal supports multiple entries per date, optional attendance links, and required fields.
const insertJournal = database.prepare(`
  INSERT INTO activity_logs (
    profile_id, work_date, title, content, notes, attendance_session_id, created_at, updated_at
  ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
`);
insertJournal.run(
  '2026-01-02',
  'API integration',
  'Connected the mobile form to the local API.',
  'Review validation',
  2,
  '2026-01-02T08:00:00.000Z',
  '2026-01-02T08:00:00.000Z',
);
insertJournal.run(
  '2026-01-02',
  'Documentation',
  '=HYPERLINK("unsafe") and wrote release notes, examples',
  null,
  null,
  '2026-01-02T09:00:00.000Z',
  '2026-01-02T09:00:00.000Z',
);
assert.equal(
  database.prepare("SELECT COUNT(*) AS count FROM activity_logs WHERE work_date = '2026-01-02'").get().count,
  2,
);
assert.equal(
  database
    .prepare("SELECT COUNT(*) AS count FROM activity_logs WHERE title LIKE '%integration%' COLLATE NOCASE OR content LIKE '%integration%' COLLATE NOCASE")
    .get().count,
  1,
);
assert.equal(
  database
    .prepare("SELECT COUNT(*) AS count FROM activity_logs WHERE title LIKE '%release%' COLLATE NOCASE OR content LIKE '%release%' COLLATE NOCASE")
    .get().count,
  1,
);

const completedTimelinePlan = database.prepare(`
  EXPLAIN QUERY PLAN
  SELECT * FROM attendance_sessions INDEXED BY idx_attendance_completed_timeline
  WHERE profile_id = ? AND deleted_at IS NULL AND status = 'completed'
  ORDER BY work_date DESC, clock_in_at DESC LIMIT 3
`).all(1).map((step) => step.detail).join(' ');
assert.match(completedTimelinePlan, /idx_attendance_completed_timeline/);

const journalTimelinePlan = database.prepare(`
  EXPLAIN QUERY PLAN
  SELECT * FROM activity_logs
  WHERE profile_id = ?
  ORDER BY work_date DESC, created_at DESC, id DESC LIMIT 40 OFFSET 0
`).all(1).map((step) => step.detail).join(' ');
assert.match(journalTimelinePlan, /idx_activity_logs_profile_timeline/);

database.exec('SAVEPOINT journal_pagination_fixture;');
for (let index = 0; index < 118; index += 1) {
  const minute = String(Math.floor(index / 60)).padStart(2, '0');
  const second = String(index % 60).padStart(2, '0');
  const timestamp = `2026-01-02T10:${minute}:${second}.000Z`;
  insertJournal.run(
    '2026-01-02',
    `Pagination entry ${index + 1}`,
    `Synthetic journal description ${index + 1}`,
    null,
    null,
    timestamp,
    timestamp,
  );
}
const journalFixtureCount = database.prepare('SELECT COUNT(*) AS count FROM activity_logs').get().count;
const firstJournalPage = database.prepare(`
  SELECT id FROM activity_logs
  WHERE profile_id = 1
  ORDER BY work_date DESC, created_at DESC, id DESC LIMIT 40 OFFSET 0
`).all();
const secondJournalPage = database.prepare(`
  SELECT id FROM activity_logs
  WHERE profile_id = 1
  ORDER BY work_date DESC, created_at DESC, id DESC LIMIT 40 OFFSET 40
`).all();
assert.equal(journalFixtureCount, 120);
assert.equal(firstJournalPage.length, 40);
assert.equal(secondJournalPage.length, 40);
assert.equal(new Set([...firstJournalPage, ...secondJournalPage].map((row) => row.id)).size, 80);
database.exec('ROLLBACK TO journal_pagination_fixture; RELEASE journal_pagination_fixture;');
assert.throws(() =>
  insertJournal.run(
    '2026-01-03',
    '   ',
    'Missing title',
    null,
    null,
    '2026-01-03T09:00:00.000Z',
    '2026-01-03T09:00:00.000Z',
  ),
);
database.prepare("UPDATE activity_logs SET notes = 'Updated offline' WHERE title = 'API integration'").run();

assert.equal(protectSpreadsheetCell(' =SUM(A1:A2)'), "' =SUM(A1:A2)");
assert.equal(protectSpreadsheetCell('ordinary text'), 'ordinary text');
assert.equal(escapeCsvCell('quote " and, comma'), '"quote "" and, comma"');
assert.equal(createAttendanceCsvFilename('2026-11'), 'TimeInamo_Attendance_2026-11.csv');
const csv = buildAttendanceCsv(
  [
    {
      workDate: '2026-01-02',
      clockInAt: '2026-01-02T00:00:00.000Z',
      clockOutAt: '2026-01-02T07:00:00.000Z',
      breakDurationSeconds: 3600,
      workedDurationSeconds: 21600,
      status: 'completed',
      entrySource: 'manual',
      isAdjusted: true,
      journalDescriptions: ['=HYPERLINK("unsafe")', 'Line one\nLine two'],
    },
  ],
  { timezone: 'Asia/Manila', includeJournalDescriptions: true },
);
assert.match(csv, /08:00:00,15:00:00,60\.00,7\.00,6\.00,Completed,Manual,Yes/);
assert.match(csv, /"'=HYPERLINK\(""unsafe""\)\nLine one\nLine two"/);
database.prepare(`
  INSERT INTO attendance_sessions (
    profile_id, work_date, clock_in_at, clock_out_at, break_duration_seconds,
    worked_duration_seconds, status, created_at, updated_at
  ) VALUES (
    1, '2026-01-03', '2026-01-03T00:00:00.000Z', '2026-01-03T07:00:00.000Z',
    3600, 21600, 'completed',
    '2026-01-03T07:00:00.000Z', '2026-01-03T07:00:00.000Z'
  )
`).run();

// Overlap is rejected independently of work-date uniqueness.
assert.throws(
  () =>
    database.prepare(`
      INSERT INTO attendance_sessions (
        profile_id, work_date, clock_in_at, clock_out_at, break_duration_seconds,
        worked_duration_seconds, status, entry_source, created_at, updated_at
      ) VALUES (
        1, '2026-01-05', '2026-01-02T01:00:00.000Z', '2026-01-02T02:00:00.000Z',
        0, 3600, 'completed', 'manual',
        '2026-01-02T02:00:00.000Z', '2026-01-02T02:00:00.000Z'
      )
    `).run(),
  /overlaps an existing record/,
);

// An incomplete session must still exist after a full database/app restart.
insertSession.run(
  '2026-01-04',
  '2026-01-04T00:00:00.000Z',
  '2026-01-04T00:00:00.000Z',
  '2026-01-04T00:00:00.000Z',
);

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
  database.prepare("SELECT notes FROM activity_logs WHERE title = 'API integration'").get().notes,
  'Updated offline',
);
assert.equal(
  database
    .prepare("SELECT work_date FROM attendance_sessions WHERE status IN ('active', 'on_break')")
    .get().work_date,
  '2026-01-04',
);

// Edit the manual record and preserve both old/new values in the audit trail.
database.exec('BEGIN EXCLUSIVE;');
database.prepare(`
  UPDATE attendance_sessions
  SET break_duration_seconds = 1800, worked_duration_seconds = 23400,
      updated_at = '2026-01-05T00:00:00.000Z'
  WHERE id = 2
`).run();
database.prepare(`
  INSERT INTO attendance_corrections (
    attendance_session_id, field_name, old_value, new_value, reason, created_at
  ) VALUES
    (2, 'break_duration_seconds', '3600', '1800', 'Corrected unpaid break', '2026-01-05T00:00:00.000Z'),
    (2, 'worked_duration_seconds', '21600', '23400', 'Corrected unpaid break', '2026-01-05T00:00:00.000Z')
`).run();
database.exec('COMMIT;');
assert.equal(
  database.prepare('SELECT COUNT(*) AS count FROM attendance_corrections WHERE attendance_session_id = 2').get()
    .count,
  2,
);
assert.equal(
  database.prepare(`
    SELECT COUNT(*) AS count FROM attendance_sessions session
    WHERE session.deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM attendance_corrections correction
      WHERE correction.attendance_session_id = session.id
    )
  `).get().count,
  1,
);
assert.deepEqual(
  { ...database.prepare(`
    SELECT
      COUNT(*) AS all_count,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
      SUM(CASE WHEN status <> 'completed' THEN 1 ELSE 0 END) AS incomplete_count,
      SUM(CASE WHEN status = 'completed' THEN worked_duration_seconds ELSE 0 END) AS credited
    FROM attendance_sessions
    WHERE deleted_at IS NULL AND work_date >= '2026-01-01' AND work_date < '2026-02-01'
  `).get() },
  { all_count: 4, completed_count: 3, incomplete_count: 1, credited: 70200 },
);

// Soft deletion removes the record from filters/totals but retains its audit row.
database.exec('BEGIN EXCLUSIVE;');
database.prepare(`
  UPDATE attendance_sessions
  SET deleted_at = '2026-01-06T00:00:00.000Z', updated_at = '2026-01-06T00:00:00.000Z'
  WHERE id = 3
`).run();
database.prepare(`
  INSERT INTO attendance_corrections (
    attendance_session_id, field_name, old_value, new_value, reason, created_at
  ) VALUES (3, 'status', 'completed', 'deleted', 'Record deleted by user', '2026-01-06T00:00:00.000Z')
`).run();
database.exec('COMMIT;');
assert.equal(
  database.prepare('SELECT COUNT(*) AS count FROM attendance_sessions WHERE deleted_at IS NULL').get().count,
  3,
);
assert.equal(
  database.prepare('SELECT COUNT(*) AS count FROM attendance_corrections WHERE attendance_session_id = 3').get()
    .count,
  1,
);
assert.equal(
  database.prepare(`
    SELECT SUM(worked_duration_seconds) AS total FROM attendance_sessions
    WHERE deleted_at IS NULL AND status = 'completed'
  `).get().total,
  48600,
);
assert.equal(
  database.prepare(`
    SELECT COUNT(*) AS count FROM attendance_sessions
    WHERE deleted_at IS NULL AND status = 'completed'
  `).get().count,
  2,
);
assert.equal(
  database
    .prepare("SELECT COALESCE(SUM(worked_duration_seconds), 0) AS total FROM attendance_sessions WHERE status = 'completed'")
    .get().total,
  70200,
);
assert.equal(
  database.prepare("SELECT worked_duration_seconds FROM attendance_sessions WHERE status = 'active'").get()
    .worked_duration_seconds,
  null,
);
assert.equal(
  database.prepare('SELECT break_duration_seconds FROM attendance_sessions WHERE id = 1').get()
    .break_duration_seconds,
  3600,
);
assert.equal(database.prepare('PRAGMA quick_check').get().quick_check, 'ok');
database.prepare("DELETE FROM activity_logs WHERE title = 'Documentation'").run();
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM activity_logs').get().count, 1);

// Settings' confirmed Delete All action relies on the profile ownership cascade.
database.exec('BEGIN;');
database.prepare('DELETE FROM profiles').run();
for (const table of [
  'profiles',
  'work_settings',
  'attendance_sessions',
  'attendance_corrections',
  'activity_logs',
]) {
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0);
}
database.exec('ROLLBACK;');
database.close();
rmSync(testDirectory, { recursive: true, force: true });
console.log(
  'Database integrity, indexed query plans, 120-row journal pagination (40-row pages), CRUD/search/persistence, CSV safety/accuracy, progress calculations, and restart persistence validated successfully.',
);

