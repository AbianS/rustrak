-- no-transaction
-- An interrupted CONCURRENTLY build in 20260821040000 (connection drop,
-- restart mid-migration) leaves an INVALID index that still owns the name:
-- without this drop, every retry after clearing the dirty migration row would
-- fail with "relation already exists" and require manual surgery. Must be its
-- own single-statement migration: CONCURRENTLY refuses to run inside the
-- implicit transaction that wraps multi-statement batches.
DROP INDEX CONCURRENTLY IF EXISTS idx_spans_standalone_identity;
