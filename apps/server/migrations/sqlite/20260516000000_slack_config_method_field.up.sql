-- Backfill `method: "webhook"` on all existing Slack notification channels
-- that do not yet have the `method` key in their config JSON.
-- SQLite uses json_patch() to merge objects and json_extract() to check for the key.
UPDATE notification_channels
SET config = json_patch(config, '{"method":"webhook"}')
WHERE channel_type = 'slack'
  AND json_extract(config, '$.method') IS NULL;
