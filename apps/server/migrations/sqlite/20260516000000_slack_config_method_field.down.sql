-- Remove the backfilled `method` key from Slack channel configs.
-- Only removes the key if value is "webhook" to avoid touching bot_token configs.
UPDATE notification_channels
SET config = json_remove(config, '$.method')
WHERE channel_type = 'slack'
  AND json_extract(config, '$.method') = 'webhook';
