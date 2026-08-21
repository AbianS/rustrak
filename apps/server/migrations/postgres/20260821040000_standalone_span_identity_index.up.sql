-- no-transaction
CREATE UNIQUE INDEX CONCURRENTLY idx_spans_standalone_identity
    ON spans(project_id, trace_id, span_id)
    WHERE transaction_id IS NULL
      AND trace_id IS NOT NULL
      AND span_id IS NOT NULL;
