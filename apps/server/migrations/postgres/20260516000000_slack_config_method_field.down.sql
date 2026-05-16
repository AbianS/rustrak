-- Remove the backfilled `method` key from Slack channel configs.
-- Only removes the key if value is "webhook" to avoid touching bot_token configs.
UPDATE notification_channels
SET config = config - 'method'
WHERE channel_type = 'slack'
  AND config->>'method' = 'webhook';
