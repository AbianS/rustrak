DROP INDEX IF EXISTS idx_spans_project_trace;

ALTER TABLE spans DROP COLUMN environment;
ALTER TABLE spans DROP COLUMN release;
ALTER TABLE spans DROP COLUMN platform;

-- Standalone spans only exist because of the .up migration this reverts, and
-- the NOT NULL below cannot be restored while any of them remain.
DELETE FROM spans WHERE transaction_id IS NULL;

ALTER TABLE spans ALTER COLUMN transaction_id SET NOT NULL;
