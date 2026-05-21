-- Migration: Alert Two-Tier Integrations
--
-- Problem: notification_channels collapses provider credentials AND per-project
-- routing into a single JSONB config column. To send Slack alerts to 3 channels
-- you must create 3 rows — each duplicating the same bot token.
--
-- Solution: Introduce alert_integrations (global credentials only) and add
-- routing_override JSONB to alert_rule_channels (per-rule routing). Migrate all
-- existing data non-destructively: IDs are preserved so existing FK references
-- in alert_history remain valid without touching those rows.
--
-- Transformation rules per provider type:
--   Slack webhook    → credentials = config (as-is), routing_override = '{}'
--   Slack bot_token  → credentials = config minus routing fields (channel, username, icon_emoji)
--                       routing_override = jsonb_strip_nulls({channel, username, icon_emoji})
--   Email            → credentials = config minus recipients
--                       routing_override = {recipients: config->'recipients'}
--   Webhook (generic)→ credentials = config (as-is), routing_override = '{}'
--
-- Order of operations matters: join to notification_channels for routing backfill
-- BEFORE dropping that table.

-- =============================================================================
-- Step 1: Create alert_integrations table
-- =============================================================================

CREATE TABLE alert_integrations (
    id                   SERIAL PRIMARY KEY,
    name                 TEXT NOT NULL UNIQUE,
    provider_type        TEXT NOT NULL CHECK (provider_type IN ('slack', 'email', 'webhook')),
    -- Credentials only — no routing fields (channel, recipients, url overrides)
    credentials          JSONB NOT NULL,
    is_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    -- Provider health tracking
    failure_count        INTEGER NOT NULL DEFAULT 0,
    last_failure_at      TIMESTAMPTZ,
    last_failure_message TEXT,
    last_success_at      TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_integrations_enabled ON alert_integrations (is_enabled) WHERE is_enabled;

-- =============================================================================
-- Step 2: Migrate data from notification_channels → alert_integrations
--
-- Extract credentials by stripping out routing fields per provider type:
--
--   Slack webhook    → config unchanged (webhook_url is a credential, not routing)
--   Slack bot_token  → config - 'channel' - 'username' - 'icon_emoji'
--   Email            → config - 'recipients'
--   Webhook          → config unchanged (url/secret/headers are credentials)
--
-- IDs are preserved (INSERT uses the original id) so all FK references in
-- alert_rule_channels and alert_history remain valid after the migration.
-- =============================================================================

INSERT INTO alert_integrations (
    id, name, provider_type, credentials,
    is_enabled, failure_count, last_failure_at, last_failure_message, last_success_at,
    created_at, updated_at
)
SELECT
    nc.id,
    nc.name,
    nc.channel_type AS provider_type,
    -- Strip routing fields from config to produce credentials-only JSONB.
    -- Slack webhook:   all config fields are credentials (webhook_url is the secret)
    -- Slack bot_token: remove channel/username/icon_emoji — those become routing_override
    -- Email:           remove recipients — those become routing_override
    -- Webhook:         all config fields are credentials (url, secret, headers)
    CASE
        WHEN nc.channel_type = 'slack'
             AND (nc.config->>'method') = 'bot_token'
        THEN
            nc.config - 'channel' - 'username' - 'icon_emoji'

        WHEN nc.channel_type = 'email'
        THEN
            nc.config - 'recipients'

        -- slack/webhook method and generic webhook: no routing fields to strip
        ELSE
            nc.config
    END AS credentials,
    nc.is_enabled,
    nc.failure_count,
    nc.last_failure_at,
    nc.last_failure_message,
    nc.last_success_at,
    nc.created_at,
    nc.updated_at
FROM notification_channels nc;

-- Advance the sequence past the highest migrated id so future INSERTs don't collide
SELECT setval(
    pg_get_serial_sequence('alert_integrations', 'id'),
    COALESCE((SELECT MAX(id) FROM alert_integrations), 1),
    true
);

-- =============================================================================
-- Step 3: Alter alert_rule_channels
--
-- 3a. Add integration_id (nullable first for backfill)
-- 3b. Backfill integration_id from the migrated alert_integrations (same IDs)
-- 3c. Set NOT NULL + add FK
-- 3d. Add routing_override column
-- 3e. Backfill routing_override by joining to notification_channels BEFORE drop
-- 3f. Drop old FK on channel_id, then drop channel_id column
-- =============================================================================

-- 3a: Add integration_id column (nullable for now)
ALTER TABLE alert_rule_channels
    ADD COLUMN integration_id INTEGER;

-- 3b: Backfill integration_id — IDs are identical after migration so a direct
--     assignment from channel_id is sufficient. The JOIN confirms the row exists
--     in alert_integrations to be safe.
UPDATE alert_rule_channels arc
SET integration_id = ai.id
FROM alert_integrations ai
WHERE arc.channel_id = ai.id;

-- 3c: Enforce NOT NULL and add FK constraint
ALTER TABLE alert_rule_channels
    ALTER COLUMN integration_id SET NOT NULL;

ALTER TABLE alert_rule_channels
    ADD CONSTRAINT fk_arc_integration
        FOREIGN KEY (integration_id)
        REFERENCES alert_integrations (id) ON DELETE CASCADE;

-- 3d: Add routing_override column
ALTER TABLE alert_rule_channels
    ADD COLUMN routing_override JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3e: Backfill routing_override by extracting routing fields from notification_channels.
--     This JOIN must happen BEFORE we drop notification_channels.
--
--     Slack webhook:   routing_override = '{}'  (channel is encoded in the webhook URL)
--     Slack bot_token: routing_override = jsonb_strip_nulls({channel, username, icon_emoji})
--     Email:           routing_override = {recipients: [...]}
--     Webhook:         routing_override = '{}'  (url/headers are credentials, not routing)
UPDATE alert_rule_channels arc
SET routing_override = CASE
        WHEN nc.channel_type = 'slack'
             AND (nc.config->>'method') = 'bot_token'
        THEN
            -- Strip keys with null values so the object stays clean
            jsonb_strip_nulls(jsonb_build_object(
                'channel',    nc.config->>'channel',
                'username',   nc.config->>'username',
                'icon_emoji', nc.config->>'icon_emoji'
            ))

        WHEN nc.channel_type = 'email'
        THEN
            jsonb_build_object('recipients', nc.config->'recipients')

        -- slack/webhook and generic webhook → no per-rule routing
        ELSE
            '{}'::jsonb
    END
FROM notification_channels nc
WHERE arc.channel_id = nc.id;

-- 3f: Drop old FK on channel_id, then drop the column
ALTER TABLE alert_rule_channels
    DROP CONSTRAINT alert_rule_channels_channel_id_fkey;

ALTER TABLE alert_rule_channels
    DROP COLUMN channel_id;

-- =============================================================================
-- Step 4: Alter alert_history
--
-- Rename channel_id → integration_id keeping the same semantics.
-- IDs are identical (step 2 preserved them) so no data loss and FK validity
-- is maintained for all existing history rows.
-- =============================================================================

-- 4a: Add integration_id (nullable — same as channel_id was)
ALTER TABLE alert_history
    ADD COLUMN integration_id INTEGER;

-- 4b: Backfill from the migrated alert_integrations (same IDs)
UPDATE alert_history ah
SET integration_id = ai.id
FROM alert_integrations ai
WHERE ah.channel_id = ai.id;

-- 4c: Add FK (ON DELETE SET NULL matches original channel_id FK behaviour)
ALTER TABLE alert_history
    ADD CONSTRAINT fk_ah_integration
        FOREIGN KEY (integration_id)
        REFERENCES alert_integrations (id) ON DELETE SET NULL;

-- 4d: Drop old FK on channel_id, then drop the column
ALTER TABLE alert_history
    DROP CONSTRAINT alert_history_channel_id_fkey;

ALTER TABLE alert_history
    DROP COLUMN channel_id;

-- =============================================================================
-- Step 5: Drop notification_channels
--
-- Safe to drop now: all FKs pointing to it have been migrated/removed.
-- The index created in the original migration is dropped automatically with
-- the table.
-- =============================================================================

DROP TABLE notification_channels;
