-- Replace soft delete on issues with hard delete.
-- Events and groupings already have ON DELETE CASCADE, so hard delete is safe.

-- Purge any previously soft-deleted rows before dropping the column,
-- so they are not resurrected as visible issues after the column is gone.
DELETE FROM issues WHERE is_deleted = TRUE;

-- Drop partial indexes that filter on is_deleted
DROP INDEX IF EXISTS idx_issues_project_last_seen;
DROP INDEX IF EXISTS idx_issues_project_open;
DROP INDEX IF EXISTS idx_issues_project_resolved;

-- Remove the soft-delete column
ALTER TABLE issues DROP COLUMN is_deleted;

-- Recreate indexes without the WHERE NOT is_deleted predicate
CREATE INDEX idx_issues_project_last_seen
    ON issues(project_id, last_seen DESC);

CREATE INDEX idx_issues_project_open
    ON issues(project_id, is_resolved, is_muted, last_seen DESC);

CREATE INDEX idx_issues_project_resolved
    ON issues(project_id, is_resolved, last_seen DESC);
