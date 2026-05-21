-- Restore soft delete column and partial indexes on issues.
-- WARNING: This migration only restores the schema structure.
-- Any rows that were hard-deleted when the up migration ran cannot be recovered.
-- Do NOT use this rollback after the up migration has been applied to a live database
-- without a prior backup.

-- Drop the unconditional indexes
DROP INDEX IF EXISTS idx_issues_project_last_seen;
DROP INDEX IF EXISTS idx_issues_project_open;
DROP INDEX IF EXISTS idx_issues_project_resolved;

-- Restore the is_deleted column (existing rows are treated as not deleted)
ALTER TABLE issues ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Recreate partial indexes with WHERE NOT is_deleted
CREATE INDEX idx_issues_project_last_seen
    ON issues(project_id, last_seen DESC)
    WHERE NOT is_deleted;

CREATE INDEX idx_issues_project_open
    ON issues(project_id, is_resolved, is_muted, last_seen DESC)
    WHERE NOT is_deleted;

CREATE INDEX idx_issues_project_resolved
    ON issues(project_id, is_resolved, last_seen DESC)
    WHERE NOT is_deleted;
