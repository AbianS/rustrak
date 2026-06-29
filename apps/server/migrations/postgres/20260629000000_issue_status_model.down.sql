-- Revert the issue status model back to is_resolved/is_muted booleans.

ALTER TABLE issues
    ADD COLUMN is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN is_muted    BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE issues
SET is_resolved = (status = 'resolved'),
    is_muted    = (status = 'ignored');

DROP INDEX IF EXISTS idx_issues_project_status;

ALTER TABLE issues
    DROP COLUMN status,
    DROP COLUMN substatus,
    DROP COLUMN priority,
    DROP COLUMN priority_locked_at,
    DROP COLUMN culprit,
    DROP COLUMN logger,
    DROP COLUMN status_details,
    DROP COLUMN assigned_to,
    DROP COLUMN assignee_type,
    DROP COLUMN issue_type,
    DROP COLUMN issue_category,
    DROP COLUMN first_release,
    DROP COLUMN last_release;

CREATE INDEX idx_issues_project_open
    ON issues(project_id, is_resolved, is_muted, last_seen DESC);
CREATE INDEX idx_issues_project_resolved
    ON issues(project_id, is_resolved, last_seen DESC);
