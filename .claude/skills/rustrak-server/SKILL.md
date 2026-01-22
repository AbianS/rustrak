---
name: rustrak-server
description: Rustrak server architecture, Sentry protocol implementation, event ingestion patterns, and API design. Use when working on the Rustrak server backend, implementing Sentry compatibility, or working with the event ingestion pipeline.
scope: server
allowed-tools: Read Glob Grep Bash Edit Write
---

# Rustrak Server Skill

## When to Use This Skill

Activate this skill when:
- Working on the Rustrak server codebase (`apps/server/`)
- Implementing Sentry protocol compatibility
- Building or modifying event ingestion endpoints
- Working with issue grouping algorithms
- Implementing rate limiting or quota management
- Designing API endpoints for the UI dashboard

## Core Concepts

### 1. Authentication Architecture

Rustrak implements **three authentication methods** for different use cases:

#### Session Authentication (Web UI)

For human users accessing the web dashboard:

```rust
// User model with Argon2id password hashing
pub struct User {
    pub id: i32,
    pub email: String,
    pub password_hash: String, // Argon2id hashed
    pub is_active: bool,
    pub is_admin: bool,
}

impl User {
    pub fn hash_password(password: &str) -> Result<String, AppError> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2.hash_password(password.as_bytes(), &salt)?;
        Ok(hash.to_string())
    }

    pub fn verify_password(&self, password: &str) -> Result<bool, AppError> {
        let parsed_hash = PasswordHash::new(&self.password_hash)?;
        Ok(Argon2::default().verify_password(password.as_bytes(), &parsed_hash).is_ok())
    }
}
```

**Session Management:**
```rust
use actix_session::{SessionMiddleware, storage::CookieSessionStore};

// In main.rs
HttpServer::new(move || {
    App::new()
        .wrap(SessionMiddleware::builder(
            CookieSessionStore::default(),
            Key::from(&secret_key[..])
        )
        .cookie_http_only(true)
        .cookie_same_site(actix_web::cookie::SameSite::Lax)
        .cookie_secure(config.security.ssl_proxy) // Secure cookies when behind HTTPS
        .build())
        // ... routes
})
```

**Security Configuration (production):**
```rust
// config.rs - SecurityConfig struct
pub struct SecurityConfig {
    pub ssl_proxy: bool,              // Set via SSL_PROXY env var
    pub session_secret_key: Option<String>, // Required when ssl_proxy=true
}

// Environment variables:
// SSL_PROXY=true              → Enable secure cookies (behind HTTPS proxy)
// SESSION_SECRET_KEY=<hex64>  → Required when SSL_PROXY=true
```

**Auth Endpoints:**
- `POST /auth/register` - Create user account
- `POST /auth/login` - Authenticate and create session
- `POST /auth/logout` - Destroy session
- `GET /auth/me` - Get current user (requires session)

**Bootstrap Pattern:**
```rust
// First-time setup: Create admin user if DB is empty
if let Ok(env_var) = std::env::var("CREATE_SUPERUSER") {
    let parts: Vec<&str> = env_var.splitn(2, ':').collect();
    if parts.len() == 2 {
        let (email, password) = (parts[0], parts[1]);
        if user_count(&pool).await? == 0 {
            create_user(&pool, email, password, true).await?;
            log::info!("✅ Superuser created: {}", email);
        }
    }
}
```

#### Token Authentication (API/Management)

For programmatic API access:

```rust
// Validate Bearer token from Authorization header
pub struct BearerAuth {
    pub token: String,
}

impl FromRequest for BearerAuth {
    async fn from_request(req: &HttpRequest, _: &mut Payload) -> Result<Self, Self::Error> {
        let auth_header = req.headers()
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Auth("Missing Authorization header".to_string()))?;

        if !auth_header.starts_with("Bearer ") {
            return Err(AppError::Auth("Invalid token format".to_string()));
        }

        let token = auth_header[7..].to_string();
        Ok(BearerAuth { token })
    }
}
```

#### SentryAuth (SDK Ingestion)

For Sentry SDKs sending events - see section below.

**Why Three Methods?**
- Session auth: Best UX for human users (no token management)
- Token auth: Standard for API clients and token management
- SentryAuth: Compatibility with Sentry SDK protocol

### 2. Sentry Protocol Compatibility

Rustrak accepts events from **any Sentry SDK** using the standard Sentry envelope protocol.

**DSN Format:**
```
http://<sentry_key>@<host>/<project_id>
```

**Envelope Structure:**
```
{envelope_headers}\n
{item_headers}\n
{item_payload}\n
...
```

**Key Implementation Details:**
- Use **streaming parser** - never load entire payload into memory
- Support gzip/deflate/brotli compression
- Authenticate via `X-Sentry-Auth` header or `?sentry_key=` query param
- Return `200 OK` with `{"id": "<event_id>"}` immediately
- Process asynchronously after response

### 2. Two-Phase Ingestion Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PHASE 1: INGEST                      │
│                  (Synchronous, <50ms)                   │
├─────────────────────────────────────────────────────────┤
│  1. Rate Limit Check (quota_exceeded_until)             │
│  2. Authenticate (sentry_key validation)                │
│  3. Decompress (gzip/deflate/brotli)                    │
│  4. Parse Envelope (streaming)                          │
│  5. Validate (event_id, required fields)                │
│  6. Store to Temp File                                  │
│  7. Return 200 {"id": "..."}                            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    PHASE 2: DIGEST                      │
│                (Asynchronous, 100-500ms)                │
├─────────────────────────────────────────────────────────┤
│  1. Read from Temp Storage                              │
│  2. Calculate Grouping Key                              │
│  3. Find or Create Issue                                │
│  4. Store Event                                         │
│  5. Update Stats (last_seen, event_count)               │
│  6. Update Rate Limit Quota                             │
│  7. Cleanup Temp File                                   │
└─────────────────────────────────────────────────────────┘
```

**Why Two Phases?**
- **Ingest**: Fast response to SDK (<50ms P99), minimal blocking work
- **Digest**: Heavy processing (grouping, DB writes) happens async

### 3. Issue Grouping Algorithm

Events are grouped into Issues using a **deterministic grouping key**.

**Algorithm (in order of priority):**

1. **Custom Fingerprint** (if provided):
   ```rust
   if let Some(fingerprint) = &event.fingerprint {
       // Replace "{{ default }}" with default grouping
       fingerprint.iter()
           .map(|part| {
               if part == "{{ default }}" {
                   default_grouping_key(event)
               } else {
                   part.clone()
               }
           })
           .collect::<Vec<_>>()
           .join(" ⋄ ")
   }
   ```

2. **Exception-based Grouping**:
   ```
   <exception_type>: <first_line_of_value> ⋄ <transaction>
   ```

3. **Log Message Grouping**:
   ```
   Log Message: <message> ⋄ <transaction>
   ```

4. **Fallback**:
   ```
   <unknown> ⋄ <transaction>
   ```

**Separator**: Use `" ⋄ "` (diamond character, U+22C4)

**Hashing**: SHA256 of grouping key for indexed lookups:
```rust
use sha2::{Sha256, Digest};
let hash = format!("{:x}", Sha256::digest(grouping_key.as_bytes()));
```

### 4. Rate Limiting Strategy

**Two Scopes:**
- **Installation (Global)**: Total events across all projects
- **Project**: Events for specific project

**Two Windows:**
- **Per minute**: Burst protection
- **Per hour**: Sustained load protection

**Optimization Pattern:**
```rust
// Check if we need to run expensive COUNT query
if digested_event_count < next_quota_check {
    return Ok(()); // Skip check
}

// Otherwise, run COUNT and update state
let count = count_events_in_window(window)?;
if count > threshold {
    quota_exceeded_until = now + window;
    next_quota_check = digested_event_count + threshold;
}
```

**Why `next_quota_check`?**
- Avoids running COUNT query on every digest
- Only checks when we've processed N more events
- Significantly reduces DB load

### 5. Concurrency Control (Advisory Locks)

When creating new issues, we need sequential `digest_order` values per project.
Use PostgreSQL advisory locks to prevent race conditions:

```rust
// Start transaction
let mut tx = pool.begin().await?;

// Acquire transaction-scoped advisory lock for this project
sqlx::query("SELECT pg_advisory_xact_lock($1)")
    .bind(project_id as i64)
    .execute(&mut *tx)
    .await?;

// Safe to read MAX(digest_order) and insert new issue
let max_order: Option<i32> = sqlx::query_scalar(
    "SELECT MAX(digest_order) FROM issues WHERE project_id = $1"
)
.bind(project_id)
.fetch_one(&mut *tx)
.await?;

let digest_order = max_order.unwrap_or(0) + 1;

// Insert issue with sequential digest_order
// ...

// Lock is automatically released on commit/rollback
tx.commit().await?;
```

**Key Properties:**
- `pg_advisory_xact_lock()` - transaction-scoped, auto-releases on commit/rollback
- Lock key is `project_id as i64` - different projects can process concurrently
- Only held briefly during issue creation
- Perfect for "get max + insert" patterns

### 6. Issue State Management

Issues support state changes via PATCH endpoint:

```rust
// Update issue state
pub async fn resolve(pool: &PgPool, id: Uuid) -> AppResult<Issue> {
    sqlx::query_as(
        "UPDATE issues SET is_resolved = true WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

// Route handler
pub async fn update_issue(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    body: web::Json<UpdateIssueState>,
    _user: AuthenticatedUser,
) -> AppResult<HttpResponse> {
    // Priority: is_resolved takes precedence over is_muted
    let updated = match (body.is_resolved, body.is_muted) {
        (Some(true), _) => IssueService::resolve(&pool, issue_id).await?,
        (Some(false), _) => IssueService::unresolve(&pool, issue_id).await?,
        (None, Some(true)) => IssueService::mute(&pool, issue_id).await?,
        (None, Some(false)) => IssueService::unmute(&pool, issue_id).await?,
        (None, None) => issue, // No changes
    };
    Ok(HttpResponse::Ok().json(updated.to_response(&project.slug)))
}
```

**Request Format:**
```json
{
  "is_resolved": true,  // optional
  "is_muted": true      // optional
}
```

**States:**
- `is_resolved` - Issue marked as resolved, hidden from default list
- `is_muted` - Issue muted, hidden from default list
- `is_deleted` - Soft deleted (via DELETE endpoint)

## Coding Patterns

### Error Handling

Use `thiserror` for custom errors with context:

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("Invalid envelope format: {0}")]
    InvalidEnvelope(String),

    #[error("Rate limit exceeded until {retry_after:?}")]
    RateLimited { retry_after: i64 },
}

// Implement Actix ResponseError trait
impl actix_web::ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(_) => StatusCode::UNAUTHORIZED,
            Self::RateLimited { .. } => StatusCode::TOO_MANY_REQUESTS,
            Self::InvalidEnvelope(_) => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}
```

### Service Layer Pattern

Keep route handlers thin, business logic in services:

```rust
// routes/ingest.rs
#[post("/api/{project_id}/envelope/")]
async fn ingest_envelope(
    path: Path<i32>,
    auth: SentryAuth,
    body: Bytes,
    pool: Data<PgPool>,
) -> Result<Json<IngestResponse>, AppError> {
    let project_id = path.into_inner();

    // Thin handler - delegate to service
    let event_id = IngestService::ingest(project_id, &auth.sentry_key, body, &pool).await?;

    Ok(Json(IngestResponse { id: event_id }))
}

// services/ingest.rs
impl IngestService {
    pub async fn ingest(
        project_id: i32,
        sentry_key: &str,
        body: Bytes,
        pool: &PgPool,
    ) -> Result<Uuid, AppError> {
        // Business logic here
        // 1. Check rate limit
        // 2. Authenticate
        // 3. Parse envelope
        // 4. Store temp
        // 5. Spawn digest task
    }
}
```

### Database Queries

Use `sqlx` with compile-time checked queries:

```rust
// Query with compile-time verification
let project = sqlx::query_as!(
    Project,
    r#"
    SELECT id, name, sentry_key, quota_exceeded_until
    FROM projects
    WHERE id = $1 AND sentry_key = $2
    "#,
    project_id,
    sentry_key
)
.fetch_one(pool)
.await?;

// For dynamic queries, use query builder
let mut query = QueryBuilder::new("SELECT * FROM events WHERE 1=1");

if let Some(issue_id) = filter.issue_id {
    query.push(" AND issue_id = ");
    query.push_bind(issue_id);
}

query.build_query_as::<Event>().fetch_all(pool).await?;
```

### Async Task Spawning

For digest processing:

```rust
use tokio::task;

// Spawn background task (don't await)
task::spawn(async move {
    if let Err(e) = digest_event(event_id, pool).await {
        log::error!("Digest failed for {}: {:?}", event_id, e);
    }
});

// Return immediately to client
Ok(Json(IngestResponse { id: event_id }))
```

## File Organization

When adding new features, follow this structure:

```
src/
├── models/          # Database models + response DTOs
│   └── feature.rs
├── services/        # Business logic (pure functions preferred)
│   └── feature.rs
└── routes/          # HTTP handlers (thin, delegate to services)
    └── feature.rs
```

**Guidelines:**
1. Models are data structures only (no business logic)
2. Services contain business logic (stateless when possible)
3. Routes orchestrate services and handle HTTP concerns
4. Prefer composition over inheritance
5. Keep functions small (<50 lines)

## Testing Patterns

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_grouping_key_exception() {
        let event = create_test_event_with_exception("TypeError", "Cannot read property 'x'");
        let key = calculate_grouping_key(&event);
        assert_eq!(key, "TypeError: Cannot read property 'x' ⋄ /api/users");
    }

    #[tokio::test]
    async fn test_ingest_rate_limited() {
        let pool = setup_test_db().await;
        // Set quota exceeded
        set_project_quota_exceeded(1, &pool).await;

        let result = IngestService::ingest(1, "key", test_payload(), &pool).await;
        assert!(matches!(result, Err(AppError::RateLimited { .. })));
    }
}
```

## Common Tasks

### Adding a New API Endpoint

1. Define model in `models/`
2. Implement service logic in `services/`
3. Add route handler in `routes/`
4. Register route in `main.rs`
5. Add integration test

### Modifying Grouping Algorithm

1. Update `services/grouping.rs::calculate_grouping_key()`
2. Add tests for new grouping pattern
3. Consider backward compatibility (existing issues)
4. Update documentation in `apps/server/CLAUDE.md`

### Adding Database Migration

```bash
# Create migration file
cd apps/server
sqlx migrate add <description>

# Edit generated file in migrations/
# Run migration
sqlx migrate run
```

## Performance Considerations

1. **Streaming Parsing**: Never load entire payload into memory
2. **Indexes**: Add indexes for all foreign keys and frequently queried columns
3. **Pagination**: Use cursor-based (keyset) pagination, not offset
4. **Connection Pooling**: Configure appropriate min/max connections
5. **Temp Storage**: Use in-memory tmpfs for temp files when possible
6. **Async Tasks**: Don't block request handler, spawn background tasks

## Reference

For complete technical details, see:
- `apps/server/CLAUDE.md` - Complete server documentation
- `/docs/ingestion-flow.md` - Detailed ingestion flow
- `/docs/grouping-algorithm.md` - Grouping algorithm specification
