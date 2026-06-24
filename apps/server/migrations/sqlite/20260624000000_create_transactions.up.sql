-- Dedicated transactions table (issue #142, Fase 1) — SQLite dialect.
-- TEXT for UUIDs/timestamps/JSON, REAL for duration (maps to f64).
CREATE TABLE transactions (
    id               TEXT PRIMARY KEY,
    event_id         TEXT NOT NULL,
    project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    trace_id         TEXT,
    transaction_name VARCHAR(200) NOT NULL DEFAULT '',
    op               VARCHAR(64),
    status           VARCHAR(32),
    source           VARCHAR(32) NOT NULL DEFAULT 'unknown',
    span_id          TEXT,
    parent_span_id   TEXT,

    start_timestamp  TEXT,
    timestamp        TEXT NOT NULL,
    duration_ms      REAL,

    platform         VARCHAR(64)  NOT NULL DEFAULT '',
    environment      VARCHAR(64)  NOT NULL DEFAULT '',
    release          VARCHAR(250) NOT NULL DEFAULT '',
    server_name      VARCHAR(255) NOT NULL DEFAULT '',
    sdk_name         VARCHAR(255) NOT NULL DEFAULT '',
    sdk_version      VARCHAR(255) NOT NULL DEFAULT '',
    level            VARCHAR(20)  NOT NULL DEFAULT 'info',

    measurements     TEXT,
    tags             TEXT,
    contexts         TEXT,
    request          TEXT,
    "user"           TEXT,
    data             TEXT NOT NULL,
    remote_addr      TEXT,
    ingested_at      TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(project_id, event_id)
);

CREATE INDEX idx_transactions_project_ingested ON transactions(project_id, ingested_at DESC);
CREATE INDEX idx_transactions_project_name     ON transactions(project_id, transaction_name);
CREATE INDEX idx_transactions_project_op       ON transactions(project_id, op);
CREATE INDEX idx_transactions_project_status   ON transactions(project_id, status);
CREATE INDEX idx_transactions_trace            ON transactions(trace_id);
