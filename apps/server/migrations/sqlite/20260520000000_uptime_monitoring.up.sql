CREATE TABLE IF NOT EXISTS monitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    check_type TEXT NOT NULL CHECK (check_type IN ('http', 'tcp')),
    url TEXT NOT NULL,
    interval_secs INTEGER NOT NULL DEFAULT 60,
    timeout_secs INTEGER NOT NULL DEFAULT 10,
    expected_status INTEGER,
    fail_threshold INTEGER NOT NULL DEFAULT 2,
    recovery_threshold INTEGER NOT NULL DEFAULT 2,
    repeat_interval_secs INTEGER NOT NULL DEFAULT 3600,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS monitor_checks (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    checked_at TEXT NOT NULL DEFAULT (datetime('now')),
    status INTEGER NOT NULL CHECK (status IN (0, 1, 2)),
    latency_ms INTEGER,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_id ON monitor_checks(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_checks_checked_at ON monitor_checks(checked_at DESC);

CREATE TABLE IF NOT EXISTS monitor_states (
    monitor_id TEXT PRIMARY KEY REFERENCES monitors(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'up' CHECK (state IN ('up', 'pending_down', 'down', 'pending_up')),
    fail_counter INTEGER NOT NULL DEFAULT 0,
    recovery_counter INTEGER NOT NULL DEFAULT 0,
    last_check_at TEXT,
    next_check_at TEXT NOT NULL DEFAULT (datetime('now')),
    alerted_down_at TEXT,
    last_alerted_at TEXT,
    alert_count INTEGER NOT NULL DEFAULT 0,
    incident_id TEXT
);

CREATE TABLE IF NOT EXISTS monitor_incidents (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS monitor_alert_channels (
    monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    channel_id INTEGER NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    PRIMARY KEY (monitor_id, channel_id)
);
