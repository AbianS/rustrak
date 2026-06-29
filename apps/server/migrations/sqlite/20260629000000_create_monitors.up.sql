-- Sentry Crons: monitors + check-ins (issue #143) — SQLite dialect.
-- TEXT for UUIDs/timestamps, REAL for duration, INTEGER for minute fields.

CREATE TABLE monitors (
    id                   TEXT PRIMARY KEY,
    project_id           INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    slug                 VARCHAR(50) NOT NULL,

    schedule_type        VARCHAR(16),
    schedule_value       TEXT,
    schedule_unit        VARCHAR(8),
    checkin_margin       INTEGER,
    max_runtime          INTEGER,
    timezone             VARCHAR(64),
    owner                VARCHAR(255),

    status               VARCHAR(16) NOT NULL DEFAULT 'active',
    last_check_in_at     TEXT,
    last_check_in_status VARCHAR(16),
    next_expected_at     TEXT,

    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(project_id, slug)
);

CREATE INDEX idx_monitors_project       ON monitors(project_id);
CREATE INDEX idx_monitors_next_expected ON monitors(next_expected_at);

CREATE TABLE check_ins (
    id           TEXT PRIMARY KEY,
    monitor_id   TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    check_in_id  TEXT,

    status       VARCHAR(16) NOT NULL,
    duration     REAL,
    environment  VARCHAR(64),
    trace_id     VARCHAR(64),

    timestamp    TEXT NOT NULL,
    ingested_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_check_ins_monitor          ON check_ins(monitor_id, timestamp DESC);
CREATE INDEX idx_check_ins_project_ingested ON check_ins(project_id, ingested_at DESC);
CREATE INDEX idx_check_ins_lifecycle        ON check_ins(monitor_id, check_in_id);
