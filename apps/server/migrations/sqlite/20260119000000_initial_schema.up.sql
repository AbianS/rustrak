-- Rustrak SQLite Schema
-- Single migration covering the full schema (SQLite compatible)

-- Schema info table for tracking metadata
CREATE TABLE IF NOT EXISTS schema_info (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO schema_info (key, value) VALUES
    ('version', '1.0.0'),
    ('initialized_at', datetime('now'));

-- Projects table
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    sentry_key TEXT NOT NULL UNIQUE,
    stored_event_count INTEGER NOT NULL DEFAULT 0,
    digested_event_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    -- Rate limiting fields
    quota_exceeded_until TEXT,
    quota_exceeded_reason TEXT,
    next_quota_check INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_projects_sentry_key ON projects(sentry_key);
CREATE INDEX idx_projects_slug ON projects(slug);

-- Trigger for projects.updated_at
CREATE TRIGGER update_projects_updated_at
    AFTER UPDATE ON projects
    FOR EACH ROW
    BEGIN
        UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

-- Auth tokens table (global, not per-project)
CREATE TABLE auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token CHAR(40) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
);

CREATE INDEX idx_auth_tokens_token ON auth_tokens(token);

-- Issues table: groups of similar events
CREATE TABLE issues (
    id TEXT PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Ordering (1-based, per project)
    digest_order INTEGER NOT NULL,

    -- Timestamps
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,

    -- Counters
    digested_event_count INTEGER NOT NULL DEFAULT 1,
    stored_event_count INTEGER NOT NULL DEFAULT 1,

    -- Denormalized fields for display
    calculated_type VARCHAR(128) NOT NULL DEFAULT '',
    calculated_value TEXT NOT NULL DEFAULT '',
    "transaction" VARCHAR(200) NOT NULL DEFAULT '',
    last_frame_filename VARCHAR(255) NOT NULL DEFAULT '',
    last_frame_module VARCHAR(255) NOT NULL DEFAULT '',
    last_frame_function VARCHAR(255) NOT NULL DEFAULT '',

    -- Event metadata
    level VARCHAR(20),
    platform VARCHAR(64),

    -- State
    is_resolved INTEGER NOT NULL DEFAULT 0,
    is_muted INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,

    -- Constraints
    UNIQUE(project_id, digest_order)
);

CREATE INDEX idx_issues_project_last_seen
    ON issues(project_id, last_seen DESC)
    WHERE NOT is_deleted;

CREATE INDEX idx_issues_project_open
    ON issues(project_id, is_resolved, is_muted, last_seen DESC)
    WHERE NOT is_deleted;

CREATE INDEX idx_issues_project_resolved
    ON issues(project_id, is_resolved, last_seen DESC)
    WHERE NOT is_deleted;

-- Groupings table: maps grouping keys to issues
CREATE TABLE groupings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,

    grouping_key TEXT NOT NULL,
    grouping_key_hash CHAR(64) NOT NULL,

    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(project_id, grouping_key_hash)
);

CREATE INDEX idx_groupings_issue ON groupings(issue_id);

-- Events table: individual error occurrences
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    grouping_id INTEGER NOT NULL REFERENCES groupings(id) ON DELETE CASCADE,

    -- Full event data (JSON stored as text)
    data TEXT NOT NULL,

    -- Timestamps
    timestamp TEXT NOT NULL,
    ingested_at TEXT NOT NULL,
    digested_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Denormalized fields
    calculated_type VARCHAR(128) NOT NULL DEFAULT '',
    calculated_value TEXT NOT NULL DEFAULT '',
    "transaction" VARCHAR(200) NOT NULL DEFAULT '',
    last_frame_filename VARCHAR(255) NOT NULL DEFAULT '',
    last_frame_module VARCHAR(255) NOT NULL DEFAULT '',
    last_frame_function VARCHAR(255) NOT NULL DEFAULT '',

    -- Event metadata
    level VARCHAR(20) NOT NULL DEFAULT 'error',
    platform VARCHAR(64) NOT NULL DEFAULT '',
    release VARCHAR(250) NOT NULL DEFAULT '',
    environment VARCHAR(64) NOT NULL DEFAULT '',
    server_name VARCHAR(255) NOT NULL DEFAULT '',

    -- SDK info
    sdk_name VARCHAR(255) NOT NULL DEFAULT '',
    sdk_version VARCHAR(255) NOT NULL DEFAULT '',

    -- Client info (stored as text, not INET)
    remote_addr TEXT,

    -- Ordering within issue (1-based)
    digest_order INTEGER NOT NULL,

    -- Constraints
    UNIQUE(project_id, event_id),
    UNIQUE(issue_id, digest_order)
);

CREATE INDEX idx_events_issue_digested ON events(issue_id, digested_at DESC);
CREATE INDEX idx_events_project_digested ON events(project_id, digested_at DESC);

-- Rate Limiting: Installation singleton table for global quotas
CREATE TABLE installation (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    digested_event_count INTEGER NOT NULL DEFAULT 0,
    quota_exceeded_until TEXT,
    quota_exceeded_reason TEXT,
    next_quota_check INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO installation (id) VALUES (1);

-- Users table for authentication
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT
);

CREATE INDEX idx_users_email ON users(email);

-- Alerting System Tables

-- Global notification channels
CREATE TABLE notification_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    channel_type VARCHAR(50) NOT NULL CHECK (channel_type IN ('webhook', 'email', 'slack')),
    config TEXT NOT NULL DEFAULT '{}',
    is_enabled INTEGER NOT NULL DEFAULT 1,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_failure_at TEXT,
    last_failure_message TEXT,
    last_success_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-project alert rules
CREATE TABLE alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('new_issue', 'regression', 'unmute')),
    is_enabled INTEGER NOT NULL DEFAULT 1,
    conditions TEXT NOT NULL DEFAULT '{}',
    cooldown_minutes INTEGER NOT NULL DEFAULT 0,
    last_triggered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
    channel_id INTEGER REFERENCES notification_channels(id) ON DELETE SET NULL,
    issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL,
    channel_type VARCHAR(50) NOT NULL,
    channel_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    error_message TEXT,
    http_status_code INTEGER,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT
);

CREATE INDEX idx_notification_channels_enabled ON notification_channels(is_enabled) WHERE is_enabled;
CREATE INDEX idx_alert_rules_project ON alert_rules(project_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(project_id, is_enabled) WHERE is_enabled;
CREATE INDEX idx_alert_history_pending ON alert_history(next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_alert_history_issue ON alert_history(issue_id);
CREATE INDEX idx_alert_history_project ON alert_history(project_id);
