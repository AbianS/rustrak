-- Standalone Span envelope item support (SQLite) — story-span-ingestion.md,
-- issue #143 item 1. SQLite cannot ALTER a NOT NULL/FK constraint in place,
-- so we recreate the table (same technique as 20260629000000_issue_status_model).

PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_spans_transaction;
DROP INDEX IF EXISTS idx_spans_project_op;
DROP INDEX IF EXISTS idx_spans_trace;
DROP INDEX IF EXISTS idx_spans_span_id;

CREATE TABLE spans_new (
    id                TEXT PRIMARY KEY,
    transaction_id    TEXT REFERENCES transactions(id) ON DELETE CASCADE,
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

    platform          VARCHAR(64),
    release           VARCHAR(250),
    environment       VARCHAR(64),

    tags              TEXT,
    data              TEXT NOT NULL
);

INSERT INTO spans_new (
    id, transaction_id, project_id,
    span_id, trace_id, parent_span_id,
    op, description, status,
    start_timestamp, timestamp, duration_ms, exclusive_time_ms,
    is_segment, segment_id,
    tags, data
)
SELECT
    id, transaction_id, project_id,
    span_id, trace_id, parent_span_id,
    op, description, status,
    start_timestamp, timestamp, duration_ms, exclusive_time_ms,
    is_segment, segment_id,
    tags, data
FROM spans;

DROP TABLE spans;
ALTER TABLE spans_new RENAME TO spans;

CREATE INDEX idx_spans_transaction    ON spans(transaction_id);
CREATE INDEX idx_spans_project_op     ON spans(project_id, op);
CREATE INDEX idx_spans_trace          ON spans(trace_id);
CREATE INDEX idx_spans_span_id        ON spans(span_id);
CREATE INDEX idx_spans_project_trace  ON spans(project_id, trace_id);

PRAGMA foreign_keys = ON;
