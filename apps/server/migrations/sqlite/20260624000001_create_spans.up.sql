-- Indexed spans extracted from transactions (issue #142, Fase 1) — SQLite dialect.
CREATE TABLE spans (
    id                TEXT PRIMARY KEY,
    transaction_id    TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    span_id           TEXT,
    trace_id          TEXT,
    parent_span_id    TEXT,
    op                VARCHAR(128),
    description       TEXT,
    status            VARCHAR(32),

    start_timestamp   TEXT,
    timestamp         TEXT,
    duration_ms       REAL,
    exclusive_time_ms REAL,

    is_segment        BOOLEAN NOT NULL DEFAULT 0,
    segment_id        TEXT,

    tags              TEXT,
    data              TEXT NOT NULL
);

CREATE INDEX idx_spans_transaction ON spans(transaction_id);
CREATE INDEX idx_spans_project_op  ON spans(project_id, op);
CREATE INDEX idx_spans_trace       ON spans(trace_id);
CREATE INDEX idx_spans_span_id     ON spans(span_id);
