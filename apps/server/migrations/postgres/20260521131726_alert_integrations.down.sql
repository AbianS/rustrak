-- Reverse migration: Alert Two-Tier Integrations
--
-- Restores notification_channels, reverts alert_rule_channels.integration_id →
-- channel_id, reverts alert_history.integration_id → channel_id, and drops
-- alert_integrations.
--
-- Note: The restored notification_channels.config will contain credentials only
-- (routing fields that were separated into routing_override cannot be fully
-- restored without the original combined config). This down migration is
-- primarily for development rollback, not production use.

-- =============================================================================
-- Step 1: Recreate notification_channels table
-- =============================================================================

CREATE TABLE notification_channels (
    id                   SERIAL PRIMARY KEY,
    name                 VARCHAR(255) NOT NULL UNIQUE,
    channel_type         VARCHAR(50) NOT NULL CHECK (channel_type IN ('webhook', 'email', 'slack')),
    config               JSONB NOT NULL DEFAULT '{}',
    is_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    failure_count        INTEGER NOT NULL DEFAULT 0,
    last_failure_at      TIMESTAMPTZ,
    last_failure_message TEXT,
    last_success_at      TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_channels_enabled ON notification_channels (is_enabled) WHERE is_enabled;

-- =============================================================================
-- Step 2: Restore data from alert_integrations → notification_channels
-- =============================================================================

INSERT INTO notification_channels (
    id, name, channel_type, config,
    is_enabled, failure_count, last_failure_at, last_failure_message, last_success_at,
    created_at, updated_at
)
SELECT
    ai.id,
    ai.name,
    ai.provider_type AS channel_type,
    ai.credentials AS config,
    ai.is_enabled,
    ai.failure_count,
    ai.last_failure_at,
    ai.last_failure_message,
    ai.last_success_at,
    ai.created_at,
    ai.updated_at
FROM alert_integrations ai;

-- Advance the sequence past the highest restored id
SELECT setval(
    pg_get_serial_sequence('notification_channels', 'id'),
    COALESCE((SELECT MAX(id) FROM notification_channels), 1),
    true
);

-- =============================================================================
-- Step 3: Revert alert_history
-- =============================================================================

-- 3a: Drop new FK constraint
ALTER TABLE alert_history
    DROP CONSTRAINT IF EXISTS alert_history_integration_id_fkey;

-- 3b: RENAME COLUMN integration_id → channel_id
ALTER TABLE alert_history
    RENAME COLUMN integration_id TO channel_id;

-- 3c: Restore old FK
ALTER TABLE alert_history
    ADD CONSTRAINT alert_history_channel_id_fkey
        FOREIGN KEY (channel_id)
        REFERENCES notification_channels (id) ON DELETE SET NULL;

-- =============================================================================
-- Step 4: Revert alert_rule_channels
-- =============================================================================

-- 4a: Drop new FK and PK constraints
ALTER TABLE alert_rule_channels
    DROP CONSTRAINT IF EXISTS alert_rule_channels_integration_id_fkey;

ALTER TABLE alert_rule_channels
    DROP CONSTRAINT alert_rule_channels_pkey;

-- 4b: RENAME COLUMN integration_id → channel_id
ALTER TABLE alert_rule_channels
    RENAME COLUMN integration_id TO channel_id;

-- 4c: Restore old PK
ALTER TABLE alert_rule_channels
    ADD PRIMARY KEY (alert_rule_id, channel_id);

-- 4d: Restore old FK
ALTER TABLE alert_rule_channels
    ADD CONSTRAINT alert_rule_channels_channel_id_fkey
        FOREIGN KEY (channel_id)
        REFERENCES notification_channels (id) ON DELETE CASCADE;

-- 4e: Drop routing_override column
ALTER TABLE alert_rule_channels
    DROP COLUMN routing_override;

-- =============================================================================
-- Step 5: Drop alert_integrations
-- =============================================================================

DROP TABLE alert_integrations;
