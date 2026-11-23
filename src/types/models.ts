import type { UtcTimestamp, WorkDate } from './time';

export const ATTENDANCE_STATUSES = ['active', 'on_break', 'completed'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const CORRECTABLE_ATTENDANCE_FIELDS = [
  'work_date',
  'clock_in_at',
  'clock_out_at',
  'break_duration_seconds',
  'worked_duration_seconds',
  'status',
] as const;
export type CorrectableAttendanceField =
  (typeof CORRECTABLE_ATTENDANCE_FIELDS)[number];

export const TIME_FORMATS = ['12h', '24h'] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export const DATE_FORMATS = ['mdy', 'dmy', 'ymd'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export interface Profile {
  id: number;
  fullName: string;
  email: string | null;
  companyName: string | null;
  companyAddress: string | null;
  jobTitle: string | null;
  ojtProgram: string | null;
  internshipStartDate: WorkDate | null;
  requiredMinutes: number | null;
  setupCompletedAt: UtcTimestamp | null;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
}

export interface WorkSettings {
  id: number;
  profileId: number;
  workdaysMask: number;
  workStartMinutes: number;
  workEndMinutes: number;
  targetMinutes: number;
  defaultBreakMinutes: number;
  timezone: string;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
}

export interface AttendanceSession {
  id: number;
  profileId: number;
  workDate: WorkDate;
  clockInAt: UtcTimestamp;
  clockOutAt: UtcTimestamp | null;
  breakStartedAt: UtcTimestamp | null;
  breakDurationSeconds: number;
  workedDurationSeconds: number | null;
  status: AttendanceStatus;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
}

export interface AttendanceCorrection {
  id: number;
  attendanceSessionId: number;
  fieldName: CorrectableAttendanceField;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  createdAt: UtcTimestamp;
}

export interface ActivityLog {
  id: number;
  profileId: number;
  workDate: WorkDate;
  title: string | null;
  content: string;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
}

