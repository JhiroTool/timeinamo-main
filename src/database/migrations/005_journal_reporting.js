export const journalReportingSql = String.raw`
ALTER TABLE activity_logs ADD COLUMN notes TEXT;
ALTER TABLE activity_logs ADD COLUMN attendance_session_id INTEGER
  REFERENCES attendance_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;

UPDATE activity_logs
SET title = 'Activity'
WHERE title IS NULL OR length(trim(title)) = 0;

CREATE TRIGGER trg_activity_logs_required_insert
BEFORE INSERT ON activity_logs
WHEN NEW.title IS NULL OR length(trim(NEW.title)) = 0
BEGIN
  SELECT RAISE(ABORT, 'activity title is required');
END;

CREATE TRIGGER trg_activity_logs_required_update
BEFORE UPDATE OF title ON activity_logs
WHEN NEW.title IS NULL OR length(trim(NEW.title)) = 0
BEGIN
  SELECT RAISE(ABORT, 'activity title is required');
END;

CREATE INDEX idx_activity_logs_profile_search
  ON activity_logs(profile_id, work_date DESC, title);

CREATE INDEX idx_activity_logs_attendance
  ON activity_logs(attendance_session_id)
  WHERE attendance_session_id IS NOT NULL;
`;
