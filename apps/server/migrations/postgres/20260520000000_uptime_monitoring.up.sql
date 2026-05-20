CREATE TABLE IF NOT EXISTS monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    check_type TEXT NOT NULL CHECK (check_type IN ('http', 'tcp')),
    url TEXT NOT NULL,
    interval_secs INTEGER NOT NULL DEFAULT 60,
    timeout_secs INTEGER NOT NULL DEFAULT 10,
    expected_status INTEGER,
    fail_threshold INTEGER NOT NULL DEFAULT 2,
    recovery_threshold INTEGER NOT NULL DEFAULT 2,
    repeat_interval_secs INTEGER NOT NULL DEFAULT 3600,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitor_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status INTEGER NOT NULL CHECK (status IN (0, 1, 2)),
    latency_ms INTEGER,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_id ON monitor_checks(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_checks_checked_at ON monitor_checks(checked_at DESC);

CREATE TABLE IF NOT EXISTS monitor_states (
    monitor_id UUID PRIMARY KEY REFERENCES monitors(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'up' CHECK (state IN ('up', 'pending_down', 'down', 'pending_up')),
    fail_counter INTEGER NOT NULL DEFAULT 0,
    recovery_counter INTEGER NOT NULL DEFAULT 0,
    last_check_at TIMESTAMPTZ,
    next_check_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    alerted_down_at TIMESTAMPTZ,
    last_alerted_at TIMESTAMPTZ,
    alert_count INTEGER NOT NULL DEFAULT 0,
    incident_id UUID
);

CREATE TABLE IF NOT EXISTS monitor_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS monitor_alert_channels (
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    channel_id INTEGER NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    PRIMARY KEY (monitor_id, channel_id)
);
