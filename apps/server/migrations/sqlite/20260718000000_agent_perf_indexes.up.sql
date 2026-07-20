-- Partial index mirroring the Postgres migration of the same name. SQLite
-- has no CONCURRENTLY (and no planner-statistics failure mode to guard
-- against), but the index keeps the two backends' query plans comparable.
--
-- Split into two files (see 20260718000001) only to keep version numbers
-- aligned with the Postgres migrations, which must be split across files
-- because CONCURRENTLY cannot share a query message with another statement.

CREATE INDEX IF NOT EXISTS idx_spans_gen_ai_trace
    ON spans (project_id, trace_id, start_timestamp)
    WHERE gen_ai_operation_type IS NOT NULL AND trace_id IS NOT NULL;
