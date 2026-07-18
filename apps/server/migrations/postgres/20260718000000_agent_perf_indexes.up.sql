-- no-transaction
--
-- Partial indexes for the AI-span and transaction-duration aggregates.
--
-- `20260714000001` added the gen_ai_* columns to a spans table that already
-- held millions of rows. ADD COLUMN does not rewrite the heap, so the new
-- column starts with no row in pg_stats, and until autovacuum analyzes it the
-- planner assumes `IS NOT NULL` matches everything: the agent-traces
-- aggregates fell back to a parallel seq scan over the whole table (~14s in
-- production against a set that was actually empty).
--
-- ANALYZE clears the immediate symptom, but the same window reopens after any
-- future large ADD COLUMN. A partial index closes it structurally: the
-- predicate lives in the index, so the qualifying set *is* the index and its
-- size cannot be misestimated regardless of column statistics.
--
-- CONCURRENTLY (hence `-- no-transaction`) lets ingestion keep writing while
-- the index builds; spans is the hottest table in the system.
--
-- Postgres implicitly wraps multiple statements sent in one query message in
-- a transaction block even with no explicit BEGIN, and CONCURRENTLY cannot
-- run inside any transaction block, implicit or not. So this file holds only
-- this single statement; the transactions index lives in the next migration.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_spans_gen_ai_trace
    ON spans (project_id, trace_id, start_timestamp)
    WHERE gen_ai_operation_type IS NOT NULL AND trace_id IS NOT NULL;
