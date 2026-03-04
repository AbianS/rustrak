-- Auth tokens table (global, not per-project)
CREATE TABLE auth_tokens (
    id SERIAL PRIMARY KEY,
    token CHAR(40) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- Index for fast token lookups
CREATE INDEX idx_auth_tokens_token ON auth_tokens(token);
