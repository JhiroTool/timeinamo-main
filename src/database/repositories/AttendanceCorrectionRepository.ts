import type { Database } from '@/types/database';
import type { AttendanceCorrection, CorrectableAttendanceField } from '@/types/models';
import { toUtcTimestamp } from '@/utils/time';

import { DatabaseOperationError } from '../errors';
import {
  mapAttendanceCorrection,
  type AttendanceCorrectionRow,
} from './rowMappers';

export interface RecordCorrectionInput {
  attendanceSessionId: number;
  fieldName: CorrectableAttendanceField;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
}

export class AttendanceCorrectionRepository {
  constructor(private readonly database: Database) {}

  async listForSession(attendanceSessionId: number): Promise<AttendanceCorrection[]> {
    const rows = await this.database.getAllAsync<AttendanceCorrectionRow>(
      `SELECT * FROM attendance_corrections
       WHERE attendance_session_id = ? ORDER BY created_at DESC`,
      attendanceSessionId,
    );
    return rows.map(mapAttendanceCorrection);
  }

  async record(input: RecordCorrectionInput): Promise<AttendanceCorrection> {
    const reason = input.reason.trim();
    if (!reason) throw new DatabaseOperationError('A correction reason is required.');
    if (input.oldValue === input.newValue) {
      throw new DatabaseOperationError('A correction must change the value.');
    }
    const createdAt = toUtcTimestamp();
    const result = await this.database.runAsync(
      `INSERT INTO attendance_corrections (
        attendance_session_id, field_name, old_value, new_value, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      input.attendanceSessionId,
      input.fieldName,
      input.oldValue,
      input.newValue,
      reason,
      createdAt,
    );
    const row = await this.database.getFirstAsync<AttendanceCorrectionRow>(
      'SELECT * FROM attendance_corrections WHERE id = ?',
      result.lastInsertRowId,
    );
    if (!row) throw new DatabaseOperationError('Attendance correction could not be loaded.');
    return mapAttendanceCorrection(row);
  }
}

