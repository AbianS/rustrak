-- Indexed spans extracted from transactions (issue #142, Fase 1).
-- Mirrors Relay's span extraction: each span in a transaction's `spans` array
-- becomes a standalone, queryable row (DataCategory::SpanIndexed).
CREATE TABLE spans (
    id                UUID PRIMARY KEY,
    transaction_id    UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    span_id           VARCHAR(32),
    trace_id          VARCHAR(64),
    parent_span_id    VARCHAR(32),
    op                VARCHAR(128),
    description       TEXT,
    status            VARCHAR(32),

    start_timestamp   TIMESTAMPTZ,
    timestamp         TIMESTAMPTZ,
    duration_ms       DOUBLE PRECISION,
    exclusive_time_ms DOUBLE PRECISION,

    -- SpanV2 segment markers (Relay: a span is the segment when is_segment=true).
    is_segment        BOOLEAN NOT NULL DEFAULT FALSE,
    segment_id        VARCHAR(32),

    tags              JSONB,
    data              JSONB NOT NULL
);

CREATE INDEX idx_spans_transaction ON spans(transaction_id);
CREATE INDEX idx_spans_project_op  ON spans(project_id, op);
CREATE INDEX idx_spans_trace       ON spans(trace_id);
CREATE INDEX idx_spans_span_id     ON spans(span_id);
