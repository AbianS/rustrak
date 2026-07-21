-- no-transaction
--
-- Backs the "new issues in this window" counter on the project overview
-- (StatsService::project_summary), which filters issues by project_id and a
-- first_seen range. The existing idx_issues_project_status and
-- idx_issues_project_last_seen both order by last_seen, so neither can serve a
-- first_seen range without scanning every issue in the project.
--
-- CONCURRENTLY (hence `-- no-transaction`, alone in its own file --
-- precedent: 20260719000001_add_events_issue_timestamp_index) lets digest
-- keep creating issues while the index builds on a large existing table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_issues_project_first_seen
    ON issues (project_id, first_seen DESC);
