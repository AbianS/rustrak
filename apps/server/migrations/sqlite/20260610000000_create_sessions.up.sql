-- Release health: session rollup tables (SQLite dialect)
-- Datetimes stored as TEXT; UUIDs stored as TEXT.

CREATE TABLE session_counts (
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    release     TEXT    NOT NULL,
    environment TEXT    NOT NULL,
    bucket      TEXT    NOT NULL,  -- ISO-8601 datetime (minute-truncated)
    total       INTEGER NOT NULL DEFAULT 0,
    errored     INTEGER NOT NULL DEFAULT 0,
    crashed     INTEGER NOT NULL DEFAULT 0,
    abnormal    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, release, environment, bucket)
);

CREATE INDEX idx_session_counts_project_bucket ON session_counts(project_id, bucket DESC);

CREATE TABLE session_users (
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    release     TEXT    NOT NULL,
    environment TEXT    NOT NULL,
    day         TEXT    NOT NULL,  -- ISO-8601 date (YYYY-MM-DD)
    did         TEXT    NOT NULL,
    crashed     INTEGER NOT NULL DEFAULT 0,  -- 0=false, 1=true
    PRIMARY KEY (project_id, release, environment, day, did)
);

CREATE INDEX idx_session_users_project_day ON session_users(project_id, day DESC);
