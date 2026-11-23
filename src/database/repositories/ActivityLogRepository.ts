import type { Database } from '@/types/database';
import type { ActivityLog } from '@/types/models';
import type { WorkDate } from '@/types/time';
import { toUtcTimestamp } from '@/utils/time';

import { DatabaseOperationError } from '../errors';
import { mapActivityLog, type ActivityLogRow } from './rowMappers';

export interface SaveActivityLogInput {
  id?: number;
  profileId: number;
  workDate: WorkDate;
  title?: string | null;
  content: string;
}

export class ActivityLogRepository {
  constructor(private readonly database: Database) {}

  async listForWorkDate(profileId: number, workDate: WorkDate): Promise<ActivityLog[]> {
    const rows = await this.database.getAllAsync<ActivityLogRow>(
      `SELECT * FROM activity_logs
       WHERE profile_id = ? AND work_date = ? ORDER BY created_at DESC`,
      profileId,
      workDate,
    );
    return rows.map(mapActivityLog);
  }

  async save(input: SaveActivityLogInput): Promise<ActivityLog> {
    const content = input.content.trim();
    if (!content) throw new DatabaseOperationError('Activity content is required.');
    const now = toUtcTimestamp();
    let id = input.id;

    if (id === undefined) {
      const result = await this.database.runAsync(
        `INSERT INTO activity_logs (
          profile_id, work_date, title, content, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        input.profileId,
        input.workDate,
        input.title?.trim() || null,
        content,
        now,
        now,
      );
      id = result.lastInsertRowId;
    } else {
      const result = await this.database.runAsync(
        `UPDATE activity_logs SET title = ?, content = ?, updated_at = ?
         WHERE id = ? AND profile_id = ?`,
        input.title?.trim() || null,
        content,
        now,
        id,
        input.profileId,
      );
      if (result.changes !== 1) throw new DatabaseOperationError('Activity log was not found.');
    }

    const row = await this.database.getFirstAsync<ActivityLogRow>(
      'SELECT * FROM activity_logs WHERE id = ?',
      id,
    );
    if (!row) throw new DatabaseOperationError('Activity log could not be loaded.');
    return mapActivityLog(row);
  }

  async remove(id: number, profileId: number): Promise<boolean> {
    const result = await this.database.runAsync(
      'DELETE FROM activity_logs WHERE id = ? AND profile_id = ?',
      id,
      profileId,
    );
    return result.changes === 1;
  }
}

