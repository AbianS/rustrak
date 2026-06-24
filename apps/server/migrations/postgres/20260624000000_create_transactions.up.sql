-- Dedicated transactions table (issue #142, Fase 1).
-- Transactions are no longer overloaded onto `events`: they get a purpose-built
-- table with denormalized, queryable columns mirroring Relay's TransactionProcessor.
CREATE TABLE transactions (
    id               UUID PRIMARY KEY,
    event_id         UUID NOT NULL,
    project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Normalized trace context (contexts.trace.*) + transaction_info.source.
    trace_id         VARCHAR(64),
    transaction_name VARCHAR(200) NOT NULL DEFAULT '',
    op               VARCHAR(64),
    status           VARCHAR(32),
    source           VARCHAR(32) NOT NULL DEFAULT 'unknown',
    span_id          VARCHAR(32),
    parent_span_id   VARCHAR(32),

    start_timestamp  TIMESTAMPTZ,
    timestamp        TIMESTAMPTZ NOT NULL,
    duration_ms      DOUBLE PRECISION,

    platform         VARCHAR(64)  NOT NULL DEFAULT '',
    environment      VARCHAR(64)  NOT NULL DEFAULT '',
    release          VARCHAR(250) NOT NULL DEFAULT '',
    server_name      VARCHAR(255) NOT NULL DEFAULT '',
    sdk_name         VARCHAR(255) NOT NULL DEFAULT '',
    sdk_version      VARCHAR(255) NOT NULL DEFAULT '',
    level            VARCHAR(20)  NOT NULL DEFAULT 'info',

    measurements     JSONB,
    tags             JSONB,
    contexts         JSONB,
    request          JSONB,
    "user"           JSONB,
    data             JSONB NOT NULL,
    remote_addr      TEXT,
    ingested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(project_id, event_id)
);

CREATE INDEX idx_transactions_project_ingested ON transactions(project_id, ingested_at DESC);
CREATE INDEX idx_transactions_project_name     ON transactions(project_id, transaction_name);
CREATE INDEX idx_transactions_project_op          ON transactions(project_id, op);
CREATE INDEX idx_transactions_project_status      ON transactions(project_id, status);
CREATE INDEX idx_transactions_project_environment ON transactions(project_id, environment);
CREATE INDEX idx_transactions_project_release     ON transactions(project_id, release);
CREATE INDEX idx_transactions_trace               ON transactions(trace_id);
