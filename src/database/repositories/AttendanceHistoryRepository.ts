import type { Database } from '@/types/database';
import type { AttendanceCorrection, AttendanceSession } from '@/types/models';
import type { UtcTimestamp, WorkDate } from '@/types/time';
import { calculateAttendanceDurations } from '@/services/attendanceCalculations.js';
import { parseWorkDate, toUtcTimestamp, toWorkDate } from '@/utils/time';

import { DatabaseOperationError } from '../errors';
import {
  mapAttendanceCorrection,
  mapAttendanceSession,
  type AttendanceCorrectionRow,
  type AttendanceSessionRow,
} from './rowMappers';

export type AttendanceHistoryFilter = 'all' | 'completed' | 'incomplete' | 'adjusted';

export interface AttendanceHistoryRecord extends AttendanceSession {
  isAdjusted: boolean;
}

export interface AttendanceMonthSummary {
  creditedSeconds: number;
  completedWorkdays: number;
  incompleteCount: number;
}

export interface AttendanceMonthResult {
  records: AttendanceHistoryRecord[];
  summary: AttendanceMonthSummary;
}

export interface AttendanceDetails {
  record: AttendanceHistoryRecord;
  corrections: AttendanceCorrection[];
}

export interface ManualAttendanceInput {
  profileId: number;
  workDate: WorkDate;
  clockInAt: UtcTimestamp;
  clockOutAt: UtcTimestamp;
  unpaidBreakSeconds: number;
  timezone: string;
}

interface HistoryRow extends AttendanceSessionRow {
  is_adjusted: number;
}

function mapHistoryRow(row: HistoryRow): AttendanceHistoryRecord {
  return { ...mapAttendanceSession(row), isAdjusted: row.is_adjusted === 1 };
}

function monthRange(month: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new RangeError('Month must use YYYY-MM.');
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new RangeError('Month is invalid.');
  const next = new Date(Date.UTC(year, monthIndex + 1, 1));
  return {
    start: `${match[1]}-${match[2]}-01`,
    end: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`,
  };
}

function validateInput(input: ManualAttendanceInput) {
  const workDate = parseWorkDate(input.workDate);
  const clockInAt = toUtcTimestamp(input.clockInAt);
  const clockOutAt = toUtcTimestamp(input.clockOutAt);
  if (toWorkDate(clockInAt, input.timezone) !== workDate) {
    throw new DatabaseOperationError('Time In must fall on the selected work date.');
  }
  const now = new Date();
  if (new Date(clockInAt) > now || new Date(clockOutAt) > now) {
    throw new DatabaseOperationError('Future attendance entries are not allowed.');
  }
  if (workDate > toWorkDate(now, input.timezone)) {
    throw new DatabaseOperationError('Future work dates are not allowed.');
  }
  try {
    return calculateAttendanceDurations(clockInAt, clockOutAt, input.unpaidBreakSeconds);
  } catch (error) {
    throw new DatabaseOperationError(
      error instanceof Error ? error.message : 'Attendance duration is invalid.',
      error,
    );
  }
}

function mapConstraintError(error: unknown): DatabaseOperationError {
  const message = error instanceof Error ? error.message : '';
  if (/overlaps an existing record/i.test(message)) {
    return new DatabaseOperationError('This time range overlaps another attendance record.', error);
  }
  if (/UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(message)) {
    return new DatabaseOperationError('An attendance record already exists for this workday.', error);
  }
  return new DatabaseOperationError('Attendance changes could not be saved.', error);
}

export class AttendanceHistoryRepository {
  constructor(private readonly database: Database) {}

  async getMonth(
    profileId: number,
    month: string,
    filter: AttendanceHistoryFilter,
  ): Promise<AttendanceMonthResult> {
    const range = monthRange(month);
    const rows = await this.database.getAllAsync<HistoryRow>(
      `SELECT session.*,
        CASE WHEN EXISTS (
          SELECT 1 FROM attendance_corrections correction
          WHERE correction.attendance_session_id = session.id
        ) THEN 1 ELSE 0 END AS is_adjusted
       FROM attendance_sessions session
       WHERE session.profile_id = ? AND session.deleted_at IS NULL
         AND session.work_date >= ? AND session.work_date < ?
       ORDER BY session.work_date DESC, session.clock_in_at DESC`,
      profileId,
      range.start,
      range.end,
    );
    const allRecords = rows.map(mapHistoryRow);
    const summary = allRecords.reduce<AttendanceMonthSummary>(
      (current, record) => {
        if (record.status === 'completed') {
          current.completedWorkdays += 1;
          current.creditedSeconds += record.workedDurationSeconds ?? 0;
        } else {
          current.incompleteCount += 1;
        }
        return current;
      },
      { creditedSeconds: 0, completedWorkdays: 0, incompleteCount: 0 },
    );
    const records = allRecords.filter((record) => {
      if (filter === 'completed') return record.status === 'completed';
      if (filter === 'incomplete') return record.status !== 'completed';
      if (filter === 'adjusted') return record.isAdjusted;
      return true;
    });
    return { records, summary };
  }

  async getDetails(id: number): Promise<AttendanceDetails | null> {
    const row = await this.database.getFirstAsync<HistoryRow>(
      `SELECT session.*,
        CASE WHEN EXISTS (
          SELECT 1 FROM attendance_corrections correction
          WHERE correction.attendance_session_id = session.id
        ) THEN 1 ELSE 0 END AS is_adjusted
       FROM attendance_sessions session
       WHERE session.id = ? AND session.deleted_at IS NULL`,
      id,
    );
    if (!row) return null;
    const corrections = await this.database.getAllAsync<AttendanceCorrectionRow>(
      `SELECT * FROM attendance_corrections
       WHERE attendance_session_id = ? ORDER BY created_at DESC, id DESC`,
      id,
    );
    return { record: mapHistoryRow(row), corrections: corrections.map(mapAttendanceCorrection) };
  }

  async createManual(input: ManualAttendanceInput): Promise<AttendanceHistoryRecord> {
    const durations = validateInput(input);
    const now = toUtcTimestamp();
    let insertedId: number | null = null;
    try {
      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        const result = await transaction.runAsync(
          `INSERT INTO attendance_sessions (
            profile_id, work_date, clock_in_at, clock_out_at,
            break_duration_seconds, worked_duration_seconds, status,
            entry_source, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'completed', 'manual', ?, ?)`,
          input.profileId,
          input.workDate,
          input.clockInAt,
          input.clockOutAt,
          input.unpaidBreakSeconds,
          durations.creditedSeconds,
          now,
          now,
        );
        insertedId = result.lastInsertRowId;
      });
    } catch (error) {
      throw mapConstraintError(error);
    }
    if (insertedId === null) throw new DatabaseOperationError('Manual attendance was not created.');
    const details = await this.getDetails(insertedId);
    if (!details) throw new DatabaseOperationError('Created attendance could not be reloaded.');
    return details.record;
  }

  async update(
    id: number,
    input: ManualAttendanceInput,
    reason: string,
  ): Promise<AttendanceHistoryRecord> {
    const correctionReason = reason.trim();
    if (correctionReason.length < 5) {
      throw new DatabaseOperationError('A correction reason of at least 5 characters is required.');
    }
    const durations = validateInput(input);
    const correctedAt = toUtcTimestamp();
    try {
      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        const existing = await transaction.getFirstAsync<AttendanceSessionRow>(
          'SELECT * FROM attendance_sessions WHERE id = ? AND deleted_at IS NULL',
          id,
        );
        if (!existing) throw new DatabaseOperationError('Attendance record was not found.');

        const candidateChanges: Array<{
          field: AttendanceCorrection['fieldName'];
          oldValue: string | null;
          newValue: string | null;
        }> = [
          { field: 'work_date', oldValue: existing.work_date, newValue: input.workDate },
          { field: 'clock_in_at', oldValue: existing.clock_in_at, newValue: input.clockInAt },
          { field: 'clock_out_at', oldValue: existing.clock_out_at, newValue: input.clockOutAt },
          {
            field: 'break_duration_seconds',
            oldValue: String(existing.break_duration_seconds),
            newValue: String(input.unpaidBreakSeconds),
          },
          {
            field: 'worked_duration_seconds',
            oldValue:
              existing.worked_duration_seconds === null
                ? null
                : String(existing.worked_duration_seconds),
            newValue: String(durations.creditedSeconds),
          },
          { field: 'status', oldValue: existing.status, newValue: 'completed' },
        ];
        const changes = candidateChanges.filter((change) => change.oldValue !== change.newValue);
        if (changes.length === 0) {
          throw new DatabaseOperationError('No attendance values were changed.');
        }

        const result = await transaction.runAsync(
          `UPDATE attendance_sessions SET
            work_date = ?, clock_in_at = ?, clock_out_at = ?, break_started_at = NULL,
            break_duration_seconds = ?, worked_duration_seconds = ?, status = 'completed',
            updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
          input.workDate,
          input.clockInAt,
          input.clockOutAt,
          input.unpaidBreakSeconds,
          durations.creditedSeconds,
          correctedAt,
          id,
        );
        if (result.changes !== 1) throw new DatabaseOperationError('Attendance update failed.');

        for (const change of changes) {
          await transaction.runAsync(
            `INSERT INTO attendance_corrections (
              attendance_session_id, field_name, old_value, new_value, reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            id,
            change.field,
            change.oldValue,
            change.newValue,
            correctionReason,
            correctedAt,
          );
        }
      });
    } catch (error) {
      if (error instanceof DatabaseOperationError) throw error;
      throw mapConstraintError(error);
    }
    const details = await this.getDetails(id);
    if (!details) throw new DatabaseOperationError('Updated attendance could not be reloaded.');
    return details.record;
  }

  async delete(id: number): Promise<void> {
    const deletedAt = toUtcTimestamp();
    try {
      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        const existing = await transaction.getFirstAsync<AttendanceSessionRow>(
          'SELECT * FROM attendance_sessions WHERE id = ? AND deleted_at IS NULL',
          id,
        );
        if (!existing) throw new DatabaseOperationError('Attendance record was not found.');
        const result = await transaction.runAsync(
          `UPDATE attendance_sessions
           SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
          deletedAt,
          deletedAt,
          id,
        );
        if (result.changes !== 1) throw new DatabaseOperationError('Attendance delete failed.');
        await transaction.runAsync(
          `INSERT INTO attendance_corrections (
            attendance_session_id, field_name, old_value, new_value, reason, created_at
          ) VALUES (?, 'status', ?, 'deleted', 'Record deleted by user', ?)`,
          id,
          existing.status,
          deletedAt,
        );
      });
    } catch (error) {
      if (error instanceof DatabaseOperationError) throw error;
      throw new DatabaseOperationError('Attendance record could not be deleted.', error);
    }
  }
}

