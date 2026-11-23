import type { Database } from '@/types/database';
import type { Profile } from '@/types/models';
import type { WorkDate } from '@/types/time';
import { toUtcTimestamp } from '@/utils/time';

import { DatabaseOperationError } from '../errors';
import { mapProfile, type ProfileRow } from './rowMappers';

export interface SaveProfileInput {
  fullName: string;
  email?: string | null;
  companyName?: string | null;
  companyAddress?: string | null;
  jobTitle?: string | null;
  ojtProgram?: string | null;
  internshipStartDate?: WorkDate | null;
  requiredMinutes?: number | null;
}

export class ProfileRepository {
  constructor(private readonly database: Database) {}

  async get(): Promise<Profile | null> {
    const row = await this.database.getFirstAsync<ProfileRow>(
      'SELECT * FROM profiles WHERE id = 1',
    );
    return row ? mapProfile(row) : null;
  }

  async save(input: SaveProfileInput): Promise<Profile> {
    const fullName = input.fullName.trim();
    if (!fullName) throw new DatabaseOperationError('Full name is required.');
    const now = toUtcTimestamp();

    await this.database.runAsync(
      `INSERT INTO profiles (
        id, full_name, email, company_name, company_address, job_title,
        ojt_program, internship_start_date, required_minutes, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        full_name = excluded.full_name,
        email = excluded.email,
        company_name = excluded.company_name,
        company_address = excluded.company_address,
        job_title = excluded.job_title,
        ojt_program = excluded.ojt_program,
        internship_start_date = excluded.internship_start_date,
        required_minutes = excluded.required_minutes,
        updated_at = excluded.updated_at`,
      fullName,
      input.email?.trim() || null,
      input.companyName?.trim() || null,
      input.companyAddress?.trim() || null,
      input.jobTitle?.trim() || null,
      input.ojtProgram?.trim() || null,
      input.internshipStartDate ?? null,
      input.requiredMinutes ?? null,
      now,
      now,
    );

    const profile = await this.get();
    if (!profile) throw new DatabaseOperationError('Profile could not be saved.');
    return profile;
  }
}

