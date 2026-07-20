-- Mirrors the Postgres migration of the same name. SQLite has no
-- CONCURRENTLY (and serializes writes anyway), so this is a plain index.
CREATE INDEX IF NOT EXISTS idx_events_issue_timestamp
    ON events (issue_id, timestamp DESC, id DESC);
