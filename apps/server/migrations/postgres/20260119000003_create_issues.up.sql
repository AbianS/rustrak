-- Issues table: groups of similar events
CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Ordering (1-based, per project)
    digest_order INTEGER NOT NULL,

    -- Timestamps
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,

    -- Counters
    digested_event_count INTEGER NOT NULL DEFAULT 1,
    stored_event_count INTEGER NOT NULL DEFAULT 1,

    -- Denormalized fields for display
    calculated_type VARCHAR(128) NOT NULL DEFAULT '',
    calculated_value TEXT NOT NULL DEFAULT '',
    transaction VARCHAR(200) NOT NULL DEFAULT '',
    last_frame_filename VARCHAR(255) NOT NULL DEFAULT '',
    last_frame_module VARCHAR(255) NOT NULL DEFAULT '',
    last_frame_function VARCHAR(255) NOT NULL DEFAULT '',

    -- Event metadata
    level VARCHAR(20),
    platform VARCHAR(64),

    -- State
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    is_muted BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    -- Constraints
    UNIQUE(project_id, digest_order)
);

-- Indexes for list views
CREATE INDEX idx_issues_project_last_seen
    ON issues(project_id, last_seen DESC)
    WHERE NOT is_deleted;

CREATE INDEX idx_issues_project_open
    ON issues(project_id, is_resolved, is_muted, last_seen DESC)
    WHERE NOT is_deleted;

CREATE INDEX idx_issues_project_resolved
    ON issues(project_id, is_resolved, last_seen DESC)
    WHERE NOT is_deleted;
