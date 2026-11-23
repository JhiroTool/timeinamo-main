import type { AttendanceSession } from '@/types/models';

import type { Repositories } from '@/database/repositories';
import { DatabaseOperationError } from '@/database/errors';

export class AttendanceService {
  constructor(private readonly repositories: Repositories) {}

  async startForProfile(
    profileId: number,
    occurredAt: Date | string = new Date(),
  ): Promise<AttendanceSession> {
    const settings = await this.repositories.workSettings.getForProfile(profileId);
    if (!settings) {
      throw new DatabaseOperationError('Work settings must be configured before clocking in.');
    }
    return this.repositories.attendance.start({
      profileId,
      timezone: settings.timezone,
      defaultBreakSeconds: settings.defaultBreakMinutes * 60,
      occurredAt,
    });
  }

  async completeSession(
    sessionId: number,
    unpaidBreakSeconds: number,
    occurredAt: Date | string = new Date(),
  ): Promise<AttendanceSession> {
    return this.repositories.attendance.completeWithBreak(
      sessionId,
      unpaidBreakSeconds,
      occurredAt,
    );
  }

  async updateUnpaidBreak(
    sessionId: number,
    unpaidBreakSeconds: number,
  ): Promise<AttendanceSession> {
    return this.repositories.attendance.updateUnpaidBreak(sessionId, unpaidBreakSeconds);
  }
}

