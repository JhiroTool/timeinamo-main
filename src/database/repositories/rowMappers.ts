import type {
  ActivityLog,
  AttendanceCorrection,
  AttendanceSession,
  Profile,
  WorkSettings,
} from '@/types/models';
import type { UtcTimestamp, WorkDate } from '@/types/time';

export interface ProfileRow {
  id: number;
  full_name: string;
  email: string | null;
  company_name: string | null;
  company_address: string | null;
  job_title: string | null;
  ojt_program: string | null;
  internship_start_date: string | null;
  required_minutes: number | null;
  setup_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkSettingsRow {
  id: number;
  profile_id: number;
  workdays_mask: number;
  work_start_minutes: number;
  work_end_minutes: number;
  target_minutes: number;
  default_break_minutes: number;
  timezone: string;
  time_format: WorkSettings['timeFormat'];
  date_format: WorkSettings['dateFormat'];
  created_at: string;
  updated_at: string;
}

export interface AttendanceSessionRow {
  id: number;
  profile_id: number;
  work_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  break_started_at: string | null;
  break_duration_seconds: number;
  worked_duration_seconds: number | null;
  status: AttendanceSession['status'];
  entry_source: AttendanceSession['entrySource'];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceCorrectionRow {
  id: number;
  attendance_session_id: number;
  field_name: AttendanceCorrection['fieldName'];
  old_value: string | null;
  new_value: string | null;
  reason: string;
  created_at: string;
}

export interface ActivityLogRow {
  id: number;
  profile_id: number;
  work_date: string;
  title: string;
  content: string;
  notes: string | null;
  attendance_session_id: number | null;
  attendance_credited_seconds?: number | null;
  created_at: string;
  updated_at: string;
}

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    companyName: row.company_name,
    companyAddress: row.company_address,
    jobTitle: row.job_title,
    ojtProgram: row.ojt_program,
    internshipStartDate: row.internship_start_date as WorkDate | null,
    requiredMinutes: row.required_minutes,
    setupCompletedAt: row.setup_completed_at as UtcTimestamp | null,
    createdAt: row.created_at as UtcTimestamp,
    updatedAt: row.updated_at as UtcTimestamp,
  };
}

export function mapWorkSettings(row: WorkSettingsRow): WorkSettings {
  return {
    id: row.id,
    profileId: row.profile_id,
    workdaysMask: row.workdays_mask,
    workStartMinutes: row.work_start_minutes,
    workEndMinutes: row.work_end_minutes,
    targetMinutes: row.target_minutes,
    defaultBreakMinutes: row.default_break_minutes,
    timezone: row.timezone,
    timeFormat: row.time_format,
    dateFormat: row.date_format,
    createdAt: row.created_at as UtcTimestamp,
    updatedAt: row.updated_at as UtcTimestamp,
  };
}

export function mapAttendanceSession(row: AttendanceSessionRow): AttendanceSession {
  return {
    id: row.id,
    profileId: row.profile_id,
    workDate: row.work_date as WorkDate,
    clockInAt: row.clock_in_at as UtcTimestamp,
    clockOutAt: row.clock_out_at as UtcTimestamp | null,
    breakStartedAt: row.break_started_at as UtcTimestamp | null,
    breakDurationSeconds: row.break_duration_seconds,
    workedDurationSeconds: row.worked_duration_seconds,
    status: row.status,
    entrySource: row.entry_source,
    deletedAt: row.deleted_at as UtcTimestamp | null,
    createdAt: row.created_at as UtcTimestamp,
    updatedAt: row.updated_at as UtcTimestamp,
  };
}

export function mapAttendanceCorrection(row: AttendanceCorrectionRow): AttendanceCorrection {
  return {
    id: row.id,
    attendanceSessionId: row.attendance_session_id,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    reason: row.reason,
    createdAt: row.created_at as UtcTimestamp,
  };
}

export function mapActivityLog(row: ActivityLogRow): ActivityLog {
  return {
    id: row.id,
    profileId: row.profile_id,
    workDate: row.work_date as WorkDate,
    title: row.title,
    content: row.content,
    notes: row.notes,
    attendanceSessionId: row.attendance_session_id,
    attendanceCreditedSeconds: row.attendance_credited_seconds ?? null,
    createdAt: row.created_at as UtcTimestamp,
    updatedAt: row.updated_at as UtcTimestamp,
  };
}

