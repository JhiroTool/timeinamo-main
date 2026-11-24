import type { Database } from '@/types/database';
import type { AttendanceSession } from '@/types/models';
import type { WorkDate } from '@/types/time';

import { mapAttendanceSession, type AttendanceSessionRow } from './rowMappers';

export interface CreditedDayRow {
  workDate: WorkDate;
  creditedSeconds: number;
}

export interface OjtInsightsSnapshot {
  today: AttendanceSession | null;
  latestRecords: AttendanceSession[];
  completedSeconds: number;
  completedWorkdays: number;
  creditedDays: CreditedDayRow[];
}

interface SummaryRow {
  completed_seconds: number;
  completed_workdays: number;
}

interface CreditedRow {
  work_date: string;
  credited_seconds: number;
}

export class OjtInsightsRepository {
  constructor(private readonly database: Database) {}

  async getSnapshot(
    profileId: number,
    today: WorkDate,
    weeklyFrom: WorkDate,
  ): Promise<OjtInsightsSnapshot> {
    const [latestRows, summary, creditedRows] = await Promise.all([
      this.database.getAllAsync<AttendanceSessionRow>(
        `SELECT * FROM attendance_sessions
         WHERE profile_id = ? AND deleted_at IS NULL
         ORDER BY work_date DESC, clock_in_at DESC LIMIT 3`,
        profileId,
      ),
      this.database.getFirstAsync<SummaryRow>(
        `SELECT
          COALESCE(SUM(worked_duration_seconds), 0) AS completed_seconds,
          COUNT(*) AS completed_workdays
         FROM attendance_sessions
         WHERE profile_id = ? AND deleted_at IS NULL AND status = 'completed'`,
        profileId,
      ),
      this.database.getAllAsync<CreditedRow>(
        `SELECT work_date, worked_duration_seconds AS credited_seconds
         FROM attendance_sessions
         WHERE profile_id = ? AND deleted_at IS NULL AND status = 'completed'
           AND work_date >= ?
         ORDER BY work_date ASC`,
        profileId,
        weeklyFrom,
      ),
    ]);
    const todayRow = latestRows.find((row) => row.work_date === today);

    return {
      today: todayRow ? mapAttendanceSession(todayRow) : null,
      latestRecords: latestRows.map(mapAttendanceSession),
      completedSeconds: summary?.completed_seconds ?? 0,
      completedWorkdays: summary?.completed_workdays ?? 0,
      creditedDays: creditedRows.map((row) => ({
        workDate: row.work_date as WorkDate,
        creditedSeconds: row.credited_seconds,
      })),
    };
  }
}

