# Rustrak Server - Technical Context

> **Context Note**: This is the **server-specific context** for Rustrak.
> - Root context: `/CLAUDE.md`
> - Frontend context: `apps/webview-ui/CLAUDE.md`

## Overview

This is the Rust API server for Rustrak, an error tracking system compatible with Sentry SDKs. This document contains all technical details needed to implement and maintain the server.

## Implementation Status

**Completed:**
- Phase 1: Project setup, auth, projects API, tokens API
- Phase 2: Event ingestion (envelope parsing, decompression, temp storage)
- Phase 3: Event digest (grouping algorithm, issue creation, async processing)
- Phase 4: Issues/Events API with cursor-based pagination
- Phase 5.1: Rate limiting (global + per-project, minute + hour windows)
- Phase 6: User authentication (session-based for web UI, Argon2id password hashing)

**Pending (see `/docs/FUTURE_FEATURES.md`):**
- Data retention/cleanup
- Session tracking (SDK sessions)
- Performance monitoring (transactions)
- Tags extraction
- Releases and regression detection
- Email verification
- Password reset flow
- Multi-factor authentication

## Sentry Protocol

### Envelope Format

Sentry SDKs send events using the "envelope" format - a newline-delimited structure:

```
{envelope_headers}\n
{item_headers}\n
{item_payload}\n
{item_headers}\n
{item_payload}\n
...
```

**Envelope Headers** (first line, JSON):
```json
{
  "event_id": "9ec79c33ec9942ab8353589fcb2e04dc",
  "sent_at": "2026-01-09T12:00:00.000Z",
  "dsn": "http://sentry_key@host/project_id",
  "sdk": { "name": "sentry.python", "version": "1.0.0" }
}
```

**Item Headers** (JSON, one per item):
```json
{
  "type": "event",
  "length": 1234,
  "content_type": "application/json"
}
```

**Item Types**:
- `event` - Error/exception event (primary)
- `session` - Session tracking (ignore for MVP)
- `transaction` - Performance monitoring (ignore for MVP)
- `attachment` - File attachments (ignore for MVP)

**Length Field**:
- If `length` is present: read exactly that many bytes
- If `length` is absent: read until newline

### Authentication

Rustrak implements **three authentication methods** for different use cases:

#### 1. Session Authentication (Web UI)

For human users accessing the web dashboard:

**Technology:**
- actix-session middleware with CookieSessionStore
- httpOnly cookies (JavaScript can't access)
- SameSite=Lax (CSRF protection)
- Secure flag in production (HTTPS only)

**Database:**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);
```

**Password Hashing:**
- Argon2id algorithm (OWASP recommended)
- Salt generated with `OsRng`
- Resistant to GPU cracking attacks

**Endpoints:**
- `POST /auth/register` - Create user account
- `POST /auth/login` - Authenticate and create session
- `POST /auth/logout` - Destroy session
- `GET /auth/me` - Get current user (requires session)

**Middleware:**
- `RequireAuth` middleware protects routes
- Exempts: `/auth/*`, `/api/sentry/*`, `/health`
- Validates session on each request

**Bootstrap:**
```bash
# First-time setup: Create initial admin user
CREATE_SUPERUSER="admin@example.com:password123" cargo run

# Only creates user if database is empty
```

#### 2. Token Authentication (API/Management)

For programmatic API access and token management:

**Method:**
- `Authorization: Bearer <40-char-hex-token>`
- Validated against `auth_tokens` table
- Tokens created via web UI at `/settings/tokens`

**Usage:**
- API management endpoints (projects, issues, events)
- NOT used for SDK ingestion (use SentryAuth)

#### 3. SDK Authentication (Ingest Endpoints)

For Sentry SDKs sending events:

**Method:**
SDKs authenticate using the project's `sentry_key` (UUID) via:

1. **Query Parameter**: `?sentry_key=<uuid>`
2. **X-Sentry-Auth Header**:
   ```
   X-Sentry-Auth: Sentry sentry_key=<uuid>, sentry_version=7, ...
   ```

**Validation:**
```sql
SELECT * FROM projects WHERE id = $project_id AND sentry_key = $sentry_key
```

**Usage:**
- Only for event ingestion endpoints
- `/api/{project_id}/envelope/`
- `/api/{project_id}/store/` (legacy)

### Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| **Authentication** |
| `POST /auth/register` | POST | None | Create user account |
| `POST /auth/login` | POST | None | Login and create session |
| `POST /auth/logout` | POST | Session | Destroy session |
| `GET /auth/me` | GET | Session | Get current user |
| **SDK Ingestion** |
| `POST /api/{project_id}/envelope/` | POST | SentryAuth | Primary ingest |
| `POST /api/{project_id}/store/` | POST | SentryAuth | Legacy (deprecated) |
| **Projects** |
| `GET /api/projects` | GET | Bearer/Session | List projects |
| `POST /api/projects` | POST | Bearer/Session | Create project |
| `GET /api/projects/{id}` | GET | Bearer/Session | Get project |
| `PATCH /api/projects/{id}` | PATCH | Bearer/Session | Update project |
| `DELETE /api/projects/{id}` | DELETE | Bearer/Session | Delete project |
| **Issues** |
| `GET /api/projects/{id}/issues` | GET | Bearer/Session | List issues (paginated) |
| `GET /api/projects/{id}/issues/{issue_id}` | GET | Bearer/Session | Get issue |
| `PATCH /api/projects/{id}/issues/{issue_id}` | PATCH | Bearer/Session | Update issue state |
| `DELETE /api/projects/{id}/issues/{issue_id}` | DELETE | Bearer/Session | Delete issue |
| **Events** |
| `GET /api/projects/{id}/issues/{issue_id}/events` | GET | Bearer/Session | List events (paginated) |
| `GET /api/projects/{id}/issues/{issue_id}/events/{event_id}` | GET | Bearer/Session | Get event detail |
| **Health** |
| `GET /health` | GET | None | Liveness check |
| `GET /health/ready` | GET | None | Readiness check |

### Issue Management

Issues support state management via PATCH endpoint:

**PATCH /api/projects/{id}/issues/{issue_id}**
```json
{
  "is_resolved": true,   // Mark as resolved (optional)
  "is_muted": true       // Mark as muted (optional)
}
```

**Actions:**
- **Resolve**: Sets `is_resolved = true`, issue hidden from default list
- **Unresolve**: Sets `is_resolved = false`, issue visible again
- **Mute**: Sets `is_muted = true`, issue hidden from default list
- **Unmute**: Sets `is_muted = false`, issue visible again
- **Delete**: Soft delete via DELETE endpoint (`is_deleted = true`)

**Priority**: `is_resolved` takes precedence over `is_muted` when both are provided.

### Response Format

**Success (200 OK)**:
```json
{
  "id": "9ec79c33ec9942ab8353589fcb2e04dc"
}
```

**Error Response**:
```json
{
  "error": {
    "type": "ValidationError",
    "message": "Invalid envelope format"
  }
}
```

**Rate Limited (429)**:
```json
{
  "error": "rate_limit_exceeded",
  "retry_after": 59
}
```
With header: `Retry-After: 59`

**Status Codes**:
- `200` - Success
- `400` - Bad request (invalid format)
- `401` - Unauthorized (invalid token)
- `413` - Payload too large
- `429` - Rate limited
- `500` - Internal error

---

## Rate Limiting

Rate limiting protects the server from event floods. It operates at two scopes:

### Scopes

1. **Installation (Global)**: Limits total events across all projects
2. **Project**: Limits events for a specific project

### Time Windows

- **Per minute**: Short burst protection
- **Per hour**: Sustained load protection

### Configuration

```bash
# Global limits
MAX_EVENTS_PER_MINUTE=1000          # Default: 1000
MAX_EVENTS_PER_HOUR=10000           # Default: 10000

# Per-project limits
MAX_EVENTS_PER_PROJECT_PER_MINUTE=500   # Default: 500
MAX_EVENTS_PER_PROJECT_PER_HOUR=5000    # Default: 5000
```

### Behavior

1. **During Ingest**: Checks `quota_exceeded_until` timestamp
   - If exceeded: Returns 429 with `Retry-After` header immediately
   - If not: Accepts event

2. **During Digest**: Updates quota state after processing
   - Counts events in time windows
   - Sets `quota_exceeded_until` if limit reached
   - Optimized with `next_quota_check` to skip expensive COUNT queries

### Database State

```sql
-- Installation table (singleton, id=1)
CREATE TABLE installation (
    id INTEGER PRIMARY KEY DEFAULT 1,
    digested_event_count BIGINT NOT NULL DEFAULT 0,
    quota_exceeded_until TIMESTAMPTZ,
    quota_exceeded_reason TEXT,
    next_quota_check BIGINT NOT NULL DEFAULT 0
);

-- Projects table (rate limiting columns)
ALTER TABLE projects ADD COLUMN quota_exceeded_until TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN quota_exceeded_reason TEXT;
ALTER TABLE projects ADD COLUMN next_quota_check BIGINT NOT NULL DEFAULT 0;
```

---

## Pagination

The Issues and Events APIs use cursor-based (keyset) pagination for efficient handling of large datasets.

### Query Parameters

```
?cursor=<encoded_cursor>&order=desc&sort=last_seen&include_resolved=false
```

### Response Format

```json
{
  "data": [...],
  "next_cursor": "eyJzb3J0IjoibGFzdF9zZWVuIiwiZGlnZXN0X29yZGVyIjo1fQ==",
  "has_more": true
}
```

### Issue Sort Options

- `digest_order` (default) - Order of first occurrence
- `last_seen` - Most recently seen first

---

## Event Data Structure

Events from SDKs contain:

```json
{
  "event_id": "9ec79c33ec9942ab8353589fcb2e04dc",
  "timestamp": 1704801600.0,
  "platform": "python",
  "level": "error",
  "transaction": "/api/users",
  "release": "v1.2.3",
  "environment": "production",

  "exception": {
    "values": [{
      "type": "TypeError",
      "value": "Cannot read property 'x' of undefined",
      "stacktrace": {
        "frames": [{
          "filename": "/app/views.py",
          "function": "get_user",
          "lineno": 42,
          "colno": 10,
          "in_app": true,
          "pre_context": ["line 40", "line 41"],
          "context_line": "line 42 - the error",
          "post_context": ["line 43", "line 44"]
        }]
      }
    }]
  },

  "breadcrumbs": {
    "values": [{
      "timestamp": 1704801599.0,
      "type": "navigation",
      "category": "navigation",
      "message": "User navigated to /users"
    }]
  },

  "user": {
    "id": "123",
    "email": "user@example.com"
  },

  "tags": {
    "environment": "production",
    "browser": "Chrome"
  },

  "fingerprint": ["{{ default }}", "custom-group"]
}
```

---

## Ingestion Flow

### Phase 1: Ingest (Synchronous, <50ms)

```
Request → Rate Limit Check → Auth → Decompress → Parse Envelope → Validate → Store Temp → Return 200
```

1. **Rate Limit**: Check `quota_exceeded_until` - return 429 if exceeded
2. **Authenticate**: Validate sentry_key against `projects` table
3. **Decompress**: Handle gzip/deflate/brotli Content-Encoding
4. **Parse**: Stream-parse envelope (don't load entire payload into memory)
5. **Validate**: Check event_id is valid UUID, required fields present
6. **Store**: Write to temp file
7. **Respond**: Return `{"id": "<event_id>"}` immediately

### Phase 2: Digest (Asynchronous, 100-500ms)

```
Rate Limit Check → Read Temp → Calculate Grouping → Find/Create Issue → Store Event → Update Quota → Cleanup
```

1. **Rate Limit**: Double-check quota (for backlog scenarios) - discard if exceeded
2. **Read**: Load event data from temp storage
3. **Grouping**: Calculate grouping key (see algorithm below)
4. **Lookup**: Check if grouping exists (`groupings` table)
5. **Issue**: Create new issue or update existing
6. **Event**: Store event with issue reference
7. **Stats**: Update `digested_event_count`, `last_seen`
8. **Quota**: Update rate limit counters
9. **Cleanup**: Delete temp file

### Concurrency Control (Advisory Locks)

When creating new issues, we need to generate sequential `digest_order` values per project.
Without proper locking, concurrent event processing can cause duplicate `digest_order` values.

**Solution**: PostgreSQL advisory locks scoped to each project:

```rust
// Acquire transaction-scoped advisory lock for this project
sqlx::query("SELECT pg_advisory_xact_lock($1)")
    .bind(project_id as i64)
    .execute(&mut *tx)
    .await?;

// Safe to read MAX(digest_order) and insert new issue
// Lock is automatically released on commit/rollback
```

**Key Properties:**
- `pg_advisory_xact_lock()` is transaction-scoped (auto-releases on commit/rollback)
- Lock key is `project_id` cast to `i64` (bigint)
- Different projects can process events concurrently (locks are per-project)
- Only held briefly during issue creation, not during entire event processing

**Why Advisory Locks?**
- Lighter than table-level locks
- Application-controlled (explicit acquire)
- Don't block reads, only other lock attempts
- Perfect for "get max + insert" patterns

---

## Grouping Algorithm

The grouping key determines which events are grouped into the same Issue.

```rust
fn calculate_grouping_key(event: &Event) -> String {
    // 1. Custom fingerprint (highest priority)
    if let Some(fingerprint) = &event.fingerprint {
        return fingerprint.iter()
            .map(|part| {
                if part == "{{ default }}" {
                    default_grouping_key(event)
                } else {
                    part.clone()
                }
            })
            .collect::<Vec<_>>()
            .join(" ⋄ ");
    }

    // 2. Default grouping
    default_grouping_key(event)
}

fn default_grouping_key(event: &Event) -> String {
    let transaction = event.transaction.as_deref().unwrap_or("<no transaction>");

    // Exception-based grouping
    if let Some(exc) = event.exception.as_ref()
        .and_then(|e| e.values.first())
    {
        let type_name = &exc.type_name;
        let value_first_line = exc.value
            .as_deref()
            .unwrap_or("<no message>")
            .lines()
            .next()
            .unwrap_or("<no message>");

        return format!("{}: {} ⋄ {}", type_name, value_first_line, transaction);
    }

    // Log message grouping
    if let Some(logentry) = &event.logentry {
        let message = logentry.message
            .as_deref()
            .or(logentry.formatted.as_deref())
            .unwrap_or("<no message>");

        return format!("Log Message: {} ⋄ {}", message, transaction);
    }

    // Fallback
    format!("<unknown> ⋄ {}", transaction)
}
```

**Separator**: `" ⋄ "` (diamond character, U+22C4)

**Hash**: SHA256 of the grouping key for indexed lookups:
```rust
let hash = sha256::digest(grouping_key.as_bytes());
```

---

## Database Schema

### installation
```sql
-- Singleton for global rate limiting state
CREATE TABLE installation (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    digested_event_count BIGINT NOT NULL DEFAULT 0,
    quota_exceeded_until TIMESTAMPTZ,
    quota_exceeded_reason TEXT,
    next_quota_check BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### projects
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
    -- Rate limiting fields
    quota_exceeded_until TIMESTAMPTZ,
    quota_exceeded_reason TEXT,
    next_quota_check BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_projects_sentry_key ON projects(sentry_key);
CREATE INDEX idx_projects_slug ON projects(slug);
```

### auth_tokens
```sql
CREATE TABLE auth_tokens (
    id SERIAL PRIMARY KEY,
    token CHAR(40) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_auth_tokens_token ON auth_tokens(token);
```

### issues
```sql
CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    digest_order INTEGER NOT NULL,
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    digested_event_count INTEGER NOT NULL DEFAULT 0,
    stored_event_count INTEGER NOT NULL DEFAULT 0,
    calculated_type VARCHAR(128) DEFAULT '',
    calculated_value TEXT DEFAULT '',
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

### events
```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
    grouping_id INTEGER REFERENCES groupings(id) ON DELETE SET NULL,
    data JSONB NOT NULL,
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

### groupings
```sql
CREATE TABLE groupings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    grouping_key TEXT NOT NULL,
    grouping_key_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(project_id, grouping_key_hash)
);
```

---

## Configuration

Environment variables:

```bash
# Server
HOST=0.0.0.0
PORT=8080
RUST_LOG=info

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/rustrak
DATABASE_MAX_CONNECTIONS=10
DATABASE_MIN_CONNECTIONS=1

# Security (production)
SSL_PROXY=true                    # Enable when behind HTTPS proxy (nginx, Cloudflare)
SESSION_SECRET_KEY=<hex-64-chars> # Required when SSL_PROXY=true

# Rate Limiting
MAX_EVENTS_PER_MINUTE=1000
MAX_EVENTS_PER_HOUR=10000
MAX_EVENTS_PER_PROJECT_PER_MINUTE=500
MAX_EVENTS_PER_PROJECT_PER_HOUR=5000

# Storage
INGEST_DIR=/tmp/rustrak/ingest    # Temporary event storage
```

### Security Configuration

The `SecurityConfig` struct controls production security settings:

```rust
pub struct SecurityConfig {
    /// True if server is behind SSL-terminating proxy (nginx, Cloudflare)
    /// When true: cookie_secure=true, SESSION_SECRET_KEY required
    pub ssl_proxy: bool,
    /// Session encryption key (64 hex chars)
    pub session_secret_key: Option<String>,
}
```

**Development**: Both variables optional (random session key used, insecure cookies)
**Production**: Set `SSL_PROXY=true` and provide `SESSION_SECRET_KEY`

---

## File Structure

```
apps/server/
├── CLAUDE.md           # This file
├── Cargo.toml
├── Dockerfile
├── .dockerignore
├── migrations/         # SQLx migrations
│   ├── 20260119000000_initial_schema.up.sql
│   ├── 20260119000001_add_projects_name_unique.up.sql
│   ├── 20260119000002_create_auth_tokens.up.sql
│   ├── 20260119000003_create_issues.up.sql
│   ├── 20260119000004_create_groupings.up.sql
│   ├── 20260119000005_create_events.up.sql
│   ├── 20260119000006_add_rate_limiting.up.sql
│   └── 20260119000007_remove_soft_delete.up.sql
└── src/
    ├── main.rs         # Entry point, bootstrap token
    ├── config.rs       # Environment config (inc. RateLimitConfig)
    ├── error.rs        # Centralized error handling (AppError)
    ├── auth/
    │   ├── mod.rs
    │   ├── token.rs        # Token generation (40-char hex)
    │   ├── sentry_auth.rs  # X-Sentry-Auth header parser
    │   └── extractors.rs   # BearerAuth, SentryAuth extractors
    ├── db/
    │   └── mod.rs          # Connection pool, migrations
    ├── models/
    │   ├── mod.rs
    │   ├── project.rs      # Project model (with quota fields)
    │   ├── auth_token.rs   # AuthToken model
    │   ├── event.rs        # Event model + responses
    │   ├── issue.rs        # Issue model + responses
    │   ├── grouping.rs     # Grouping model
    │   └── installation.rs # Installation singleton for rate limiting
    ├── pagination/
    │   └── mod.rs          # Cursor-based pagination (keyset)
    ├── services/
    │   ├── mod.rs
    │   ├── project.rs      # ProjectService CRUD
    │   ├── auth_token.rs   # AuthTokenService CRUD
    │   ├── event.rs        # EventService (paginated)
    │   ├── issue.rs        # IssueService (paginated)
    │   ├── grouping.rs     # GroupingService + algorithm
    │   └── rate_limit.rs   # RateLimitService (quota checks/updates)
    ├── ingest/             # Event ingestion module
    │   ├── mod.rs
    │   ├── envelope.rs     # Envelope/Item structs
    │   ├── parser.rs       # EnvelopeParser
    │   ├── decompression.rs # gzip/deflate/brotli
    │   └── storage.rs      # Temp file storage
    ├── digest/             # Event processing module
    │   ├── mod.rs
    │   └── worker.rs       # Async digest worker (with rate limit)
    └── routes/
        ├── mod.rs
        ├── health.rs       # Health endpoints
        ├── projects.rs     # /api/projects (Bearer auth)
        ├── tokens.rs       # /api/tokens (Bearer auth)
        ├── issues.rs       # /api/projects/{id}/issues (Bearer auth)
        ├── events.rs       # /api/.../events (Bearer auth)
        └── ingest.rs       # /api/{project_id}/envelope/ (SentryAuth, rate limited)
```

---

## Skills

When working on the server, leverage these skills:

- **rustrak-server** - Rustrak-specific patterns, Sentry protocol, ingestion flow
- **rust-coder** - Idiomatic Rust patterns, data modeling, traits
- **rust-debugger** - Debugging compile errors and borrow checker issues

These skills provide step-by-step guidance, examples, and best practices for server development. See `.claude/skills/` for complete skill documentation.
