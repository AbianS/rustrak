DELETE FROM spans
WHERE transaction_id IS NULL
  AND id NOT IN (
      SELECT MIN(id)
      FROM spans
      WHERE transaction_id IS NULL
      GROUP BY project_id, trace_id, span_id
  );

CREATE UNIQUE INDEX idx_spans_standalone_identity
    ON spans(project_id, trace_id, span_id)
    WHERE transaction_id IS NULL;

ALTER TABLE logs ADD COLUMN dedupe_key TEXT;
CREATE UNIQUE INDEX idx_logs_dedupe_key
    ON logs(project_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;
