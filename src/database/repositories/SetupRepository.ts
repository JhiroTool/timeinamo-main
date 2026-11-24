import type { Database } from '@/types/database';
import type { DateFormat, Profile, TimeFormat, WorkSettings } from '@/types/models';
import type { WorkDate } from '@/types/time';
import { assertValidTimeZone, parseWorkDate, toUtcTimestamp } from '@/utils/time';

import { DatabaseOperationError } from '../errors';
import {
  mapProfile,
  mapWorkSettings,
  type ProfileRow,
  type WorkSettingsRow,
} from './rowMappers';

export interface SetupData {
  profile: Profile;
  workSettings: WorkSettings;
}

export interface SaveSetupInput {
  fullName: string;
  companyName: string;
  jobTitle: string | null;
  internshipStartDate: WorkDate;
  requiredMinutes: number;
  workdaysMask: number;
  workStartMinutes: number;
  workEndMinutes: number;
  targetMinutes: number;
  defaultBreakMinutes: number;
  timezone: string;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
}

export class SetupRepository {
  constructor(private readonly database: Database) {}

  async get(): Promise<SetupData | null> {
    const [profileRow, settingsRow] = await Promise.all([
      this.database.getFirstAsync<ProfileRow>('SELECT * FROM profiles WHERE id = 1'),
      this.database.getFirstAsync<WorkSettingsRow>(
        'SELECT * FROM work_settings WHERE profile_id = 1',
      ),
    ]);
    if (!profileRow || !settingsRow) return null;
    return {
      profile: mapProfile(profileRow),
      workSettings: mapWorkSettings(settingsRow),
    };
  }

  async save(input: SaveSetupInput): Promise<SetupData> {
    assertValidTimeZone(input.timezone);
    parseWorkDate(input.internshipStartDate);
    if (!input.fullName.trim() || !input.companyName.trim()) {
      throw new DatabaseOperationError('Name and company are required.');
    }
    if (input.requiredMinutes <= 0 || input.targetMinutes <= 0) {
      throw new DatabaseOperationError('Required and daily target minutes must be positive.');
    }

    const now = toUtcTimestamp();
    try {
      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.runAsync(
          `INSERT INTO profiles (
            id, full_name, company_name, job_title, internship_start_date,
            required_minutes, setup_completed_at, created_at, updated_at
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            full_name = excluded.full_name,
            company_name = excluded.company_name,
            job_title = excluded.job_title,
            internship_start_date = excluded.internship_start_date,
            required_minutes = excluded.required_minutes,
            setup_completed_at = excluded.setup_completed_at,
            updated_at = excluded.updated_at`,
          input.fullName.trim(),
          input.companyName.trim(),
          input.jobTitle?.trim() || null,
          input.internshipStartDate,
          input.requiredMinutes,
          now,
          now,
          now,
        );

        await transaction.runAsync(
          `INSERT INTO work_settings (
            profile_id, workdays_mask, work_start_minutes, work_end_minutes,
            target_minutes, default_break_minutes, timezone, time_format,
            date_format, created_at, updated_at
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      });
    } catch (error) {
      throw new DatabaseOperationError('Setup could not be saved to this device.', error);
    }

    const data = await this.get();
    if (!data) throw new DatabaseOperationError('Saved setup could not be reloaded.');
    return data;
  }

  async deleteAllLocalData(): Promise<void> {
    try {
      // The single DELETE is atomic and its cascades use the configured connection.
      await this.database.runAsync('DELETE FROM profiles');
    } catch (error) {
      throw new DatabaseOperationError('Local data could not be deleted.', error);
    }
  }
}

