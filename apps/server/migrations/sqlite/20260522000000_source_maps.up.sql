CREATE TABLE chunk (
    checksum   TEXT PRIMARY KEY,
    size       INTEGER NOT NULL,
    data       BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE source_file (
    id           TEXT PRIMARY KEY,
    checksum     TEXT UNIQUE NOT NULL,
    size         INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE source_file_metadata (
    id         TEXT PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    debug_id   TEXT NOT NULL,
    file_type  TEXT NOT NULL,
    file_id    TEXT NOT NULL REFERENCES source_file(id) ON DELETE CASCADE,
    times_used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, debug_id, file_type)
);
CREATE INDEX idx_sfm_lookup ON source_file_metadata(project_id, debug_id);

CREATE TABLE assembly_jobs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    bundle_checksum TEXT NOT NULL,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chunks          TEXT NOT NULL DEFAULT '[]',
    state           TEXT NOT NULL DEFAULT 'created' CHECK(state IN ('not_found','created','assembling','ok','error')),
    detail          TEXT,
    locked_until    TEXT,
    worker_id       TEXT,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    max_retries     INTEGER NOT NULL DEFAULT 3,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(bundle_checksum, project_id)
);
CREATE INDEX idx_assembly_jobs_poll ON assembly_jobs(state, created_at);
