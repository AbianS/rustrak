-- Transaction processing: typed dispatch + nullable issue/grouping refs
-- SQLite does not support ALTER COLUMN DROP NOT NULL, so we recreate the events table.

PRAGMA foreign_keys = OFF;

CREATE TABLE events_new (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id TEXT REFERENCES issues(id) ON DELETE CASCADE,           -- now nullable
    grouping_id INTEGER REFERENCES groupings(id) ON DELETE CASCADE,  -- now nullable

    data TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    ingested_at TEXT NOT NULL,
    digested_at TEXT NOT NULL DEFAULT (datetime('now')),

    calculated_type VARCHAR(128) NOT NULL DEFAULT '',
    calculated_value TEXT NOT NULL DEFAULT '',
    "transaction" VARCHAR(200) NOT NULL DEFAULT '',
    last_frame_filename VARCHAR(255) NOT NULL DEFAULT '',
    last_frame_module VARCHAR(255) NOT NULL DEFAULT '',
    last_frame_function VARCHAR(255) NOT NULL DEFAULT '',
    level VARCHAR(20) NOT NULL DEFAULT 'error',
    platform VARCHAR(64) NOT NULL DEFAULT '',
    release VARCHAR(250) NOT NULL DEFAULT '',
    environment VARCHAR(64) NOT NULL DEFAULT '',
    server_name VARCHAR(255) NOT NULL DEFAULT '',
    sdk_name VARCHAR(255) NOT NULL DEFAULT '',
    sdk_version VARCHAR(255) NOT NULL DEFAULT '',
    remote_addr TEXT,
    digest_order INTEGER NOT NULL,

    -- new columns
    event_type TEXT NOT NULL DEFAULT 'error',
    start_timestamp TEXT,
    spans TEXT,

    UNIQUE(project_id, event_id)
);

INSERT INTO events_new
    SELECT id, event_id, project_id, issue_id, grouping_id,
           data, timestamp, ingested_at, digested_at,
           calculated_type, calculated_value, "transaction",
           last_frame_filename, last_frame_module, last_frame_function,
           level, platform, release, environment, server_name,
           sdk_name, sdk_version, remote_addr, digest_order,
           'error', NULL, NULL
    FROM events;

DROP TABLE events;
ALTER TABLE events_new RENAME TO events;

CREATE INDEX idx_events_issue_digested ON events(issue_id, digested_at DESC);
CREATE INDEX idx_events_project_digested ON events(project_id, digested_at DESC);
-- Covers the transaction list query: project_id + event_type equality, then the
-- ingested_at range/order — a single index scan instead of a filesort.
CREATE INDEX idx_events_event_type ON events(project_id, event_type, ingested_at DESC);

PRAGMA foreign_keys = ON;
