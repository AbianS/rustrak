# Rustrak Server — Architecture

> **Component**: `apps/server`
> **Language**: Rust 2021 edition
> **Framework**: Actix-web 4.12

---

## 1. Executive Summary

The Rustrak server is a high-performance, API-only backend written in Rust. It accepts events from any Sentry-compatible SDK, stores them durably, groups them into issues, and triggers alerts. The server is intentionally opinionated about minimal footprint: it targets <100MB RAM idle and <20MB Docker image size.

The server exposes two surface areas:

- **Ingest API** — Sentry envelope protocol endpoints used by SDKs (`/api/<project_id>/envelope/`, `/api/<project_id>/store/`)
- **Management API** — RESTful JSON endpoints used by the web UI and direct API clients (`/api/v1/...`)

---

## 2. Architecture Pattern

The server follows a **layered, async-first** architecture:

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────┐
│             Actix-web Router            │  ← Route matching, middleware
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│             Extractors / Guards         │  ← Auth, rate limit, request parsing
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│              Route Handlers             │  ← src/routes/**
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│              Service Layer              │  ← src/services/**  (business logic)
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│              Model Layer                │  ← src/models/**  (data shapes)
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│              Database Layer             │  ← SQLx queries, migrations
└─────────────────────────────────────────┘
```

All I/O is non-blocking. Tokio drives the async runtime. Blocking work (password hashing, heavy grouping) is offloaded to `tokio::task::spawn_blocking`.

---

## 3. Tech Stack

| Concern             | Technology                  | Notes                                      |
|---------------------|-----------------------------|--------------------------------------------|
| Language            | Rust 2021                   | Memory-safe, zero-cost abstractions        |
| HTTP Framework      | Actix-web 4.12              | Actor model, high throughput               |
| Async Runtime       | Tokio                       | Multi-threaded, work-stealing scheduler    |
| Database ORM        | SQLx 0.8                    | Compile-time checked queries, async        |
| Database (default)  | SQLite                      | Feature flag `sqlite`, zero-dependency dev |
| Database (prod)     | PostgreSQL 16               | Feature flag `postgres`, advisory locks    |
| Auth (sessions)     | actix-session               | httpOnly cookies, server-side sessions     |
| Password hashing    | Argon2id                    | OWASP recommended algorithm               |
| Serialization       | serde / serde_json          | Zero-copy where possible                  |
| Error types         | thiserror                   | Typed error hierarchy                      |
| Logging             | log + env_logger            | Controlled via `RUST_LOG`                  |
| Container           | Docker multi-stage          | Distroless final image, ~20MB             |
| CI                  | GitHub Actions              | sccache + rust-cache for fast rebuilds     |

---

## 4. Two-Phase Ingestion Flow

Accepting an event must be fast (<50ms) and reliable. Processing can be slow and retried. These concerns are separated into two phases.

```
Sentry SDK
    │
    │  POST /api/<project_id>/envelope/
    ▼
┌───────────────────────────────────────────────────────┐
│                   PHASE 1 — INGEST                    │
│                  (synchronous, <50ms)                  │
│                                                       │
│  1. Authenticate (SDK key)                            │
│  2. Rate limit check (per-project, minute + hour)     │
│  3. Parse envelope headers                            │
│  4. Basic schema validation                           │
│  5. Write raw envelope to INGEST_DIR (disk)           │
│  6. Enqueue file path → Tokio channel                 │
│  7. Return HTTP 200 {"id": "<event_id>"}              │
└───────────────────────────────────────────────────────┘
                            │
                    Tokio mpsc channel
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│                   PHASE 2 — DIGEST                    │
│               (async Tokio task pool)                  │
│                                                       │
│  1. Read raw envelope from INGEST_DIR                 │
│  2. Full parse + normalize event                      │
│  3. Compute grouping fingerprint (SHA256)             │
│  4. Acquire advisory lock (PostgreSQL) or            │
│     mutex (SQLite) to prevent duplicate issues        │
│  5. Upsert Issue (create or increment count)          │
│  6. Insert Event record                               │
│  7. Update project statistics                         │
│  8. Evaluate alert rules → trigger notifications      │
│  9. Delete raw file from INGEST_DIR                   │
└───────────────────────────────────────────────────────┘
```

**Why disk-based queue?** The intermediate file write means events survive a server crash between phase 1 and phase 2. On restart, the server re-scans `INGEST_DIR` and replays unprocessed files.

---

## 5. Authentication Architecture

Three distinct authentication methods cover three distinct use cases.

### 5.1 Session Authentication (Web UI)

Used by human users accessing the dashboard.

```
Browser
  │
  │  POST /api/v1/auth/login  { email, password }
  ▼
Server
  │  1. Load user by email from DB
  │  2. Verify password with Argon2id
  │  3. actix-session: set session cookie (httpOnly, SameSite=Lax)
  │  4. Return 200 { user }
  ▼
Browser stores httpOnly cookie (inaccessible to JS)

Subsequent requests:
  Browser → cookie header → actix-session middleware → extract user ID → proceed
```

Session data is stored server-side. The cookie contains only a session ID.

Bootstrap: Set `CREATE_SUPERUSER="email:password"` env var on first run to seed the initial admin account.

### 5.2 Bearer Token Authentication (API Clients)

Used by programmatic API access and the web UI's Server Actions when calling management endpoints.

```
Client
  │
  │  GET /api/v1/projects
  │  Authorization: Bearer <40-char hex token>
  ▼
BearerAuth extractor
  │  1. Parse Authorization header
  │  2. Query auth_tokens table
  │  3. Verify token not revoked + not expired
  │  4. Attach user to request context
  │  5. Proceed or return 401
```

Tokens are 40-character lowercase hex strings (160 bits of entropy). Users create tokens via the web UI at `/settings/tokens`.

### 5.3 Sentry SDK Authentication (Ingestion)

Used by Sentry SDKs sending events.

```
Sentry SDK
  │
  │  POST /api/<project_id>/envelope/
  │  X-Sentry-Auth: Sentry sentry_key=<uuid>, sentry_version=7
  │         OR
  │  DSN URL key embedded in URL path
  ▼
SentryAuth extractor
  │  1. Parse X-Sentry-Auth header or DSN
  │  2. Look up project by project_id
  │  3. Verify sentry_key matches project's public key (UUID)
  │  4. Attach project to request context
  │  5. Proceed or return 401
```

The Sentry key is a UUID stored in the `projects` table. Each project has exactly one public key.

---

## 6. Rate Limiting

Rate limiting is applied during Phase 1 ingestion before any significant processing occurs.

### Limits

| Window  | Limit                             | Config Env Var               |
|---------|-----------------------------------|-------------------------------|
| Minute  | `MAX_EVENTS_PER_MINUTE` per project | `MAX_EVENTS_PER_MINUTE`       |
| Hour    | `MAX_EVENTS_PER_HOUR` per project   | `MAX_EVENTS_PER_HOUR`         |
| Global  | Applies across all projects       | `MAX_GLOBAL_EVENTS_PER_MINUTE`|

### Implementation

Counters are stored in-memory using `DashMap<ProjectId, WindowCounter>`. Each `WindowCounter` holds atomic counts for the current minute and hour windows, plus timestamps for window rotation.

When a limit is exceeded the server returns `HTTP 429 Too Many Requests` with a `Retry-After` header. The SDK will back off and retry according to the Sentry SDK retry specification.

---

## 7. Issue Grouping Algorithm

The grouping algorithm produces a deterministic 64-character SHA256 hex string (the **fingerprint**) used to identify which `Issue` an event belongs to.

### Priority Order

```
1. Custom fingerprint         (SDK-provided, {{ default }} substitution honored)
       │
       ▼ (if not set)
2. Exception type             +  first line of exception.value  +  transaction
       │
       ▼ (if no exception)
3. Log message (first 200 chars)  +  transaction
       │
       ▼ (if none of the above)
4. Fallback: event level  +  logger  +  platform
```

### Computation

```
fingerprint_input = join("|", fingerprint_parts)
fingerprint       = hex(SHA256(fingerprint_input))
```

### Concurrent Issue Creation

When two events with the same fingerprint arrive simultaneously, only one `Issue` row should be created. The mechanism differs by database backend:

- **PostgreSQL**: `SELECT pg_try_advisory_xact_lock(hash(fingerprint))` — database-level mutual exclusion, no application code needed.
- **SQLite**: In-process `tokio::sync::Mutex<HashMap<fingerprint, ()>>` — sufficient because SQLite is single-writer.

After acquiring the lock, the service does `INSERT OR IGNORE` / `ON CONFLICT DO NOTHING` then re-fetches the issue.

---

## 8. Alerting System

Alerts are evaluated during Phase 2, after the event is persisted.

### Alert Rule Structure

Each project can have multiple `AlertRule` rows with:

- **Condition**: `error_count > N in last M minutes`, `new_issue`, `regression` (resolved issue reoccurs)
- **Channel**: `webhook`, `slack`, `email`
- **Cooldown**: minimum minutes between notifications (prevents alert spam)
- **Retry**: failed deliveries retry with exponential backoff up to 3 times

### Notification Channels

| Channel   | Payload format                              |
|-----------|---------------------------------------------|
| Webhook   | POST JSON `{ event, issue, project }`       |
| Slack     | POST Slack Block Kit payload                |
| Email     | SMTP via `lettre`, HTML template            |

### Cooldown Tracking

A `alert_notifications` table records the last fired time per `(alert_rule_id, issue_id)` pair. Before firing, the service checks that `now - last_fired > cooldown_minutes`.

---

## 9. Database Architecture

### Feature Flags

The Cargo feature flags `sqlite` and `postgres` control which database driver is compiled in. Exactly one must be active.

```toml
# Cargo.toml
[features]
default = ["sqlite"]
sqlite  = ["sqlx/sqlite"]
postgres = ["sqlx/postgres"]
```

### Schema Management

SQLx migrations live in `migrations/`. They are applied automatically at startup via `sqlx::migrate!()`. Migration files are numbered and named:

```
migrations/
  0001_initial.sql
  0002_add_alert_rules.sql
  ...
```

### Key Tables

| Table               | Purpose                                        |
|---------------------|------------------------------------------------|
| `users`             | Accounts (email, argon2 hash, role)            |
| `auth_tokens`       | API tokens (hash, expiry, revoked)             |
| `projects`          | Projects (name, sentry_key UUID, rate limits)  |
| `issues`            | Grouped error records (fingerprint, count)     |
| `events`            | Individual events (raw + parsed fields)        |
| `alert_rules`       | Alert conditions and channels per project      |
| `alert_notifications` | Cooldown tracking per alert rule + issue     |

### SQLite vs PostgreSQL

| Capability               | SQLite              | PostgreSQL 16         |
|--------------------------|---------------------|-----------------------|
| Concurrent writes        | Single writer (WAL) | Full MVCC             |
| Advisory locks           | App-level mutex     | `pg_try_advisory_xact_lock` |
| JSON support             | `json()` functions  | Native `jsonb`        |
| Scale                    | Single-node         | Multi-node / replicas |
| Recommended for          | Development, small teams | Production deployments |

---

## 10. Pagination

All list endpoints that can return large result sets use **cursor-based (keyset) pagination** instead of OFFSET pagination.

### How It Works

```
GET /api/v1/projects/123/issues?limit=25&cursor=<base64>

Response:
{
  "data": [...],
  "next_cursor": "<base64>",   // null if last page
  "prev_cursor": "<base64>"    // null if first page
}
```

The cursor encodes the values of the sort columns (e.g., `last_seen DESC, id DESC`) from the last returned row. It is base64-encoded JSON, opaque to the client.

**Advantages over OFFSET**:
- O(log N) performance via index seek regardless of page depth
- Stable results when new events arrive between page requests
- No "missing" or "duplicate" rows when rows are inserted mid-pagination

---

## 11. Source Structure

```
apps/server/src/
├── main.rs                   # Entry point: config, DB pool, Actix app setup
├── config.rs                 # Env var parsing into Config struct
├── errors.rs                 # AppError type (thiserror), HTTP response mapping
├── db.rs                     # SQLx pool creation, migration runner
│
├── auth/
│   ├── session.rs            # actix-session helpers, current_user extractor
│   ├── bearer.rs             # BearerAuth extractor
│   └── sentry_auth.rs        # SentryAuth extractor (SDK key validation)
│
├── routes/
│   ├── mod.rs                # Router configuration, middleware chain
│   ├── ingest.rs             # POST /api/<id>/envelope/, /store/
│   ├── projects.rs           # CRUD /api/v1/projects
│   ├── issues.rs             # /api/v1/projects/:id/issues
│   ├── events.rs             # /api/v1/issues/:id/events
│   ├── tokens.rs             # /api/v1/tokens
│   ├── alerts.rs             # /api/v1/projects/:id/alerts
│   └── auth.rs               # /api/v1/auth/login, /logout, /me
│
├── services/
│   ├── ingest.rs             # Phase 1 logic (write to disk, enqueue)
│   ├── digest.rs             # Phase 2 worker loop (parse, group, persist)
│   ├── grouping.rs           # Fingerprint computation (SHA256)
│   ├── alerts.rs             # Alert rule evaluation + notification dispatch
│   └── rate_limit.rs         # In-memory window counters
│
└── models/
    ├── event.rs              # Event struct, Sentry envelope parsing
    ├── issue.rs              # Issue struct
    ├── project.rs            # Project struct
    ├── user.rs               # User struct
    └── alert.rs              # AlertRule, AlertNotification structs
```

---

## 12. Configuration Reference

All configuration is via environment variables. The `Config` struct in `src/config.rs` validates them at startup and panics with a clear message if required values are missing.

| Variable                    | Required | Default     | Description                                       |
|-----------------------------|----------|-------------|---------------------------------------------------|
| `HOST`                      | No       | `0.0.0.0`   | Bind address                                      |
| `PORT`                      | No       | `8080`      | HTTP port                                         |
| `DATABASE_URL`              | Yes      | —           | SQLite path or PostgreSQL URL                     |
| `SESSION_SECRET_KEY`        | Yes      | —           | 64-char hex (from `openssl rand -hex 32`)         |
| `INGEST_DIR`                | No       | `./ingest`  | Directory for phase-1 raw envelope files          |
| `MAX_EVENTS_PER_MINUTE`     | No       | `1000`      | Per-project ingest rate limit (minute window)     |
| `MAX_EVENTS_PER_HOUR`       | No       | `10000`     | Per-project ingest rate limit (hour window)       |
| `MAX_GLOBAL_EVENTS_PER_MINUTE` | No    | `5000`      | Global ingest rate limit across all projects      |
| `CREATE_SUPERUSER`          | No       | —           | `email:password` — creates admin on first run     |
| `RUST_LOG`                  | No       | `info`      | Log level filter (trace, debug, info, warn, error)|
| `SMTP_HOST`                 | No       | —           | SMTP server for email alerts                      |
| `SMTP_PORT`                 | No       | `587`       | SMTP port                                         |
| `SMTP_USER`                 | No       | —           | SMTP username                                     |
| `SMTP_PASSWORD`             | No       | —           | SMTP password                                     |
| `SMTP_FROM`                 | No       | —           | Sender address for alert emails                   |

---

## 13. Performance Characteristics

| Metric                  | Target          | Notes                                              |
|-------------------------|-----------------|----------------------------------------------------|
| Memory (idle)           | <100 MB         | Rust's lack of GC keeps baseline very low          |
| Memory (under load)     | <200 MB         | Tokio's per-task stack is small                    |
| Ingest latency P99      | <50 ms          | Disk write + channel send — no DB in critical path |
| Throughput              | 10,000+ events/s| Bottleneck is disk I/O for phase 1                 |
| Docker image size       | ~20 MB          | Multi-stage build, distroless base                 |
| Cold startup            | <1 s            | Migrations run at boot, connection pool warms up   |

### Docker Build Strategy

```dockerfile
# Stage 1: Builder
FROM rust:1.78 AS builder
# Compile with --release
# sccache caches compiled crates in CI

# Stage 2: Runtime
FROM gcr.io/distroless/cc-debian12
COPY --from=builder /app/target/release/rustrak /app/rustrak
ENTRYPOINT ["/app/rustrak"]
```

The distroless image has no shell, no package manager, and no unnecessary system libraries — only the C runtime the Rust binary needs.

### CI Build Optimization

GitHub Actions uses two layers of caching:

1. **sccache** — caches individual Rust compilation units across runs
2. **rust-cache** — caches `~/.cargo/registry` and `target/` directories

Combined, these reduce a full rebuild from ~8 minutes to ~90 seconds on cache hit.
