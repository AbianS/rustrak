-- Mirrors the Postgres migration of the same name. SQLite has no
-- CONCURRENTLY (and serializes writes anyway), so this is a plain index.
CREATE INDEX IF NOT EXISTS idx_issues_project_first_seen
    ON issues (project_id, first_seen DESC);
