# Rustrak — Crate Inventory & Architecture

> Quick-reference overview of every Rust crate used in `apps/server/` and the architectural patterns they support.

---

## 1. Production Crates

### Web Framework
| Crate | Version | Purpose |
|-------|---------|---------|
| **actix-web** | 4.13 | HTTP framework: routing, middleware, extractors |
| **actix-rt** | 2.11 | Actix async runtime (Tokio-backed) |
| **actix-session** | 0.11 | Session management for Web UI login (CookieSessionStore) |
| **actix-cors** | 0.7 | CORS middleware (permissive for Sentry SDK cross-origin ingestion) |

### Async Runtime
| Crate | Version | Purpose |
|-------|---------|---------|
| **tokio** | 1.52 | Async runtime (full features). Underlies actix-rt |
| **futures-util** | 0.3 | Async utility combinators |

### Database
| Crate | Version | Purpose |
|-------|---------|---------|
| **sqlx** | 0.8 | Async SQL toolkit. Queries, migrations, connection pooling. Features: `runtime-tokio`, `tls-rustls`, `uuid`, `chrono`, `migrate`, `postgres`/`sqlite` |

### Serialization & Time
| Crate | Version | Purpose |
|-------|---------|---------|
| **serde** | 1.0 | Serialization framework (derive macro). JSON request/response bodies |
| **serde_json** | 1.0 | JSON parsing. Events stored as `serde_json::Value` (JSONB) |
| **chrono** | 0.4 | Date/time handling. All timestamps are UTC. Features: `serde` |
| **uuid** | 1.23 | UUID v4 generation. Event IDs, issue IDs, sentry_keys. Features: `v4`, `serde` |

### Cryptography & Security
| Crate | Version | Purpose |
|-------|---------|---------|
| **argon2** | 0.5 | Password hashing (Argon2id, OWASP recommended) |
| **rand** | 0.10 | Cryptographically secure random generation (tokens, salts) |
| **sha2** | 0.11 | SHA256 hashing for grouping key hash |
| **hex** | 0.4 | Hex encoding/decoding (token strings, SHA256 hashes) |
| **base64** | 0.22 | URL-safe base64 encoding for pagination cursors |
| **hmac** | 0.13 | HMAC signatures for webhook authenticity |

### Decompression (Sentry Envelope Ingestion)
| Crate | Version | Purpose |
|-------|---------|---------|
| **flate2** | 1.1 | Gzip and deflate decompression |
| **brotli** | 8.0 | Brotli decompression |

### Error Handling
| Crate | Version | Purpose |
|-------|---------|---------|
| **thiserror** | 2.0 | Ergonomic error derivation (`AppError` enum) |

### Networking & Notifications
| Crate | Version | Purpose |
|-------|---------|---------|
| **reqwest** | 0.13 | HTTP client for webhook notifications |
| **url** | 2.5 | URL parsing/validation for webhook URLs |
| **lettre** | 0.11 | SMTP email sending (email notification channel) |

### Traits & Async
| Crate | Version | Purpose |
|-------|---------|---------|
| **async-trait** | 0.1 | Enables `async fn` in traits (`NotificationDispatcher`) |

### Utilities
| Crate | Version | Purpose |
|-------|---------|---------|
| **bytes** | 1.11 | Efficient byte buffer handling for request bodies |
| **slug** | 0.1 | URL-friendly slug generation from project names |
| **log** | 0.4 | Logging facade (debug, info, warn, error) |
| **env_logger** | 0.11 | Structured logging via `RUST_LOG` env var |
| **dotenvy** | 0.15 | `.env` file loading |

---

## 2. Dev/Test Crates

| Crate | Version | Purpose |
|-------|---------|---------|
| **rstest** | 0.26 | Test fixtures/framework |
| **serial_test** | 3.4 | Serial test execution |
| **actix-test** | 0.1 | Actix-web HTTP testing utilities |
| **testcontainers** | 0.27 | Real PostgreSQL containers for integration testing |
| **sentry** | 0.47 | Official Sentry Rust SDK for end-to-end tests |
| **proptest** | 1.11 | Property-based testing |
| **pretty_assertions** | 1.4 | Better diff output in test failures |
| **tempfile** | 3.27 | Temporary directories for storage tests |

---

## 3. Module Architecture

```
┌─────────────────────────────────────────────┐
│                  main.rs                     │  Entry point: wiring, bootstrap
├─────────────────────────────────────────────┤
│               Middleware Layer               │
│  - SessionMiddleware (CookieSessionStore)   │
│  - CORS (any origin, Sentry headers)        │
│  - Compress, Logger                         │
│  - RequireAuth (session check, exempt routes)│
├─────────────────────────────────────────────┤
│               Route Layer (routes/)          │
│  health, auth, ingest, projects, tokens,     │
│  issues, events, alerts                      │
├─────────────────────────────────────────────┤
│            Auth/Extractor Layer (auth/)      │
│  BearerAuth  ← validates Bearer token        │
│  SentryAuth  ← validates project+sentry_key  │
│  AuthenticatedUser ← validates session       │
│  RequireAuth ← session middleware            │
├─────────────────────────────────────────────┤
│            Service Layer (services/)         │
│  ProjectService, AuthTokenService,           │
│  EventService, IssueService, GroupingService │
│  UsersService, RateLimitService,             │
│  AlertService, NotificationDispatcher        │
├─────────────────────────────────────────────┤
│            Model Layer (models/)             │
│  All SQL row structs, DTOs, response types    │
├─────────────────────────────────────────────┤
│            DB Layer (db/)                    │
│  DbPool, migrations, health_check            │
├─────────────────────────────────────────────┤
│  Ingest Pipeline (ingest/)                   │
│  decompression → parser → storage             │
├─────────────────────────────────────────────┤
│  Digest Pipeline (digest/)                   │
│  read → group → create/update issue → store  │
└─────────────────────────────────────────────┘
```

---

## 4. Key Design Patterns

### 4.1 Actix-Web Extractors (`FromRequest`)
Three custom extractors handle all authentication, making handlers clean and declarative:

- **`BearerAuth`** — Extracts `Authorization: Bearer <40-char-hex>`, validates against `auth_tokens` table. Used for programmatic API access.
- **`SentryAuth`** — Extracts `project_id` from URL and `sentry_key` from query param or `X-Sentry-Auth` header, validates against `projects`. Used for SDK ingestion.
- **`AuthenticatedUser`** — Extracts session cookie, fetches user from DB. Used for Web UI management endpoints.

### 4.2 Two-Phase Event Ingestion
```
Phase 1 (Ingest - sync, <50ms):
  Rate Limit → Auth → Decompress → Parse Envelope → Validate → Temp File → Return 200

Phase 2 (Digest - async, tokio::spawn):
  Rate Limit → Read Temp → Grouping → Advisory Lock → Create/Update Issue →
  Store Event → Update Counters/Quota → Trigger Alert → Cleanup Temp
```

The ingest handler returns 200 immediately after spawning the background `tokio::spawn` task.

### 4.3 PostgreSQL Advisory Locks
When creating new issues with sequential `digest_order` values, `pg_advisory_xact_lock(project_id as i64)` prevents duplicate ordering from concurrent event processing. Released automatically on commit/rollback.

### 4.4 Strategy Pattern (Notifications)
`NotificationDispatcher` trait with `send()` and `validate_config()` implemented by:
- `WebhookNotifier` (HMAC-signed HTTP POST)
- `EmailNotifier` (lettre SMTP)
- `SlackNotifier` (incoming webhook)

Factory function `create_dispatcher(channel_type)` returns the appropriate implementation.

### 4.5 Cursor-Based Pagination
Base64-encoded JSON cursors (URL-safe, no padding) for keyset pagination on issues and events. Supports sort modes with tie-breaker UUIDs.

### 4.6 Cross-DB Compatibility
Supports both PostgreSQL and SQLite via mutually exclusive Cargo features. Conditional compilation (`#[cfg(feature = "postgres")]`) handles advisory locks, SQL syntax differences, and pool types.

---

## 5. Authentication Architecture

| Method | Use Case | Mechanism |
|--------|----------|-----------|
| **Session** | Web UI users | `actix-session` with httpOnly cookies, Argon2id passwords |
| **Bearer Token** | API/programmatic access | 40-char hex tokens, `Authorization: Bearer <hex>` header |
| **Sentry Key** | SDK event ingestion | UUID sentry_key in DSN or `X-Sentry-Auth` header |

---

## 6. Database Tables

| Table | Key | Purpose |
|-------|-----|---------|
| `installation` | id=1 (singleton) | Global rate limiting state |
| `projects` | SERIAL | Project config, sentry_key, event counters |
| `auth_tokens` | SERIAL | API bearer tokens |
| `users` | SERIAL | Web UI accounts (Argon2id hashes) |
| `issues` | UUID | Grouped error issues (soft-delete) |
| `events` | UUID | Individual event occurrences (JSONB data) |
| `groupings` | SERIAL | SHA256 hash → issue_id mapping |
| `notification_channels` | SERIAL | Alert delivery destinations |
| `alert_rules` | SERIAL | Per-project alert triggers |
| `alert_history` | BIGSERIAL | Idempotent alert audit log |

---

## 7. Sentry Protocol Compatibility

- Accepts standard **Sentry envelope protocol** (newline-delimited JSON headers + items)
- Handles `gzip`, `deflate`, `brotli` content encoding
- Groups events using: custom fingerprint → exception type + message → log message → fallback
- Returns `{"id": "<event_id>"}` matching Sentry's response format
- DSN format: `http://<sentry_key>@<host>/<project_id>`
