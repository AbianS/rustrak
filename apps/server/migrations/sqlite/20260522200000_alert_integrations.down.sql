-- SQLite down migration: revert Alert Two-Tier Integrations

-- =============================================================================
-- Step 1: Recreate notification_channels
-- =============================================================================

CREATE TABLE notification_channels (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT NOT NULL UNIQUE,
    channel_type         TEXT NOT NULL CHECK (channel_type IN ('webhook', 'email', 'slack')),
    config               TEXT NOT NULL DEFAULT '{}',
    is_enabled           INTEGER NOT NULL DEFAULT 1,
    failure_count        INTEGER NOT NULL DEFAULT 0,
    last_failure_at      TEXT,
    last_failure_message TEXT,
    last_success_at      TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Restore data (merge credentials + routing_override back into config)
-- Simplified: just use credentials as config (routing_override is lost)
INSERT INTO notification_channels (
    id, name, channel_type, config,
    is_enabled, failure_count, last_failure_at, last_failure_message, last_success_at,
    created_at, updated_at
)
SELECT
    id, name, provider_type, credentials,
    is_enabled, failure_count, last_failure_at, last_failure_message, last_success_at,
    created_at, updated_at
FROM alert_integrations;

-- =============================================================================
-- Step 2: Recreate alert_rule_channels with channel_id
-- =============================================================================

CREATE TABLE alert_rule_channels_old (
    alert_rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    channel_id    INTEGER NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    PRIMARY KEY (alert_rule_id, channel_id)
);

INSERT INTO alert_rule_channels_old (alert_rule_id, channel_id)
SELECT alert_rule_id, integration_id FROM alert_rule_channels;

DROP TABLE alert_rule_channels;
ALTER TABLE alert_rule_channels_old RENAME TO alert_rule_channels;

-- =============================================================================
-- Step 3: Recreate alert_history with channel_id
-- =============================================================================

CREATE TABLE alert_history_old (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_rule_id    INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
    channel_id       INTEGER REFERENCES notification_channels(id) ON DELETE SET NULL,
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

INSERT INTO alert_history_old (
    id, alert_rule_id, channel_id, issue_id, project_id,
    alert_type, channel_type, channel_name, status,
    attempt_count, next_retry_at, error_message, http_status_code,
    idempotency_key, created_at, sent_at
)
SELECT
    id, alert_rule_id, integration_id, issue_id, project_id,
    alert_type, channel_type, channel_name, status,
    attempt_count, next_retry_at, error_message, http_status_code,
    idempotency_key, created_at, sent_at
FROM alert_history;

DROP TABLE alert_history;
ALTER TABLE alert_history_old RENAME TO alert_history;

CREATE INDEX idx_alert_history_pending ON alert_history(next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_alert_history_issue ON alert_history(issue_id);
CREATE INDEX idx_alert_history_project ON alert_history(project_id);

-- =============================================================================
-- Step 4: Drop alert_integrations
-- =============================================================================

DROP TABLE alert_integrations;

CREATE INDEX idx_notification_channels_enabled ON notification_channels(is_enabled) WHERE is_enabled = 1;
