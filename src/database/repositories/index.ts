import type { Database } from '@/types/database';

import { ActivityLogRepository } from './ActivityLogRepository';
import { AttendanceCorrectionRepository } from './AttendanceCorrectionRepository';
import { AttendanceRepository } from './AttendanceRepository';
import { AttendanceHistoryRepository } from './AttendanceHistoryRepository';
import { ProfileRepository } from './ProfileRepository';
import { SetupRepository } from './SetupRepository';
import { WorkSettingsRepository } from './WorkSettingsRepository';
import { OjtInsightsRepository } from './OjtInsightsRepository';
import { AttendanceExportRepository } from './AttendanceExportRepository';

export function createRepositories(database: Database) {
  return {
    profiles: new ProfileRepository(database),
    setup: new SetupRepository(database),
    workSettings: new WorkSettingsRepository(database),
    attendance: new AttendanceRepository(database),
    attendanceHistory: new AttendanceHistoryRepository(database),
    attendanceCorrections: new AttendanceCorrectionRepository(database),
    activityLogs: new ActivityLogRepository(database),
    ojtInsights: new OjtInsightsRepository(database),
    attendanceExport: new AttendanceExportRepository(database),
  } as const;
}

export type Repositories = ReturnType<typeof createRepositories>;

export * from './ActivityLogRepository';
export * from './AttendanceCorrectionRepository';
export * from './AttendanceRepository';
export * from './AttendanceHistoryRepository';
export * from './ProfileRepository';
export * from './SetupRepository';
export * from './WorkSettingsRepository';
export * from './OjtInsightsRepository';
export * from './AttendanceExportRepository';

