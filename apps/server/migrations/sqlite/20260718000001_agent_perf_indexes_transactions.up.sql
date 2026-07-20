-- Split out of `20260718000000` to keep version numbers aligned with the
-- Postgres migrations. Covers the (name, op) grouping and the per-group
-- duration scan behind `TransactionService::stats`.

CREATE INDEX IF NOT EXISTS idx_transactions_group_duration
    ON transactions (project_id, transaction_name, op)
    WHERE duration_ms IS NOT NULL;
