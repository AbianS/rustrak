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
-- SCL-1 fixes applied:
--   K1: Credentials extraction per provider type (Slack strips routing fields, Email strips recipients)
--   K2: routing_override backfill BEFORE dropping notification_channels
--   Fix: RENAME COLUMN channel_id → integration_id (NOT add+drop which fails on PK columns)
--   Fix: DROP PK constraint before renaming column in junction table
--   Fix: IF EXISTS on FK DROP constraints for idempotency
--
-- Transformation rules per provider type:
--   Slack webhook    → credentials = config (as-is), routing_override = '{}'
--   Slack bot_token  → credentials = config minus routing fields (channel, username, icon_emoji)
--                       routing_override = jsonb_strip_nulls({channel, username, icon_emoji})
--   Email            → credentials = config minus recipients
--                       routing_override = {recipients: config->'recipients'}
--   Webhook (generic)→ credentials = config (as-is), routing_override = '{}'
--
-- Order of operations matters: backfill routing_override BEFORE dropping notification_channels.

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
-- Extract credentials by stripping out routing fields per provider type (K1).
-- IDs are preserved so all FK references in alert_rule_channels and alert_history
-- remain valid after the migration.
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
    -- Strip routing fields from config to produce credentials-only JSONB (K1).
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
-- ORDER MATTERS (SCL-1):
-- 3a. ADD routing_override column
-- 3b. Backfill routing_override by joining to notification_channels BEFORE drop (K2)
-- 3c. DROP FK constraint on channel_id IF EXISTS
-- 3d. RENAME COLUMN channel_id → integration_id (NOT add+drop — avoids PK column drop error)
-- 3e. DROP PK constraint, then ADD new PK on (alert_rule_id, integration_id)
-- 3f. ADD new FK constraint integration_id → alert_integrations(id)
-- =============================================================================

-- 3a: Add routing_override column
ALTER TABLE alert_rule_channels
    ADD COLUMN routing_override JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3b: Backfill routing_override by extracting routing fields from notification_channels (K2).
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

-- 3c: Drop old FK constraint on channel_id IF EXISTS (idempotent)
ALTER TABLE alert_rule_channels
    DROP CONSTRAINT IF EXISTS alert_rule_channels_channel_id_fkey;

-- 3d: RENAME COLUMN channel_id → integration_id
--     Using RENAME avoids "cannot drop column that is part of the primary key" error (SCL-1).
ALTER TABLE alert_rule_channels
    RENAME COLUMN channel_id TO integration_id;

-- 3e: Drop old PK, add new PK on (alert_rule_id, integration_id)
ALTER TABLE alert_rule_channels
    DROP CONSTRAINT alert_rule_channels_pkey;

ALTER TABLE alert_rule_channels
    ADD PRIMARY KEY (alert_rule_id, integration_id);

-- 3f: Add new FK constraint
ALTER TABLE alert_rule_channels
    ADD CONSTRAINT alert_rule_channels_integration_id_fkey
        FOREIGN KEY (integration_id)
        REFERENCES alert_integrations (id) ON DELETE CASCADE;

-- =============================================================================
-- Step 4: Alter alert_history
--
-- Same RENAME COLUMN approach: drop FK IF EXISTS, then RENAME, then add new FK.
-- IDs are identical (step 2 preserved them) so FK validity is maintained.
-- =============================================================================

-- 4a: Drop old FK constraint IF EXISTS
ALTER TABLE alert_history
    DROP CONSTRAINT IF EXISTS alert_history_channel_id_fkey;

-- 4b: RENAME COLUMN channel_id → integration_id
ALTER TABLE alert_history
    RENAME COLUMN channel_id TO integration_id;

-- 4c: Add new FK (ON DELETE SET NULL matches original behaviour)
ALTER TABLE alert_history
    ADD CONSTRAINT alert_history_integration_id_fkey
        FOREIGN KEY (integration_id)
        REFERENCES alert_integrations (id) ON DELETE SET NULL;

-- =============================================================================
-- Step 5: Drop notification_channels
--
-- Safe to drop now: all FKs pointing to it have been migrated/removed.
-- The indexes created in the original migration are dropped automatically.
-- =============================================================================

DROP TABLE notification_channels;
