CREATE TABLE chunk (
    checksum   CHAR(40) PRIMARY KEY,
    size       INT NOT NULL,
    data       BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE source_file (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checksum     CHAR(40) UNIQUE NOT NULL,
    size         INT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE source_file_metadata (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    debug_id   UUID NOT NULL,
    file_type  TEXT NOT NULL,
    file_id    UUID NOT NULL REFERENCES source_file(id) ON DELETE CASCADE,
    times_used INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, debug_id, file_type)
);
CREATE INDEX idx_sfm_lookup ON source_file_metadata(project_id, debug_id);

CREATE TABLE assembly_jobs (
    id              BIGSERIAL PRIMARY KEY,
    bundle_checksum CHAR(40) NOT NULL,
    project_id      INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chunks          TEXT[] NOT NULL,
    state           TEXT NOT NULL DEFAULT 'created' CHECK(state IN ('not_found','created','assembling','ok','error')),
    detail          TEXT,
    locked_until    TIMESTAMPTZ,
    worker_id       TEXT,
    retry_count     INT NOT NULL DEFAULT 0,
    max_retries     INT NOT NULL DEFAULT 3,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bundle_checksum, project_id)
);
CREATE INDEX idx_assembly_jobs_poll ON assembly_jobs(state, created_at);
