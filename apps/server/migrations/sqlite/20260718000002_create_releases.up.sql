-- Sentry-compatible releases table (GH #191) — SQLite dialect.
-- Datetimes stored as TEXT (ISO-8601), mirroring the rest of this schema.
CREATE TABLE releases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version VARCHAR(200) NOT NULL,
    ref TEXT,
    url TEXT,
    date_created TEXT NOT NULL,
    date_released TEXT,

    UNIQUE(project_id, version)
);

CREATE INDEX idx_releases_project_date_created ON releases(project_id, date_created DESC);
