export const performanceIndexesSql = String.raw`
CREATE INDEX idx_attendance_completed_timeline
  ON attendance_sessions(profile_id, work_date DESC, clock_in_at DESC)
  WHERE deleted_at IS NULL AND status = 'completed';

CREATE INDEX idx_activity_logs_profile_timeline
  ON activity_logs(profile_id, work_date DESC, created_at DESC, id DESC);
`;
