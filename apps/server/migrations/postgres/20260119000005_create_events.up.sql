-- Events table: individual error occurrences
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- External event_id (from SDK)
    event_id UUID NOT NULL,

    -- Relations
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    grouping_id INTEGER NOT NULL REFERENCES groupings(id) ON DELETE CASCADE,

    -- Full event data (JSON)
    data JSONB NOT NULL,

    -- Timestamps
    timestamp TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL,
    digested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Denormalized fields
    calculated_type VARCHAR(128) NOT NULL DEFAULT '',
    calculated_value TEXT NOT NULL DEFAULT '',
    transaction VARCHAR(200) NOT NULL DEFAULT '',
    last_frame_filename VARCHAR(255) NOT NULL DEFAULT '',
    last_frame_module VARCHAR(255) NOT NULL DEFAULT '',
    last_frame_function VARCHAR(255) NOT NULL DEFAULT '',

    -- Event metadata
    level VARCHAR(20) NOT NULL DEFAULT 'error',
    platform VARCHAR(64) NOT NULL DEFAULT '',
    release VARCHAR(250) NOT NULL DEFAULT '',
    environment VARCHAR(64) NOT NULL DEFAULT '',
    server_name VARCHAR(255) NOT NULL DEFAULT '',

    -- SDK info
    sdk_name VARCHAR(255) NOT NULL DEFAULT '',
    sdk_version VARCHAR(255) NOT NULL DEFAULT '',

    -- Client info
    remote_addr INET,

    -- Ordering within issue (1-based)
    digest_order INTEGER NOT NULL,

    -- Constraints
    UNIQUE(project_id, event_id),
    UNIQUE(issue_id, digest_order)
);

-- Indexes
CREATE INDEX idx_events_issue_digested ON events(issue_id, digested_at DESC);
CREATE INDEX idx_events_project_digested ON events(project_id, digested_at DESC);
