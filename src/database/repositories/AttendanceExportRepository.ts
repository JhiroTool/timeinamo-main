import type { Database } from '@/types/database';
import type { AttendanceEntrySource, AttendanceStatus } from '@/types/models';
import type { UtcTimestamp, WorkDate } from '@/types/time';
import { parseWorkDate } from '@/utils/time';

import { DatabaseOperationError } from '../errors';

export interface AttendanceExportRange {
  startDate?: WorkDate;
  endDate?: WorkDate;
}

export interface AttendanceExportRecord {
  id: number;
  workDate: WorkDate;
  clockInAt: UtcTimestamp;
  clockOutAt: UtcTimestamp | null;
  breakDurationSeconds: number;
  workedDurationSeconds: number | null;
  status: AttendanceStatus;
  entrySource: AttendanceEntrySource;
  isAdjusted: boolean;
  journalDescriptions: string[];
}

interface AttendanceExportRow {
  id: number;
  work_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  break_duration_seconds: number;
  worked_duration_seconds: number | null;
  status: AttendanceStatus;
  entry_source: AttendanceEntrySource;
  is_adjusted: number;
}

interface JournalDescriptionRow {
  work_date: string;
  content: string;
}

export class AttendanceExportRepository {
  constructor(private readonly database: Database) {}

  async list(
    profileId: number,
    range: AttendanceExportRange,
    includeJournalDescriptions: boolean,
  ): Promise<AttendanceExportRecord[]> {
    const conditions = ['session.profile_id = ?', 'session.deleted_at IS NULL'];
    const parameters: Array<string | number> = [profileId];
    if (range.startDate) {
      conditions.push('session.work_date >= ?');
      parameters.push(parseWorkDate(range.startDate));
    }
    if (range.endDate) {
      conditions.push('session.work_date <= ?');
      parameters.push(parseWorkDate(range.endDate));
    }
    if (range.startDate && range.endDate && range.startDate > range.endDate) {
      throw new DatabaseOperationError('The export start date must be before the end date.');
    }

    const rows = await this.database.getAllAsync<AttendanceExportRow>(
      `SELECT session.id, session.work_date, session.clock_in_at, session.clock_out_at,
              session.break_duration_seconds, session.worked_duration_seconds,
              session.status, session.entry_source,
              CASE WHEN EXISTS (
                SELECT 1 FROM attendance_corrections correction
                WHERE correction.attendance_session_id = session.id
              ) THEN 1 ELSE 0 END AS is_adjusted
       FROM attendance_sessions session
       WHERE ${conditions.join(' AND ')}
       ORDER BY session.work_date ASC, session.clock_in_at ASC`,
      ...parameters,
    );

    const descriptions = new Map<string, string[]>();
    if (includeJournalDescriptions && rows.length > 0) {
      const firstDate = rows[0]?.work_date;
      const lastDate = rows.at(-1)?.work_date;
      if (firstDate && lastDate) {
        const journalRows = await this.database.getAllAsync<JournalDescriptionRow>(
          `SELECT work_date, content FROM activity_logs
           WHERE profile_id = ? AND work_date >= ? AND work_date <= ?
           ORDER BY work_date ASC, created_at ASC, id ASC`,
          profileId,
          firstDate,
          lastDate,
        );
        for (const row of journalRows) {
          const existing = descriptions.get(row.work_date) ?? [];
          existing.push(row.content);
          descriptions.set(row.work_date, existing);
        }
      }
    }

    return rows.map((row) => ({
      id: row.id,
      workDate: row.work_date as WorkDate,
      clockInAt: row.clock_in_at as UtcTimestamp,
      clockOutAt: row.clock_out_at as UtcTimestamp | null,
      breakDurationSeconds: row.break_duration_seconds,
      workedDurationSeconds: row.worked_duration_seconds,
      status: row.status,
      entrySource: row.entry_source,
      isAdjusted: row.is_adjusted === 1,
      journalDescriptions: descriptions.get(row.work_date) ?? [],
    }));
  }
}
