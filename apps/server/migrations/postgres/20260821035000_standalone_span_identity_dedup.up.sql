-- Re-dedup immediately before the unique index build in 20260821040000: rows
-- may have been written since the 20260821010000 dedup (e.g. by a replica
-- still running old code during a rolling deploy), and CREATE UNIQUE INDEX
-- CONCURRENTLY fails on duplicates instead of ignoring them.
DELETE FROM spans a
    USING spans b
    WHERE a.id > b.id
      AND a.project_id = b.project_id
      AND a.trace_id = b.trace_id
      AND a.span_id = b.span_id
      AND a.transaction_id IS NULL
      AND b.transaction_id IS NULL
      AND a.trace_id IS NOT NULL
      AND a.span_id IS NOT NULL;
