export const initialSchemaSql = String.raw`
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL CHECK (version > 0),
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  applied_at TEXT NOT NULL CHECK (
    applied_at GLOB '????-??-??T??:??:??.???Z' AND julianday(applied_at) IS NOT NULL
  )
);

CREATE TABLE profiles (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  email TEXT,
  company_name TEXT,
  company_address TEXT,
  job_title TEXT,
  ojt_program TEXT,
  created_at TEXT NOT NULL CHECK (
    created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL
  ),
  updated_at TEXT NOT NULL CHECK (
    updated_at GLOB '????-??-??T??:??:??.???Z' AND julianday(updated_at) IS NOT NULL
  )
);

CREATE TABLE work_settings (
  id INTEGER PRIMARY KEY NOT NULL,
  profile_id INTEGER NOT NULL UNIQUE,
  workdays_mask INTEGER NOT NULL DEFAULT 62 CHECK (workdays_mask BETWEEN 0 AND 127),
  work_start_minutes INTEGER NOT NULL CHECK (work_start_minutes BETWEEN 0 AND 1439),
  work_end_minutes INTEGER NOT NULL CHECK (work_end_minutes BETWEEN 0 AND 1439),
  target_minutes INTEGER NOT NULL CHECK (target_minutes BETWEEN 1 AND 1440),
  default_break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (default_break_minutes BETWEEN 0 AND 1440),
  timezone TEXT NOT NULL CHECK (length(trim(timezone)) > 0),
  created_at TEXT NOT NULL CHECK (
    created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL
  ),
  updated_at TEXT NOT NULL CHECK (
    updated_at GLOB '????-??-??T??:??:??.???Z' AND julianday(updated_at) IS NOT NULL
  ),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE attendance_sessions (
  id INTEGER PRIMARY KEY NOT NULL,
  profile_id INTEGER NOT NULL,
  work_date TEXT NOT NULL CHECK (
    work_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  clock_in_at TEXT NOT NULL CHECK (
    clock_in_at GLOB '????-??-??T??:??:??.???Z' AND julianday(clock_in_at) IS NOT NULL
  ),
  clock_out_at TEXT CHECK (
    clock_out_at IS NULL OR (
      clock_out_at GLOB '????-??-??T??:??:??.???Z' AND
      julianday(clock_out_at) IS NOT NULL AND
      clock_out_at > clock_in_at
    )
  ),
  break_started_at TEXT CHECK (
    break_started_at IS NULL OR (
      break_started_at GLOB '????-??-??T??:??:??.???Z' AND
      julianday(break_started_at) IS NOT NULL AND
      break_started_at >= clock_in_at
    )
  ),
  break_duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (break_duration_seconds >= 0),
  worked_duration_seconds INTEGER CHECK (worked_duration_seconds IS NULL OR worked_duration_seconds >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'on_break', 'completed')),
  created_at TEXT NOT NULL CHECK (
    created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL
  ),
  updated_at TEXT NOT NULL CHECK (
    updated_at GLOB '????-??-??T??:??:??.???Z' AND julianday(updated_at) IS NOT NULL
  ),
  CHECK ((status = 'completed') = (clock_out_at IS NOT NULL)),
  CHECK ((status = 'on_break') = (break_started_at IS NOT NULL)),
  CHECK ((status = 'completed') = (worked_duration_seconds IS NOT NULL)),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE attendance_corrections (
  id INTEGER PRIMARY KEY NOT NULL,
  attendance_session_id INTEGER NOT NULL,
  field_name TEXT NOT NULL CHECK (field_name IN (
    'work_date', 'clock_in_at', 'clock_out_at', 'break_duration_seconds',
    'worked_duration_seconds', 'status'
  )),
  old_value TEXT,
  new_value TEXT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  created_at TEXT NOT NULL CHECK (
    created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL
  ),
  CHECK (old_value IS NOT new_value),
  FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY NOT NULL,
  profile_id INTEGER NOT NULL,
  work_date TEXT NOT NULL CHECK (
    work_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  title TEXT,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  created_at TEXT NOT NULL CHECK (
    created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL
  ),
  updated_at TEXT NOT NULL CHECK (
    updated_at GLOB '????-??-??T??:??:??.???Z' AND julianday(updated_at) IS NOT NULL
  ),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_attendance_sessions_profile_date
  ON attendance_sessions(profile_id, work_date DESC);
CREATE INDEX idx_attendance_corrections_session_created
  ON attendance_corrections(attendance_session_id, created_at DESC);
CREATE INDEX idx_activity_logs_profile_date
  ON activity_logs(profile_id, work_date DESC);
`;

