DROP INDEX IF EXISTS idx_logs_dedupe_key;
ALTER TABLE logs DROP COLUMN IF EXISTS dedupe_key;
