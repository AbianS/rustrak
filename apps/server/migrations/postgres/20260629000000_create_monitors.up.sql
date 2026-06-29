-- Sentry Crons: monitors + check-ins (issue #143).
-- A `monitor` is the scheduled job, upserted per (project_id, slug) from
-- check-in payloads. A `check_in` is one reported execution. Schedule config
-- (crontab/interval + margins + timezone) drives the missed-detection worker,
-- which computes `next_expected_at` and flips `status` to missed/timeout.

CREATE TABLE monitors (
    id                   UUID PRIMARY KEY,
    project_id           INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    slug                 VARCHAR(50) NOT NULL,

    -- Schedule config from `monitor_config` upsert. NULL until a config is seen.
    schedule_type        VARCHAR(16),   -- 'crontab' | 'interval'
    schedule_value       TEXT,          -- crontab string, or interval count as text
    schedule_unit        VARCHAR(8),    -- interval unit: year/month/week/day/hour/minute
    checkin_margin       INTEGER,       -- minutes after expected time before "missed"
    max_runtime          INTEGER,       -- minutes an in_progress run may last before "timeout"
    timezone             VARCHAR(64),
    owner                VARCHAR(255),

    -- Derived state, maintained by the processor and the missed worker.
    status               VARCHAR(16) NOT NULL DEFAULT 'active',
    last_check_in_at     TIMESTAMPTZ,
    last_check_in_status VARCHAR(16),
    next_expected_at     TIMESTAMPTZ,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(project_id, slug)
);

CREATE INDEX idx_monitors_project       ON monitors(project_id);
CREATE INDEX idx_monitors_next_expected ON monitors(next_expected_at);

CREATE TABLE check_ins (
    id           UUID PRIMARY KEY,
    monitor_id   UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- SDK-provided id. Shared between the in_progress and the closing check-in,
    -- so the closing status/duration upserts onto the open row. NULL when absent.
    check_in_id  UUID,

    status       VARCHAR(16) NOT NULL,
    duration     DOUBLE PRECISION,   -- seconds
    environment  VARCHAR(64),
    trace_id     VARCHAR(64),

    timestamp    TIMESTAMPTZ NOT NULL,
    ingested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_check_ins_monitor          ON check_ins(monitor_id, timestamp DESC);
CREATE INDEX idx_check_ins_project_ingested ON check_ins(project_id, ingested_at DESC);
CREATE INDEX idx_check_ins_lifecycle        ON check_ins(monitor_id, check_in_id);
