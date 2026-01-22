-- Rate Limiting: Installation singleton table for global quotas
CREATE TABLE installation (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Singleton constraint
    digested_event_count BIGINT NOT NULL DEFAULT 0,
    quota_exceeded_until TIMESTAMPTZ,
    quota_exceeded_reason TEXT,  -- JSON: ["minute", 1, 1000]
    next_quota_check BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert singleton row
INSERT INTO installation (id) VALUES (1);

-- Rate Limiting: Add quota fields to projects
ALTER TABLE projects ADD COLUMN quota_exceeded_until TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN quota_exceeded_reason TEXT;
ALTER TABLE projects ADD COLUMN next_quota_check BIGINT NOT NULL DEFAULT 0;
