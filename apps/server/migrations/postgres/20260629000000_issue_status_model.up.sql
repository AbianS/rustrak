-- Issue status model: replace is_resolved/is_muted booleans with a Sentry-style
-- status + substatus state machine, plus priority/culprit/logger/metadata.
-- Aligns Rustrak's Issue model with Sentry's issue lifecycle (GH #165).

-- issue_type/issue_category are deliberately left unconstrained: the server
-- only ever writes 'error' today (see IssueService::create), and Rustrak's
-- Sentry-compat surface for the other categories (performance, cron, replay,
-- ...) isn't implemented yet — see /docs/FUTURE_FEATURES.md.
ALTER TABLE issues
    ADD COLUMN status            VARCHAR(20)  NOT NULL DEFAULT 'unresolved'
        CHECK (status IN ('unresolved', 'resolved', 'ignored')),
    ADD COLUMN substatus         VARCHAR(32)
        CHECK (substatus IS NULL OR substatus IN (
            'new', 'ongoing', 'escalating', 'regressed',
            'archived_until_escalating', 'archived_until_condition_met', 'archived_forever'
        )),
    ADD COLUMN priority          VARCHAR(10)
        CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high')),
    ADD COLUMN priority_locked_at TIMESTAMPTZ,
    ADD COLUMN culprit           VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN logger            VARCHAR(128) NOT NULL DEFAULT '',
    ADD COLUMN status_details    TEXT         NOT NULL DEFAULT '{}',
    ADD COLUMN assigned_to       INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN assignee_type     VARCHAR(10)
        CHECK (assignee_type IS NULL OR assignee_type IN ('user', 'team')),
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
