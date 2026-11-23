import type { Database } from '@/types/database';
import type { ActivityLog, AttendanceSession } from '@/types/models';
import type { WorkDate } from '@/types/time';
import { parseWorkDate, toUtcTimestamp } from '@/utils/time';

import { DatabaseOperationError } from '../errors';
import {
  mapActivityLog,
  mapAttendanceSession,
  type ActivityLogRow,
  type AttendanceSessionRow,
} from './rowMappers';

export interface ActivityLogQuery {
  search?: string;
  workDate?: WorkDate | null;
}

export interface SaveActivityLogInput {
  id?: number;
  profileId: number;
  workDate: WorkDate;
  title: string;
  content: string;
  notes?: string | null;
  attendanceSessionId?: number | null;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export class ActivityLogRepository {
  constructor(private readonly database: Database) {}

  async list(profileId: number, query: ActivityLogQuery = {}): Promise<ActivityLog[]> {
    const conditions = ['profile_id = ?'];
    const parameters: Array<string | number> = [profileId];
    if (query.workDate) {
      conditions.push('work_date = ?');
      parameters.push(parseWorkDate(query.workDate));
    }
    const search = query.search?.trim();
    if (search) {
      conditions.push(
        `(title LIKE ? ESCAPE '\\' COLLATE NOCASE OR content LIKE ? ESCAPE '\\' COLLATE NOCASE)`,
      );
      const pattern = `%${escapeLike(search)}%`;
      parameters.push(pattern, pattern);
    }
    const rows = await this.database.getAllAsync<ActivityLogRow>(
      `SELECT activity.*,
          (
            SELECT session.worked_duration_seconds
            FROM attendance_sessions session
            WHERE session.id = activity.attendance_session_id AND session.deleted_at IS NULL
          ) AS attendance_credited_seconds
       FROM activity_logs activity
       WHERE ${conditions.join(' AND ')}
       ORDER BY work_date DESC, created_at DESC, id DESC`,
      ...parameters,
    );
    return rows.map(mapActivityLog);
  }

  async listForWorkDate(profileId: number, workDate: WorkDate): Promise<ActivityLog[]> {
    return this.list(profileId, { workDate });
  }

  async getAttendanceForDate(
    profileId: number,
    workDate: WorkDate,
  ): Promise<AttendanceSession | null> {
    const row = await this.database.getFirstAsync<AttendanceSessionRow>(
      `SELECT * FROM attendance_sessions
       WHERE profile_id = ? AND work_date = ? AND deleted_at IS NULL
       ORDER BY id DESC LIMIT 1`,
      profileId,
      parseWorkDate(workDate),
    );
    return row ? mapAttendanceSession(row) : null;
  }

  async save(input: SaveActivityLogInput): Promise<ActivityLog> {
    const workDate = parseWorkDate(input.workDate);
    const title = input.title.trim();
    const content = input.content.trim();
    const notes = input.notes?.trim() || null;
    if (!title) throw new DatabaseOperationError('Activity title is required.');
    if (!content) throw new DatabaseOperationError('Activity description is required.');
    const now = toUtcTimestamp();
    let savedId = input.id;

    try {
      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        if (input.attendanceSessionId !== null && input.attendanceSessionId !== undefined) {
          const attendance = await transaction.getFirstAsync<{ id: number }>(
            `SELECT id FROM attendance_sessions
             WHERE id = ? AND profile_id = ? AND work_date = ? AND deleted_at IS NULL`,
            input.attendanceSessionId,
            input.profileId,
            workDate,
          );
          if (!attendance) {
            throw new DatabaseOperationError(
              'The selected attendance record is no longer available for this date.',
            );
          }
        }

        if (savedId === undefined) {
          const result = await transaction.runAsync(
            `INSERT INTO activity_logs (
              profile_id, work_date, title, content, notes, attendance_session_id,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            input.profileId,
            workDate,
            title,
            content,
            notes,
            input.attendanceSessionId ?? null,
            now,
            now,
          );
          savedId = result.lastInsertRowId;
        } else {
          const result = await transaction.runAsync(
            `UPDATE activity_logs
             SET work_date = ?, title = ?, content = ?, notes = ?,
                 attendance_session_id = ?, updated_at = ?
             WHERE id = ? AND profile_id = ?`,
            workDate,
            title,
            content,
            notes,
            input.attendanceSessionId ?? null,
            now,
            savedId,
            input.profileId,
          );
          if (result.changes !== 1) {
            throw new DatabaseOperationError('Activity entry was not found.');
          }
        }
      });
    } catch (error) {
      if (error instanceof DatabaseOperationError) throw error;
      throw new DatabaseOperationError('Activity entry could not be saved.', error);
    }

    if (savedId === undefined) {
      throw new DatabaseOperationError('Activity entry could not be saved.');
    }
    const row = await this.database.getFirstAsync<ActivityLogRow>(
      'SELECT * FROM activity_logs WHERE id = ? AND profile_id = ?',
      savedId,
      input.profileId,
    );
    if (!row) throw new DatabaseOperationError('Activity entry could not be loaded.');
    return mapActivityLog(row);
  }

  async remove(id: number, profileId: number): Promise<void> {
    const result = await this.database.runAsync(
      'DELETE FROM activity_logs WHERE id = ? AND profile_id = ?',
      id,
      profileId,
    );
    if (result.changes !== 1) throw new DatabaseOperationError('Activity entry was not found.');
  }
}
