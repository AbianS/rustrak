-- Issue status model (SQLite): replace is_resolved/is_muted booleans with a
-- Sentry-style status + substatus state machine, plus priority/culprit/logger
-- /metadata. SQLite cannot ALTER complex constraints, so we recreate the table.

PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_issues_project_last_seen;
DROP INDEX IF EXISTS idx_issues_project_open;
DROP INDEX IF EXISTS idx_issues_project_resolved;

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
    -- new status model
    status VARCHAR(20) NOT NULL DEFAULT 'unresolved',
    substatus VARCHAR(32),
    priority VARCHAR(10),
    priority_locked_at TEXT,
    culprit VARCHAR(255) NOT NULL DEFAULT '',
    logger VARCHAR(128) NOT NULL DEFAULT '',
    status_details TEXT NOT NULL DEFAULT '{}',
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assignee_type VARCHAR(10),
    issue_type VARCHAR(20) NOT NULL DEFAULT 'error',
    issue_category VARCHAR(20) NOT NULL DEFAULT 'error',
    first_release VARCHAR(250) NOT NULL DEFAULT '',
    last_release VARCHAR(250) NOT NULL DEFAULT '',
    UNIQUE(project_id, digest_order)
);

INSERT INTO issues_new (
    id, project_id, digest_order, first_seen, last_seen,
    digested_event_count, stored_event_count,
    calculated_type, calculated_value, "transaction",
    last_frame_filename, last_frame_module, last_frame_function,
    level, platform, status, substatus
)
SELECT
    id, project_id, digest_order, first_seen, last_seen,
    digested_event_count, stored_event_count,
    calculated_type, calculated_value, "transaction",
    last_frame_filename, last_frame_module, last_frame_function,
    level, platform,
    CASE WHEN is_resolved = 1 THEN 'resolved'
         WHEN is_muted = 1 THEN 'ignored'
         ELSE 'unresolved' END,
    CASE WHEN is_resolved = 1 THEN NULL
         WHEN is_muted = 1 THEN 'archived_forever'
         ELSE 'ongoing' END
FROM issues;

DROP TABLE issues;
ALTER TABLE issues_new RENAME TO issues;

CREATE INDEX idx_issues_project_last_seen ON issues(project_id, last_seen DESC);
CREATE INDEX idx_issues_project_status ON issues(project_id, status, last_seen DESC);

PRAGMA foreign_keys = ON;
