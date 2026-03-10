# Data Models — Server

> Generated: 2026-03-10 | Scan level: deep | Part: server

## Overview

Rustrak supports two database backends, selectable at compile time via Cargo features:

| Feature flag | Backend | Docker tag | Use case |
|---|---|---|---|
| `sqlite` (default) | SQLite | `latest`, `vX.Y.Z` | Personal projects, low traffic, zero-ops |
| `postgres` | PostgreSQL 16 | `postgres`, `vX.Y.Z-postgres` | Production, teams, high throughput |

Migrations live in:
- `apps/server/migrations/sqlite/` — SQLite-specific
- `apps/server/migrations/postgres/` — PostgreSQL-specific

---

## Schema Diagram

```
installation (singleton)
      │
      │ (rate limiting)
      ▼
  projects ──────────────────────────────────────────────────────┐
      │                                                          │
      ├──► issues ──────────────────────────────────────────┐   │
      │       │                                             │   │
      │       └──► groupings ──────────────────────────┐   │   │
      │       │                                        │   │   │
      │       └──► events ◄────────────────────────────┘   │   │
      │                                                     │   │
      ├──► alert_rules ◄────────────────────────────────────┘   │
      │       │                                                  │
      │       └──► alert_rule_channels ──► notification_channels│
      │       │                                                  │
      │       └──► alert_history                                 │
      │                                                          │
      └──► auth_tokens                                           │
                                                                 │
  users ───────────────────────────────────────────────────────►│
                                                                 │
```

---

## Tables

### `installation`
Singleton row (id=1) for global rate limiting state.

```sql
CREATE TABLE installation (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    digested_event_count BIGINT NOT NULL DEFAULT 0,
    quota_exceeded_until TIMESTAMPTZ,
    quota_exceeded_reason TEXT,
    next_quota_check BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Always 1 (enforced by CHECK) |
| `digested_event_count` | bigint | Total events processed |
| `quota_exceeded_until` | timestamptz | When global rate limit expires |
| `quota_exceeded_reason` | text | `minute` or `hour` |
| `next_quota_check` | bigint | Optimization: skip COUNT queries until this count |

---

### `users`
Human users accessing the web dashboard.

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,   -- Argon2id
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);
CREATE INDEX idx_users_email ON users(email);
```

---

### `projects`
Sentry-compatible projects. Each project has a unique `sentry_key` (UUID) used as the DSN key.

```sql
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    sentry_key UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    stored_event_count INTEGER NOT NULL DEFAULT 0,
    digested_event_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Rate limiting
    quota_exceeded_until TIMESTAMPTZ,
    quota_exceeded_reason TEXT,
    next_quota_check BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_projects_sentry_key ON projects(sentry_key);
CREATE INDEX idx_projects_slug ON projects(slug);
```

**DSN format:** `http://<sentry_key>@<host>/<project_id>`

---

### `auth_tokens`
Bearer tokens for API/programmatic access.

```sql
CREATE TABLE auth_tokens (
    id SERIAL PRIMARY KEY,
    token CHAR(40) NOT NULL UNIQUE,   -- 40-char hex string
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);
CREATE INDEX idx_auth_tokens_token ON auth_tokens(token);
```

---

### `issues`
Grouped error occurrences. Each issue collects many related events.

```sql
CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    digest_order INTEGER NOT NULL,
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    digested_event_count INTEGER NOT NULL DEFAULT 0,
    stored_event_count INTEGER NOT NULL DEFAULT 0,
    calculated_type VARCHAR(128) DEFAULT '',    -- e.g. "TypeError"
    calculated_value TEXT DEFAULT '',           -- e.g. "Cannot read property..."
    transaction VARCHAR(200) DEFAULT '',
    level VARCHAR(20),
    platform VARCHAR(50),
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    is_muted BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(project_id, digest_order)
);
CREATE INDEX idx_issues_project_last_seen ON issues(project_id, last_seen DESC)
    WHERE NOT is_deleted;
```

---

### `groupings`
Deterministic grouping keys that map events to issues. Each unique grouping key points to one issue.

```sql
CREATE TABLE groupings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    grouping_key TEXT NOT NULL,              -- human-readable key
    grouping_key_hash CHAR(64) NOT NULL,     -- SHA256 for indexed lookup
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, grouping_key_hash)
);
```

**Grouping key algorithm:**
1. Custom `fingerprint` field from SDK (highest priority)
2. `{ExceptionType}: {first_line_of_message} ⋄ {transaction}`
3. `Log Message: {message} ⋄ {transaction}`
4. `<unknown> ⋄ {transaction}` (fallback)

---

### `events`
Individual error events. Stores full Sentry payload as JSONB.

```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
    grouping_id INTEGER REFERENCES groupings(id) ON DELETE SET NULL,
    data JSONB NOT NULL,                        -- full Sentry event
    timestamp TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    digested_at TIMESTAMPTZ,
    digest_order INTEGER NOT NULL DEFAULT 1,
    calculated_type VARCHAR(128),
    calculated_value TEXT,
    transaction VARCHAR(200),
    level VARCHAR(20),
    platform VARCHAR(50),
    release VARCHAR(255),
    environment VARCHAR(100),
    UNIQUE(project_id, event_id)
);
CREATE INDEX idx_events_issue_digest_order ON events(issue_id, digest_order DESC)
    WHERE issue_id IS NOT NULL;
```

---

### `notification_channels`
Global notification destinations (Slack workspaces, webhooks, email).

```sql
CREATE TABLE notification_channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    channel_type VARCHAR(50) NOT NULL CHECK (channel_type IN ('webhook', 'email', 'slack')),
    config JSONB NOT NULL DEFAULT '{}',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    last_failure_message TEXT,
    last_success_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Config shapes per type:**

```json
// webhook
{ "url": "https://...", "secret": "optional", "headers": {} }

// slack
{ "webhook_url": "https://hooks.slack.com/...", "channel": "#errors" }

// email
{ "recipients": ["ops@example.com"], "smtp_host": "...", "smtp_port": 587 }
```

---

### `alert_rules`
Per-project alert trigger configurations.

```sql
CREATE TABLE alert_rules (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('new_issue', 'regression', 'unmute')),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    conditions JSONB NOT NULL DEFAULT '{}',
    cooldown_minutes INTEGER NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, alert_type)
);
```

---

### `alert_rule_channels`
Junction table linking alert rules to notification channels.

```sql
CREATE TABLE alert_rule_channels (
    alert_rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    channel_id INTEGER NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    PRIMARY KEY (alert_rule_id, channel_id)
);
```

---

### `alert_history`
Audit log and retry queue for alert deliveries.

```sql
CREATE TABLE alert_history (
    id BIGSERIAL PRIMARY KEY,
    alert_rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
    channel_id INTEGER REFERENCES notification_channels(id) ON DELETE SET NULL,
    issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL,
    channel_type VARCHAR(50) NOT NULL,
    channel_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    http_status_code INTEGER,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);
```

---

## Migration History

| Migration | Description |
|-----------|-------------|
| `20260119000000` | Initial schema (installation, projects) |
| `20260119000001` | Add UNIQUE constraint to projects.name |
| `20260119000002` | Create auth_tokens table |
| `20260119000003` | Create issues table |
| `20260119000004` | Create groupings table |
| `20260119000005` | Create events table |
| `20260119000006` | Add rate limiting columns to installation + projects |
| `20260119000007` | Remove soft delete (is_deleted migration) |
| `20260120000000` | Create users table (session auth) |
| `20260121000000` | Create alerting tables (channels, rules, history) |
| `20260122000000` | Change remote_addr from INET to TEXT (multi-DB compat) |

---

## Concurrency Control

PostgreSQL advisory locks prevent duplicate `digest_order` during concurrent event ingestion:

```rust
// Acquire transaction-scoped advisory lock per project
sqlx::query("SELECT pg_advisory_xact_lock($1)")
    .bind(project_id as i64)
    .execute(&mut *tx)
    .await?;
// Safe to read MAX(digest_order) and insert new issue
// Lock auto-releases on commit/rollback
```
