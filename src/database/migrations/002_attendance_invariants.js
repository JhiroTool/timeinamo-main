export const attendanceInvariantsSql = String.raw`
CREATE UNIQUE INDEX uq_attendance_session_workday
  ON attendance_sessions(profile_id, work_date);

CREATE UNIQUE INDEX uq_attendance_single_active
  ON attendance_sessions(profile_id)
  WHERE status IN ('active', 'on_break');
`;

