-- Dedicated logs table (issue #143) — standalone Sentry "log" item type (OurLog).
-- Logs arrive batched in an item container and are expanded to one row each.
-- Mirrors the transactions table pattern: denormalized queryable columns +
-- the typed attribute map kept verbatim in JSONB. `ingested_at` + `project_id`
-- are the retention keys consumed by the storage cleanup service.
CREATE TABLE logs (
    id              UUID PRIMARY KEY,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Trace correlation (trace_id required by the protocol; span_id optional).
    trace_id        VARCHAR(64),
    span_id         VARCHAR(32),

    -- Denormalized for filtering/sorting; attributes keeps the OTel typed map.
    level           VARCHAR(20) NOT NULL DEFAULT 'info',
    severity_number SMALLINT,
    body            TEXT NOT NULL DEFAULT '',
    attributes      JSONB,

    timestamp       TIMESTAMPTZ NOT NULL,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logs_project_timestamp ON logs(project_id, timestamp DESC);
CREATE INDEX idx_logs_project_ingested  ON logs(project_id, ingested_at DESC);
CREATE INDEX idx_logs_project_level     ON logs(project_id, level);
CREATE INDEX idx_logs_trace             ON logs(trace_id);
