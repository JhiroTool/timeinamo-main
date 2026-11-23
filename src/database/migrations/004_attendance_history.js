export const attendanceHistorySql = String.raw`
ALTER TABLE attendance_sessions ADD COLUMN entry_source TEXT NOT NULL DEFAULT 'automatic'
  CHECK (entry_source IN ('automatic', 'manual'));

ALTER TABLE attendance_sessions ADD COLUMN deleted_at TEXT CHECK (
  deleted_at IS NULL OR (
    deleted_at GLOB '????-??-??T??:??:??.???Z' AND julianday(deleted_at) IS NOT NULL
  )
);

DROP INDEX uq_attendance_session_workday;
DROP INDEX uq_attendance_single_active;

CREATE UNIQUE INDEX uq_attendance_session_workday
  ON attendance_sessions(profile_id, work_date)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_attendance_single_active
  ON attendance_sessions(profile_id)
  WHERE deleted_at IS NULL AND status IN ('active', 'on_break');

CREATE INDEX idx_attendance_history_month
  ON attendance_sessions(profile_id, work_date DESC, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_attendance_no_overlap_insert
BEFORE INSERT ON attendance_sessions
WHEN NEW.deleted_at IS NULL AND EXISTS (
  SELECT 1 FROM attendance_sessions existing
  WHERE existing.profile_id = NEW.profile_id
    AND existing.deleted_at IS NULL
    AND NEW.clock_in_at < COALESCE(existing.clock_out_at, '9999-12-31T23:59:59.999Z')
    AND existing.clock_in_at < COALESCE(NEW.clock_out_at, '9999-12-31T23:59:59.999Z')
)
BEGIN
  SELECT RAISE(ABORT, 'attendance session overlaps an existing record');
END;

CREATE TRIGGER trg_attendance_no_overlap_update
BEFORE UPDATE OF profile_id, clock_in_at, clock_out_at, deleted_at ON attendance_sessions
WHEN NEW.deleted_at IS NULL AND EXISTS (
  SELECT 1 FROM attendance_sessions existing
  WHERE existing.profile_id = NEW.profile_id
    AND existing.id <> NEW.id
    AND existing.deleted_at IS NULL
    AND NEW.clock_in_at < COALESCE(existing.clock_out_at, '9999-12-31T23:59:59.999Z')
    AND existing.clock_in_at < COALESCE(NEW.clock_out_at, '9999-12-31T23:59:59.999Z')
)
BEGIN
  SELECT RAISE(ABORT, 'attendance session overlaps an existing record');
END;
`;

