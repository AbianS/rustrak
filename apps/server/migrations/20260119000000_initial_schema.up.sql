-- Rustrak Initial Schema
-- Creates the base tables for the error tracking system

-- Schema info table for tracking metadata
CREATE TABLE IF NOT EXISTS schema_info (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_info (key, value) VALUES
    ('version', '1.0.0'),
    ('initialized_at', NOW()::TEXT);

-- Projects table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    sentry_key UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    stored_event_count INTEGER NOT NULL DEFAULT 0,
    digested_event_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Index for fast sentry_key lookups (only active projects)
CREATE INDEX idx_projects_sentry_key ON projects(sentry_key)
    WHERE NOT is_deleted;

-- Index for slug lookups
CREATE INDEX idx_projects_slug ON projects(slug)
    WHERE NOT is_deleted;

-- Function to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for projects.updated_at
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
