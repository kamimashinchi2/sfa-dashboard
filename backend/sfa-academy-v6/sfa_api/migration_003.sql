-- Test-account flag. Existing students stay off (0) and keep weekday, lock, and Friday-window rules.
-- INTEGER so the same script runs on PostgreSQL and the sqlite test harness.
-- Safe to run again: ADD COLUMN IF NOT EXISTS is a no-op once the column exists.

ALTER TABLE students ADD COLUMN IF NOT EXISTS is_test_account INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS test_backdated INTEGER NOT NULL DEFAULT 0;
