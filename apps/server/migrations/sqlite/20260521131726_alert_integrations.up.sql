-- SQLite migration: Alert Two-Tier Integrations
-- Equivalent of the Postgres migration; uses SQLite-compatible syntax.
-- SQLite does not support JSONB operators or DROP/ADD CONSTRAINT, so we
-- recreate tables where the schema needs structural changes.

-- =============================================================================
-- Step 1: Create alert_integrations table
-- =============================================================================

CREATE TABLE alert_integrations (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT NOT NULL UNIQUE,
    provider_type        TEXT NOT NULL CHECK (provider_type IN ('slack', 'email', 'webhook')),
    credentials          TEXT NOT NULL DEFAULT '{}',
    is_enabled           INTEGER NOT NULL DEFAULT 1,
    failure_count        INTEGER NOT NULL DEFAULT 0,
    last_failure_at      TEXT,
    last_failure_message TEXT,
    last_success_at      TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_alert_integrations_enabled ON alert_integrations (is_enabled) WHERE is_enabled = 1;

-- =============================================================================
-- Step 2: Migrate data from notification_channels → alert_integrations
-- =============================================================================

INSERT INTO alert_integrations (
    id, name, provider_type, credentials,
    is_enabled, failure_count, last_failure_at, last_failure_message, last_success_at,
    created_at, updated_at
)
SELECT
    nc.id,
    nc.name,
    nc.channel_type AS provider_type,
    CASE
        WHEN nc.channel_type = 'slack'
             AND json_extract(nc.config, '$.method') = 'bot_token'
        THEN
            json_remove(nc.config, '$.channel', '$.username', '$.icon_emoji')
        WHEN nc.channel_type = 'email' THEN
            json_remove(nc.config, '$.recipients')
        ELSE
            nc.config
    END AS credentials,
    nc.is_enabled,
    nc.failure_count,
    nc.last_failure_at,
    nc.last_failure_message,
    nc.last_success_at,
    nc.created_at,
    nc.updated_at
FROM notification_channels nc;

-- =============================================================================
-- Step 3: Recreate alert_rule_channels with integration_id and routing_override
-- SQLite cannot rename a PK column in-place; recreate the table.
-- =============================================================================

CREATE TABLE alert_rule_channels_new (
    alert_rule_id  INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    integration_id INTEGER NOT NULL REFERENCES alert_integrations(id) ON DELETE CASCADE,
    routing_override TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (alert_rule_id, integration_id)
);

INSERT INTO alert_rule_channels_new (alert_rule_id, integration_id, routing_override)
SELECT
    arc.alert_rule_id,
    arc.channel_id,
    CASE
        WHEN nc.channel_type = 'slack'
             AND json_extract(nc.config, '$.method') = 'bot_token'
        THEN
            json_patch('{}', json_object(
                'channel',    json_extract(nc.config, '$.channel'),
                'username',   json_extract(nc.config, '$.username'),
                'icon_emoji', json_extract(nc.config, '$.icon_emoji')
            ))
        WHEN nc.channel_type = 'email' THEN
            json_object('recipients', json_extract(nc.config, '$.recipients'))
        ELSE
            '{}'
    END
FROM alert_rule_channels arc
LEFT JOIN notification_channels nc ON arc.channel_id = nc.id;

DROP TABLE alert_rule_channels;
ALTER TABLE alert_rule_channels_new RENAME TO alert_rule_channels;

-- =============================================================================
-- Step 4: Recreate alert_history with integration_id (rename channel_id)
-- =============================================================================

CREATE TABLE alert_history_new (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_rule_id    INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
    integration_id   INTEGER REFERENCES alert_integrations(id) ON DELETE SET NULL,
    issue_id         TEXT REFERENCES issues(id) ON DELETE SET NULL,
    project_id       INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    alert_type       TEXT NOT NULL,
    channel_type     TEXT NOT NULL,
    channel_name     TEXT NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    attempt_count    INTEGER NOT NULL DEFAULT 0,
    next_retry_at    TEXT,
    error_message    TEXT,
    http_status_code INTEGER,
    idempotency_key  TEXT NOT NULL UNIQUE,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at          TEXT
);

INSERT INTO alert_history_new (
    id, alert_rule_id, integration_id, issue_id, project_id,
    alert_type, channel_type, channel_name, status,
    attempt_count, next_retry_at, error_message, http_status_code,
    idempotency_key, created_at, sent_at
)
SELECT
    id, alert_rule_id, channel_id, issue_id, project_id,
    alert_type, channel_type, channel_name, status,
    attempt_count, next_retry_at, error_message, http_status_code,
    idempotency_key, created_at, sent_at
FROM alert_history;

DROP TABLE alert_history;
ALTER TABLE alert_history_new RENAME TO alert_history;

-- Restore indexes
CREATE INDEX idx_alert_history_pending ON alert_history(next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_alert_history_issue ON alert_history(issue_id);
CREATE INDEX idx_alert_history_project ON alert_history(project_id);

-- =============================================================================
-- Step 5: Drop notification_channels
-- =============================================================================

DROP TABLE notification_channels;
