export const setupPreferencesSql = String.raw`
ALTER TABLE profiles ADD COLUMN internship_start_date TEXT CHECK (
  internship_start_date IS NULL OR
  internship_start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
);

ALTER TABLE profiles ADD COLUMN required_minutes INTEGER CHECK (
  required_minutes IS NULL OR required_minutes > 0
);

ALTER TABLE profiles ADD COLUMN setup_completed_at TEXT CHECK (
  setup_completed_at IS NULL OR (
    setup_completed_at GLOB '????-??-??T??:??:??.???Z' AND
    julianday(setup_completed_at) IS NOT NULL
  )
);

ALTER TABLE work_settings ADD COLUMN time_format TEXT NOT NULL DEFAULT '12h'
  CHECK (time_format IN ('12h', '24h'));

ALTER TABLE work_settings ADD COLUMN date_format TEXT NOT NULL DEFAULT 'mdy'
  CHECK (date_format IN ('mdy', 'dmy', 'ymd'));
`;

