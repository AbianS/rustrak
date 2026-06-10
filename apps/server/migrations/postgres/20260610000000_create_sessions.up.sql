-- Release health: session rollup tables
-- One row per (project, release, env, minute-bucket); never one row per raw session update.

CREATE TABLE session_counts (
    project_id  INTEGER     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    release     TEXT        NOT NULL,
    environment TEXT        NOT NULL,
    bucket      TIMESTAMPTZ NOT NULL,
    total       BIGINT      NOT NULL DEFAULT 0,
    errored     BIGINT      NOT NULL DEFAULT 0,
    crashed     BIGINT      NOT NULL DEFAULT 0,
    abnormal    BIGINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, release, environment, bucket)
);

CREATE INDEX idx_session_counts_project_bucket ON session_counts(project_id, bucket DESC);

-- Distinct-user tracking for crash-free-users rate.
-- Day-bucketed so cardinality is bounded by users/day, not traffic.
-- crashed=TRUE on the row means this user had a crashed session on this day.
CREATE TABLE session_users (
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    release     TEXT    NOT NULL,
    environment TEXT    NOT NULL,
    day         DATE    NOT NULL,
    did         TEXT    NOT NULL,
    crashed     BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (project_id, release, environment, day, did)
);

CREATE INDEX idx_session_users_project_day ON session_users(project_id, day DESC);
