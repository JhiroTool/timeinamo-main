import type { Database } from '@/types/database';

import { ActivityLogRepository } from './ActivityLogRepository';
import { AttendanceCorrectionRepository } from './AttendanceCorrectionRepository';
import { AttendanceRepository } from './AttendanceRepository';
import { ProfileRepository } from './ProfileRepository';
import { SetupRepository } from './SetupRepository';
import { WorkSettingsRepository } from './WorkSettingsRepository';

export function createRepositories(database: Database) {
  return {
    profiles: new ProfileRepository(database),
    setup: new SetupRepository(database),
    workSettings: new WorkSettingsRepository(database),
    attendance: new AttendanceRepository(database),
    attendanceCorrections: new AttendanceCorrectionRepository(database),
    activityLogs: new ActivityLogRepository(database),
  } as const;
}

export type Repositories = ReturnType<typeof createRepositories>;

export * from './ActivityLogRepository';
export * from './AttendanceCorrectionRepository';
export * from './AttendanceRepository';
export * from './ProfileRepository';
export * from './SetupRepository';
export * from './WorkSettingsRepository';

