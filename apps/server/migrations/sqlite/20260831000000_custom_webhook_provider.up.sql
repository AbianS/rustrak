-- SQLite migration: Custom Webhook provider type
-- Equivalent of the Postgres migration. SQLite cannot alter a CHECK
-- constraint in place, so the table is recreated (same pattern as
-- 20260522200000_alert_integrations). IDs are preserved; child FKs
-- (alert_rule_channels, alert_history) reference the table by name and
-- resolve again once the rename restores it.

CREATE TABLE alert_integrations_new (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT NOT NULL UNIQUE,
    provider_type        TEXT NOT NULL CHECK (provider_type IN ('slack', 'email', 'webhook', 'custom_webhook')),
    credentials          TEXT NOT NULL DEFAULT '{}',
    is_enabled           INTEGER NOT NULL DEFAULT 1,
    failure_count        INTEGER NOT NULL DEFAULT 0,
    last_failure_at      TEXT,
    last_failure_message TEXT,
    last_success_at      TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO alert_integrations_new (
    id, name, provider_type, credentials,
    is_enabled, failure_count, last_failure_at, last_failure_message, last_success_at,
    created_at, updated_at
)
SELECT
    id, name, provider_type, credentials,
    is_enabled, failure_count, last_failure_at, last_failure_message, last_success_at,
    created_at, updated_at
FROM alert_integrations;

DROP TABLE alert_integrations;
ALTER TABLE alert_integrations_new RENAME TO alert_integrations;

-- Restore index dropped with the old table
CREATE INDEX idx_alert_integrations_enabled ON alert_integrations (is_enabled) WHERE is_enabled = 1;
