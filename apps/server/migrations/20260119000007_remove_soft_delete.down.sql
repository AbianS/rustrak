-- Restore soft delete to projects table

-- Add back the is_deleted column
ALTER TABLE projects ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Drop the simple indexes
DROP INDEX IF EXISTS idx_projects_sentry_key;
DROP INDEX IF EXISTS idx_projects_slug;

-- Recreate partial indexes with WHERE NOT is_deleted
CREATE INDEX idx_projects_sentry_key ON projects(sentry_key) WHERE NOT is_deleted;
CREATE INDEX idx_projects_slug ON projects(slug) WHERE NOT is_deleted;
