-- Alerting System Tables
-- Provides notification channels and per-project alert rules

-- Global notification channels (configured at organization/settings level)
CREATE TABLE notification_channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    channel_type VARCHAR(50) NOT NULL CHECK (channel_type IN ('webhook', 'email', 'slack')),
    config JSONB NOT NULL DEFAULT '{}',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    last_failure_message TEXT,
    last_success_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-project alert rules
CREATE TABLE alert_rules (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('new_issue', 'regression', 'unmute')),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    conditions JSONB NOT NULL DEFAULT '{}',
    cooldown_minutes INTEGER NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, alert_type)
);

-- Junction table: which channels receive which alert rules
CREATE TABLE alert_rule_channels (
    alert_rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    channel_id INTEGER NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    PRIMARY KEY (alert_rule_id, channel_id)
);

-- Alert history: audit log and retry queue
CREATE TABLE alert_history (
    id BIGSERIAL PRIMARY KEY,
    alert_rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
    channel_id INTEGER REFERENCES notification_channels(id) ON DELETE SET NULL,
    issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL,
    channel_type VARCHAR(50) NOT NULL,
    channel_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    http_status_code INTEGER,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- Indexes for efficient queries
CREATE INDEX idx_notification_channels_enabled ON notification_channels(is_enabled) WHERE is_enabled;
CREATE INDEX idx_alert_rules_project ON alert_rules(project_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(project_id, is_enabled) WHERE is_enabled;
CREATE INDEX idx_alert_history_pending ON alert_history(next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_alert_history_issue ON alert_history(issue_id);
CREATE INDEX idx_alert_history_project ON alert_history(project_id);
