-- Revert the SQLite issue status model back to is_resolved/is_muted booleans.

PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_issues_project_last_seen;
DROP INDEX IF EXISTS idx_issues_project_status;

CREATE TABLE issues_old (
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

INSERT INTO issues_old
SELECT
    id, project_id, digest_order, first_seen, last_seen,
    digested_event_count, stored_event_count,
    calculated_type, calculated_value, "transaction",
    last_frame_filename, last_frame_module, last_frame_function,
    level, platform,
    CASE WHEN status = 'resolved' THEN 1 ELSE 0 END,
    CASE WHEN status = 'ignored' THEN 1 ELSE 0 END
FROM issues;

DROP TABLE issues;
ALTER TABLE issues_old RENAME TO issues;

CREATE INDEX idx_issues_project_last_seen ON issues(project_id, last_seen DESC);
CREATE INDEX idx_issues_project_open ON issues(project_id, is_resolved, is_muted, last_seen DESC);
CREATE INDEX idx_issues_project_resolved ON issues(project_id, is_resolved, last_seen DESC);

PRAGMA foreign_keys = ON;
