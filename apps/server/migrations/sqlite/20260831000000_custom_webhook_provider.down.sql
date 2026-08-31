-- Restore the three-value CHECK (table rebuild — SQLite cannot alter it).
--
-- custom_webhook integrations cannot satisfy the old constraint and a
-- rolled-back build has no dispatcher for them, so their rows go first: the
-- DELETE fires the children's ON DELETE CASCADE / SET NULL actions for those
-- integrations only. Everything else must survive the rebuild itself, so the
-- child references are parked around the DROP exactly as in .up.sql.

DELETE FROM alert_integrations WHERE provider_type = 'custom_webhook';

CREATE TABLE alert_integrations_old (
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

INSERT INTO alert_integrations_old (
    id, name, provider_type, credentials,
    is_enabled, failure_count, last_failure_at, last_failure_message, last_success_at,
    created_at, updated_at
)
SELECT
    id, name, provider_type, credentials,
    is_enabled, failure_count, last_failure_at, last_failure_message, last_success_at,
    created_at, updated_at
FROM alert_integrations;

CREATE TABLE arc_references_backup AS
    SELECT alert_rule_id, integration_id, routing_override FROM alert_rule_channels;
CREATE TABLE ah_references_backup AS
    SELECT id, integration_id FROM alert_history;

DELETE FROM alert_rule_channels;
UPDATE alert_history SET integration_id = NULL;

DROP TABLE alert_integrations;
ALTER TABLE alert_integrations_old RENAME TO alert_integrations;

CREATE INDEX idx_alert_integrations_enabled ON alert_integrations (is_enabled) WHERE is_enabled = 1;

INSERT INTO alert_rule_channels (alert_rule_id, integration_id, routing_override)
    SELECT alert_rule_id, integration_id, routing_override FROM arc_references_backup;
UPDATE alert_history
SET integration_id = (
    SELECT b.integration_id FROM ah_references_backup b WHERE b.id = alert_history.id
);

DROP TABLE arc_references_backup;
DROP TABLE ah_references_backup;
