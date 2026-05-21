-- Replace soft delete on issues with hard delete (SQLite).
-- SQLite does not support DROP COLUMN in older versions; we recreate the table.

-- Purge previously soft-deleted rows so they are not resurrected.
DELETE FROM issues WHERE is_deleted = 1;

-- Drop partial indexes (must happen before table recreation)
DROP INDEX IF EXISTS idx_issues_project_last_seen;
DROP INDEX IF EXISTS idx_issues_project_open;
DROP INDEX IF EXISTS idx_issues_project_resolved;

-- Recreate issues table without is_deleted column
CREATE TABLE issues_new (
    id TEXT PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    digest_order INTEGER NOT NULL,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    digested_event_count INTEGER NOT NULL DEFAULT 1,
    stored_event_count INTEGER NOT NULL DEFAULT 1,
    calculated_type VARCHAR(128) NOT NULL DEFAULT '',
    calculated_value TEXT NOT NULL DEFAULT '',
    "transaction" VARCHAR(200) NOT NULL DEFAULT '',
    last_frame_filename VARCHAR(255) NOT NULL DEFAULT '',
    last_frame_module VARCHAR(255) NOT NULL DEFAULT '',
    last_frame_function VARCHAR(255) NOT NULL DEFAULT '',
    level VARCHAR(20),
    platform VARCHAR(64),
    is_resolved INTEGER NOT NULL DEFAULT 0,
    is_muted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(project_id, digest_order)
);

INSERT INTO issues_new
SELECT
    id, project_id, digest_order, first_seen, last_seen,
    digested_event_count, stored_event_count,
    calculated_type, calculated_value, "transaction",
    last_frame_filename, last_frame_module, last_frame_function,
    level, platform, is_resolved, is_muted
FROM issues;

DROP TABLE issues;
ALTER TABLE issues_new RENAME TO issues;

-- Recreate indexes without WHERE NOT is_deleted
CREATE INDEX idx_issues_project_last_seen
    ON issues(project_id, last_seen DESC);

CREATE INDEX idx_issues_project_open
    ON issues(project_id, is_resolved, is_muted, last_seen DESC);

CREATE INDEX idx_issues_project_resolved
    ON issues(project_id, is_resolved, last_seen DESC);
