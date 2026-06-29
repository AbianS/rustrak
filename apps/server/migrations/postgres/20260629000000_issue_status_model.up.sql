-- Issue status model: replace is_resolved/is_muted booleans with a Sentry-style
-- status + substatus state machine, plus priority/culprit/logger/metadata.
-- Aligns Rustrak's Issue model with Sentry's issue lifecycle (GH #165).

ALTER TABLE issues
    ADD COLUMN status            VARCHAR(20)  NOT NULL DEFAULT 'unresolved',
    ADD COLUMN substatus         VARCHAR(32),
    ADD COLUMN priority          VARCHAR(10),
    ADD COLUMN priority_locked_at TIMESTAMPTZ,
    ADD COLUMN culprit           VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN logger            VARCHAR(128) NOT NULL DEFAULT '',
    ADD COLUMN status_details    TEXT         NOT NULL DEFAULT '{}',
    ADD COLUMN assigned_to       INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN assignee_type     VARCHAR(10),
    ADD COLUMN issue_type        VARCHAR(20)  NOT NULL DEFAULT 'error',
    ADD COLUMN issue_category    VARCHAR(20)  NOT NULL DEFAULT 'error',
    ADD COLUMN first_release     VARCHAR(250) NOT NULL DEFAULT '',
    ADD COLUMN last_release      VARCHAR(250) NOT NULL DEFAULT '';

-- Migrate existing boolean state into the new model.
-- is_resolved takes precedence over is_muted (matches the old PATCH semantics).
UPDATE issues
SET status = CASE
        WHEN is_resolved THEN 'resolved'
        WHEN is_muted    THEN 'ignored'
        ELSE 'unresolved'
    END,
    substatus = CASE
        WHEN is_resolved THEN NULL
        WHEN is_muted    THEN 'archived_forever'
        ELSE 'ongoing'
    END;

DROP INDEX IF EXISTS idx_issues_project_open;
DROP INDEX IF EXISTS idx_issues_project_resolved;

ALTER TABLE issues
    DROP COLUMN is_resolved,
    DROP COLUMN is_muted;

-- Default issue list filters on (project_id, status, last_seen).
CREATE INDEX idx_issues_project_status ON issues(project_id, status, last_seen DESC);
