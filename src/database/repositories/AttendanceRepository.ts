import type { Database } from '@/types/database';
import type { AttendanceSession } from '@/types/models';
import type { WorkDate } from '@/types/time';
import { toUtcTimestamp, toWorkDate } from '@/utils/time';
import { calculateAttendanceDurations } from '@/services/attendanceCalculations.js';

import { AttendanceConflictError, DatabaseOperationError } from '../errors';
import {
  mapAttendanceSession,
  type AttendanceSessionRow,
} from './rowMappers';

export interface StartAttendanceInput {
  profileId: number;
  timezone: string;
  defaultBreakSeconds: number;
  occurredAt?: Date | string;
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(error.message);
}

export class AttendanceRepository {
  constructor(private readonly database: Database) {}

  async getById(id: number): Promise<AttendanceSession | null> {
    const row = await this.database.getFirstAsync<AttendanceSessionRow>(
      'SELECT * FROM attendance_sessions WHERE id = ?',
      id,
    );
    return row ? mapAttendanceSession(row) : null;
  }

  async getForWorkDate(profileId: number, workDate: WorkDate): Promise<AttendanceSession | null> {
    const row = await this.database.getFirstAsync<AttendanceSessionRow>(
      'SELECT * FROM attendance_sessions WHERE profile_id = ? AND work_date = ?',
      profileId,
      workDate,
    );
    return row ? mapAttendanceSession(row) : null;
  }

  async getActive(profileId: number): Promise<AttendanceSession | null> {
    const row = await this.database.getFirstAsync<AttendanceSessionRow>(
      `SELECT * FROM attendance_sessions
       WHERE profile_id = ? AND status IN ('active', 'on_break')
       LIMIT 1`,
      profileId,
    );
    return row ? mapAttendanceSession(row) : null;
  }

  async listRecentCompleted(profileId: number, limit = 10): Promise<AttendanceSession[]> {
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const rows = await this.database.getAllAsync<AttendanceSessionRow>(
      `SELECT * FROM attendance_sessions
       WHERE profile_id = ? AND status = 'completed'
       ORDER BY work_date DESC, clock_in_at DESC LIMIT ?`,
      profileId,
      safeLimit,
    );
    return rows.map(mapAttendanceSession);
  }

  async start(input: StartAttendanceInput): Promise<AttendanceSession> {
    const clockInAt = toUtcTimestamp(input.occurredAt ?? new Date());
    const workDate = toWorkDate(clockInAt, input.timezone);
    if (!Number.isSafeInteger(input.defaultBreakSeconds) || input.defaultBreakSeconds < 0) {
      throw new DatabaseOperationError('Default unpaid break is invalid.');
    }
    let insertedId: number | null = null;
    try {
      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        const conflict = await transaction.getFirstAsync<{ id: number }>(
          `SELECT id FROM attendance_sessions
           WHERE profile_id = ? AND (work_date = ? OR status IN ('active', 'on_break'))
           LIMIT 1`,
          input.profileId,
          workDate,
        );
        if (conflict) throw new AttendanceConflictError();
        const result = await transaction.runAsync(
          `INSERT INTO attendance_sessions (
            profile_id, work_date, clock_in_at, break_duration_seconds,
            status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'active', ?, ?)`,
          input.profileId,
          workDate,
          clockInAt,
          input.defaultBreakSeconds,
          clockInAt,
          clockInAt,
        );
        insertedId = result.lastInsertRowId;
      });
      if (insertedId === null) throw new DatabaseOperationError('Attendance session was not created.');
      const session = await this.getById(insertedId);
      if (!session) throw new DatabaseOperationError('Attendance session could not be loaded.');
      return session;
    } catch (error) {
      if (error instanceof AttendanceConflictError) throw error;
      if (isUniqueConstraint(error)) throw new AttendanceConflictError(undefined, error);
      throw new DatabaseOperationError('Attendance session could not be started.', error);
    }
  }

  async startBreak(id: number, occurredAt: Date | string = new Date()): Promise<AttendanceSession> {
    const timestamp = toUtcTimestamp(occurredAt);
    const result = await this.database.runAsync(
      `UPDATE attendance_sessions
       SET status = 'on_break', break_started_at = ?, updated_at = ?
       WHERE id = ? AND status = 'active'`,
      timestamp,
      timestamp,
      id,
    );
    if (result.changes !== 1) {
      throw new DatabaseOperationError('Only an active session can start a break.');
    }
    const session = await this.getById(id);
    if (!session) throw new DatabaseOperationError('Attendance session could not be loaded.');
    return session;
  }

  async endBreak(id: number, occurredAt: Date | string = new Date()): Promise<AttendanceSession> {
    const endedAt = toUtcTimestamp(occurredAt);
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      const row = await transaction.getFirstAsync<AttendanceSessionRow>(
        `SELECT * FROM attendance_sessions WHERE id = ? AND status = 'on_break'`,
        id,
      );
      if (!row?.break_started_at) {
        throw new DatabaseOperationError('This session does not have an active break.');
      }
      const seconds = Math.floor(
        (new Date(endedAt).getTime() - new Date(row.break_started_at).getTime()) / 1000,
      );
      if (seconds < 0) throw new DatabaseOperationError('Break end cannot precede break start.');

      await transaction.runAsync(
        `UPDATE attendance_sessions
         SET status = 'active', break_started_at = NULL,
             break_duration_seconds = break_duration_seconds + ?, updated_at = ?
         WHERE id = ? AND status = 'on_break'`,
        seconds,
        endedAt,
        id,
      );
    });
    const session = await this.getById(id);
    if (!session) throw new DatabaseOperationError('Attendance session could not be loaded.');
    return session;
  }

  async complete(id: number, occurredAt: Date | string = new Date()): Promise<AttendanceSession> {
    const clockOutAt = toUtcTimestamp(occurredAt);
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      const row = await transaction.getFirstAsync<AttendanceSessionRow>(
        `SELECT * FROM attendance_sessions
         WHERE id = ? AND status IN ('active', 'on_break')`,
        id,
      );
      if (!row) throw new DatabaseOperationError('No active attendance session was found.');

      const elapsedSeconds = Math.floor(
        (new Date(clockOutAt).getTime() - new Date(row.clock_in_at).getTime()) / 1000,
      );
      let totalBreakSeconds = row.break_duration_seconds;
      if (row.break_started_at) {
        totalBreakSeconds += Math.floor(
          (new Date(clockOutAt).getTime() - new Date(row.break_started_at).getTime()) / 1000,
        );
      }
      const workedSeconds = elapsedSeconds - totalBreakSeconds;
      if (elapsedSeconds <= 0 || workedSeconds < 0) {
        throw new DatabaseOperationError('Clock-out time produces an invalid duration.');
      }

      await transaction.runAsync(
        `UPDATE attendance_sessions
         SET status = 'completed', clock_out_at = ?, break_started_at = NULL,
             break_duration_seconds = ?, worked_duration_seconds = ?, updated_at = ?
         WHERE id = ? AND status IN ('active', 'on_break')`,
        clockOutAt,
        totalBreakSeconds,
        workedSeconds,
        clockOutAt,
        id,
      );
    });
    const session = await this.getById(id);
    if (!session) throw new DatabaseOperationError('Attendance session could not be loaded.');
    return session;
  }

  async completeWithBreak(
    id: number,
    unpaidBreakSeconds: number,
    occurredAt: Date | string = new Date(),
  ): Promise<AttendanceSession> {
    const clockOutAt = toUtcTimestamp(occurredAt);
    try {
      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        const row = await transaction.getFirstAsync<AttendanceSessionRow>(
          `SELECT * FROM attendance_sessions
           WHERE id = ? AND status IN ('active', 'on_break')`,
          id,
        );
        if (!row) throw new DatabaseOperationError('This session is no longer active.');
        const durations = calculateAttendanceDurations(
          row.clock_in_at,
          clockOutAt,
          unpaidBreakSeconds,
        );
        const result = await transaction.runAsync(
          `UPDATE attendance_sessions
           SET status = 'completed', clock_out_at = ?, break_started_at = NULL,
               break_duration_seconds = ?, worked_duration_seconds = ?, updated_at = ?
           WHERE id = ? AND status IN ('active', 'on_break')`,
          clockOutAt,
          unpaidBreakSeconds,
          durations.creditedSeconds,
          clockOutAt,
          id,
        );
        if (result.changes !== 1) {
          throw new DatabaseOperationError('This session was already completed.');
        }
      });
    } catch (error) {
      if (error instanceof DatabaseOperationError) throw error;
      const message = error instanceof Error ? error.message : 'Attendance could not be completed.';
      throw new DatabaseOperationError(message, error);
    }
    const session = await this.getById(id);
    if (!session || session.status !== 'completed') {
      throw new DatabaseOperationError('Completed attendance could not be reloaded.');
    }
    return session;
  }
}

