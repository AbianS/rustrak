-- Backfill `method: "webhook"` on all existing Slack notification channels
-- that do not yet have the `method` key in their config JSON.
-- This is safe to run multiple times (the WHERE clause is idempotent).
UPDATE notification_channels
SET config = config || '{"method":"webhook"}'::jsonb
WHERE channel_type = 'slack'
  AND NOT (config ? 'method');
