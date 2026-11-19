-- Daily-log practical model. Existing week rows stay LEGACY via the column default.
-- Dates are ISO text so the same script runs on PostgreSQL and the sqlite test harness.

CREATE TABLE IF NOT EXISTS daily_entries(
  id TEXT PRIMARY KEY,
  student TEXT NOT NULL,
  week INTEGER NOT NULL,
  stage INTEGER NOT NULL,
  local_date TEXT NOT NULL,
  created BIGINT NOT NULL,
  updated BIGINT NOT NULL,
  body TEXT NOT NULL,
  digest TEXT NOT NULL,
  revision INTEGER NOT NULL,
  eligible INTEGER NOT NULL,
  ineligible_reason TEXT
);
CREATE INDEX IF NOT EXISTS daily_entries_student_week_date ON daily_entries(student, week, local_date);

CREATE TABLE IF NOT EXISTS daily_entry_revisions(
  entry TEXT NOT NULL,
  revision INTEGER NOT NULL,
  body TEXT NOT NULL,
  digest TEXT NOT NULL,
  saved BIGINT NOT NULL,
  PRIMARY KEY(entry, revision)
);

CREATE TABLE IF NOT EXISTS daily_entry_files(
  id TEXT PRIMARY KEY,
  entry TEXT NOT NULL,
  path TEXT NOT NULL,
  digest TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime TEXT
);

CREATE TABLE IF NOT EXISTS practical_overrides(
  id TEXT PRIMARY KEY,
  student TEXT NOT NULL,
  week INTEGER NOT NULL,
  reason TEXT NOT NULL,
  opens_at BIGINT NOT NULL,
  closes_at BIGINT NOT NULL,
  created BIGINT NOT NULL
);

ALTER TABLE weeks ADD COLUMN IF NOT EXISTS issued_at BIGINT;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS due_friday TEXT;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS window_start TEXT;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS practical_model TEXT DEFAULT 'LEGACY';
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS resume_state TEXT;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS plan_required INTEGER NOT NULL DEFAULT 0;
UPDATE weeks SET plan_required = 1 WHERE stage = 8;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitted_at BIGINT;
