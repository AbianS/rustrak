DROP INDEX IF EXISTS idx_events_event_type;

ALTER TABLE events
    DROP COLUMN IF EXISTS spans,
    DROP COLUMN IF EXISTS start_timestamp,
    DROP COLUMN IF EXISTS event_type;

-- Note: re-adding NOT NULL would fail if any rows have NULLs in those columns.
-- Down migration only intended for fresh-test-db rollbacks.
ALTER TABLE events
    ALTER COLUMN issue_id    SET NOT NULL,
    ALTER COLUMN grouping_id SET NOT NULL;
