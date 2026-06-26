-- Dedicated logs table (issue #143) — SQLite dialect.
-- TEXT for UUIDs/timestamps/JSON, INTEGER for severity_number.
CREATE TABLE logs (
    id              TEXT PRIMARY KEY,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    trace_id        TEXT,
    span_id         TEXT,

    level           VARCHAR(20) NOT NULL DEFAULT 'info',
    severity_number INTEGER,
    body            TEXT NOT NULL DEFAULT '',
    attributes      TEXT,

    timestamp       TEXT NOT NULL,
    ingested_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_logs_project_timestamp ON logs(project_id, timestamp DESC);
CREATE INDEX idx_logs_project_ingested  ON logs(project_id, ingested_at DESC);
CREATE INDEX idx_logs_project_level     ON logs(project_id, level);
CREATE INDEX idx_logs_trace             ON logs(trace_id);
