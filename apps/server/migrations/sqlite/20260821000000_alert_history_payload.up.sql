ALTER TABLE alert_history ADD COLUMN payload TEXT NOT NULL DEFAULT '{}';

-- Rows created before payload persistence cannot be reconstructed; make them
-- terminal failures instead of leaving the retry worker stuck on `{}` forever.
UPDATE alert_history
SET status = 'failed',
    error_message = 'legacy alert payload unavailable after migration',
    next_retry_at = NULL
WHERE status = 'pending';
