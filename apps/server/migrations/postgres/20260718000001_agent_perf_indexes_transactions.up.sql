-- no-transaction
--
-- Split out of `20260718000000` — see that migration for the rationale.
-- Covers the (name, op) grouping and the per-group duration scan behind
-- `TransactionService::stats`. Kept in its own file because CONCURRENTLY
-- cannot share a query message with another statement (Postgres implicitly
-- wraps multi-statement messages in a transaction block).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_group_duration
    ON transactions (project_id, transaction_name, op)
    WHERE duration_ms IS NOT NULL;
