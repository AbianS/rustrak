-- Groupings table: maps grouping keys to issues
CREATE TABLE groupings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,

    -- The actual grouping key (can be long)
    grouping_key TEXT NOT NULL,

    -- SHA256 hash for indexed lookups (64 hex chars)
    grouping_key_hash CHAR(64) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint on hash for fast lookups
    UNIQUE(project_id, grouping_key_hash)
);

CREATE INDEX idx_groupings_issue ON groupings(issue_id);
