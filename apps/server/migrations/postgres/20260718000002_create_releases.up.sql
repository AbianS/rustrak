-- Sentry-compatible releases table (GH #191): one row per (project, version).
-- Backs `POST/PUT .../releases/...` (sentry-cli, JS bundler plugins) and
-- date-based regression clearing (see IssueService::finalize_release), which
-- replaces the previous string-inequality comparison against issues.last_release.
CREATE TABLE releases (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version VARCHAR(200) NOT NULL,
    ref TEXT,
    url TEXT,
    date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_released TIMESTAMPTZ,

    UNIQUE(project_id, version)
);

CREATE INDEX idx_releases_project_date_created ON releases(project_id, date_created DESC);
