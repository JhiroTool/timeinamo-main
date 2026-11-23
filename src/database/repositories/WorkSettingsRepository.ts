import type { Database } from '@/types/database';
import type { DateFormat, TimeFormat, WorkSettings } from '@/types/models';
import { assertValidTimeZone, toUtcTimestamp } from '@/utils/time';

import { DatabaseOperationError } from '../errors';
import { mapWorkSettings, type WorkSettingsRow } from './rowMappers';

export interface SaveWorkSettingsInput {
  profileId: number;
  workdaysMask: number;
  workStartMinutes: number;
  workEndMinutes: number;
  targetMinutes: number;
  defaultBreakMinutes: number;
  timezone: string;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
}

export class WorkSettingsRepository {
  constructor(private readonly database: Database) {}

  async getForProfile(profileId: number): Promise<WorkSettings | null> {
    const row = await this.database.getFirstAsync<WorkSettingsRow>(
      'SELECT * FROM work_settings WHERE profile_id = ?',
      profileId,
    );
    return row ? mapWorkSettings(row) : null;
  }

  async save(input: SaveWorkSettingsInput): Promise<WorkSettings> {
    assertValidTimeZone(input.timezone);
    const now = toUtcTimestamp();
    try {
      await this.database.runAsync(
        `INSERT INTO work_settings (
          profile_id, workdays_mask, work_start_minutes, work_end_minutes,
          target_minutes, default_break_minutes, timezone, time_format, date_format,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(profile_id) DO UPDATE SET
          workdays_mask = excluded.workdays_mask,
          work_start_minutes = excluded.work_start_minutes,
          work_end_minutes = excluded.work_end_minutes,
          target_minutes = excluded.target_minutes,
          default_break_minutes = excluded.default_break_minutes,
          timezone = excluded.timezone,
          time_format = excluded.time_format,
          date_format = excluded.date_format,
          updated_at = excluded.updated_at`,
        input.profileId,
        input.workdaysMask,
        input.workStartMinutes,
        input.workEndMinutes,
        input.targetMinutes,
        input.defaultBreakMinutes,
        input.timezone,
        input.timeFormat,
        input.dateFormat,
        now,
        now,
      );
    } catch (error) {
      throw new DatabaseOperationError('Work settings could not be saved.', error);
    }

    const settings = await this.getForProfile(input.profileId);
    if (!settings) throw new DatabaseOperationError('Work settings could not be loaded.');
    return settings;
  }
}

