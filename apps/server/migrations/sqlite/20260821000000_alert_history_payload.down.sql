CREATE TABLE alert_history_old (
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

INSERT INTO alert_history_old (
    id, alert_rule_id, integration_id, issue_id, project_id,
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
