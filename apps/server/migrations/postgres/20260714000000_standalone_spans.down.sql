DROP INDEX IF EXISTS idx_spans_project_trace;

ALTER TABLE spans DROP COLUMN environment;
ALTER TABLE spans DROP COLUMN release;
ALTER TABLE spans DROP COLUMN platform;

-- Only safe if no standalone (transaction_id IS NULL) rows exist.
ALTER TABLE spans ALTER COLUMN transaction_id SET NOT NULL;
