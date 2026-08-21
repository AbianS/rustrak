-- A retried standalone span is the same logical span, not a new row.
DELETE FROM spans a
USING spans b
WHERE a.transaction_id IS NULL
  AND b.transaction_id IS NULL
  AND a.trace_id IS NOT NULL
  AND a.span_id IS NOT NULL
  AND b.trace_id IS NOT NULL
  AND b.span_id IS NOT NULL
  AND a.project_id = b.project_id
  AND a.trace_id = b.trace_id
  AND a.span_id = b.span_id
  AND a.id > b.id;

CREATE UNIQUE INDEX idx_spans_standalone_identity
    ON spans(project_id, trace_id, span_id)
    WHERE transaction_id IS NULL
      AND trace_id IS NOT NULL
      AND span_id IS NOT NULL;

ALTER TABLE logs ADD COLUMN dedupe_key TEXT;
CREATE UNIQUE INDEX idx_logs_dedupe_key
    ON logs(project_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;
