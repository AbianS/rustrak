-- Partial indexes mirroring the Postgres migration of the same name. SQLite
-- has no CONCURRENTLY (and no planner-statistics failure mode to guard
-- against), but the indexes keep the two backends' query plans comparable.

CREATE INDEX IF NOT EXISTS idx_spans_gen_ai_trace
    ON spans (project_id, trace_id, start_timestamp)
    WHERE gen_ai_operation_type IS NOT NULL AND trace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_group_duration
    ON transactions (project_id, transaction_name, op)
    WHERE duration_ms IS NOT NULL;
