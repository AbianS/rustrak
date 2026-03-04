-- Remove soft delete from projects table (we use hard delete)

-- Drop partial indexes that use is_deleted
DROP INDEX IF EXISTS idx_projects_sentry_key;
DROP INDEX IF EXISTS idx_projects_slug;

-- Recreate indexes without the WHERE clause
CREATE INDEX idx_projects_sentry_key ON projects(sentry_key);
CREATE INDEX idx_projects_slug ON projects(slug);

-- Remove the is_deleted column
ALTER TABLE projects DROP COLUMN is_deleted;
