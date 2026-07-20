-- Standalone Span envelope item support (story-span-ingestion.md, issue #143 item 1).
-- The `spans` table already holds everything a transaction-child span needs;
-- this extends it for spans that arrive without a parent transaction row:
-- transaction_id becomes optional, and platform/release/environment (normally
-- inherited from the parent transaction) get their own nullable columns.
ALTER TABLE spans ALTER COLUMN transaction_id DROP NOT NULL;

ALTER TABLE spans ADD COLUMN platform    VARCHAR(64);
ALTER TABLE spans ADD COLUMN release     VARCHAR(250);
ALTER TABLE spans ADD COLUMN environment VARCHAR(64);

-- Supports listing/reconstructing a trace across BOTH standalone and
-- transaction-child spans, which now share this one table.
CREATE INDEX idx_spans_project_trace ON spans(project_id, trace_id);
