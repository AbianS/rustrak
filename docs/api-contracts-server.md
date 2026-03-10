# API Contracts — Server

> Generated: 2026-03-10 | Scan level: deep | Part: server

## Overview

The Rustrak server exposes a REST API compatible with the Sentry SDK envelope protocol. It serves three consumer types: Sentry SDKs (event ingestion), the web dashboard (session auth), and external API clients (bearer token auth).

**Base URL:** `http://localhost:8080` (configurable via `HOST` + `PORT` env vars)

---

## Authentication Methods

| Method | Header | Use case |
|--------|--------|----------|
| **Session** | `Cookie: session=...` (httpOnly) | Web UI human users |
| **Bearer Token** | `Authorization: Bearer <40-char-hex>` | API clients, programmatic access |
| **Sentry Auth** | `X-Sentry-Auth: Sentry sentry_key=<uuid>,...` or `?sentry_key=<uuid>` | SDK event ingestion only |

---

## Endpoints

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | None | Liveness check — returns 200 OK |
| `GET` | `/health/ready` | None | Readiness check — verifies DB connectivity |

**Response (200 OK):**
```json
{ "status": "ok" }
```

---

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | None | Create a new user account |
| `POST` | `/auth/login` | None | Authenticate and start session |
| `POST` | `/auth/logout` | Session | Destroy session |
| `GET` | `/auth/me` | Session | Get current authenticated user |

**POST /auth/register — Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**POST /auth/login — Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**POST /auth/login — Response (200 OK):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "is_admin": false,
  "created_at": "2026-01-09T12:00:00Z"
}
```
Sets `Set-Cookie: session=...` (httpOnly, SameSite=Lax).

**Bootstrap admin:**
```bash
CREATE_SUPERUSER="admin@example.com:password123" cargo run
```

---

### SDK Ingestion (Sentry Protocol)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/{project_id}/envelope/` | SentryAuth | Primary ingest endpoint (Sentry envelope format) |
| `POST` | `/api/{project_id}/store/` | SentryAuth | Legacy store endpoint (deprecated) |

**Sentry Auth via header:**
```
X-Sentry-Auth: Sentry sentry_key=<uuid>, sentry_version=7
```

**Sentry Auth via query param:**
```
POST /api/1/envelope/?sentry_key=<uuid>
```

**Envelope format (newline-delimited):**
```
{"event_id":"9ec79c33ec9942ab8353589fcb2e04dc","sent_at":"...","dsn":"..."}
{"type":"event","length":1234}
{"event_id":"9ec79c33...","platform":"python","level":"error",...}
```

**Supported compression:** `Content-Encoding: gzip`, `deflate`, `br`

**Response (200 OK):**
```json
{ "id": "9ec79c33ec9942ab8353589fcb2e04dc" }
```

**Rate limit response (429):**
```json
{ "error": "rate_limit_exceeded", "retry_after": 59 }
```
Header: `Retry-After: 59`

---

### Projects

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/projects` | Bearer/Session | List all projects |
| `POST` | `/api/projects` | Bearer/Session | Create a project |
| `GET` | `/api/projects/{id}` | Bearer/Session | Get a project by ID |
| `PATCH` | `/api/projects/{id}` | Bearer/Session | Update project name/slug |
| `DELETE` | `/api/projects/{id}` | Bearer/Session | Delete project (cascades to issues/events) |

**POST /api/projects — Request:**
```json
{
  "name": "My Application",
  "slug": "my-application"
}
```

**Project Response:**
```json
{
  "id": 1,
  "name": "My Application",
  "slug": "my-application",
  "sentry_key": "550e8400-e29b-41d4-a716-446655440000",
  "stored_event_count": 1000,
  "digested_event_count": 995,
  "created_at": "2026-01-09T12:00:00Z",
  "updated_at": "2026-01-09T12:00:00Z"
}
```

**DSN format (for SDK configuration):**
```
http://<sentry_key>@<host>/<project_id>
# Example:
http://550e8400-e29b-41d4-a716-446655440000@localhost:8080/1
```

---

### Issues

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/projects/{id}/issues` | Bearer/Session | List issues (paginated, filtered) |
| `GET` | `/api/projects/{id}/issues/{issue_id}` | Bearer/Session | Get issue detail |
| `PATCH` | `/api/projects/{id}/issues/{issue_id}` | Bearer/Session | Update issue state |
| `DELETE` | `/api/projects/{id}/issues/{issue_id}` | Bearer/Session | Delete issue |

**GET /api/projects/{id}/issues — Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `sort` | `digest_order` \| `last_seen` | `digest_order` | Sort field |
| `order` | `asc` \| `desc` | `desc` | Sort direction |
| `include_resolved` | boolean | `false` | Include resolved issues |
| `cursor` | string | — | Pagination cursor (base64) |

**Issues List Response:**
```json
{
  "data": [
    {
      "id": "9ec79c33-ec99-42ab-8353-589fcb2e04dc",
      "project_id": 1,
      "digest_order": 42,
      "first_seen": "2026-01-09T12:00:00Z",
      "last_seen": "2026-01-09T12:05:00Z",
      "digested_event_count": 15,
      "stored_event_count": 15,
      "calculated_type": "TypeError",
      "calculated_value": "Cannot read property 'x' of undefined",
      "transaction": "/api/users",
      "level": "error",
      "platform": "python",
      "is_resolved": false,
      "is_muted": false
    }
  ],
  "next_cursor": "eyJzb3J0IjoibGFzdF9zZWVuIiwiZGlnZXN0X29yZGVyIjo1fQ==",
  "has_more": true
}
```

**PATCH /api/projects/{id}/issues/{issue_id} — Request:**
```json
{
  "is_resolved": true,
  "is_muted": false
}
```

---

### Events

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/projects/{id}/issues/{issue_id}/events` | Bearer/Session | List events for issue (paginated) |
| `GET` | `/api/projects/{id}/issues/{issue_id}/events/{event_id}` | Bearer/Session | Get full event detail |

**GET events — Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `order` | `asc` \| `desc` | `desc` | Sort by timestamp |
| `cursor` | string | — | Pagination cursor |

**Event Detail Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "event_id": "9ec79c33ec9942ab8353589fcb2e04dc",
  "project_id": 1,
  "issue_id": "9ec79c33-ec99-42ab-8353-589fcb2e04dc",
  "timestamp": "2026-01-09T12:00:00Z",
  "ingested_at": "2026-01-09T12:00:00.050Z",
  "digested_at": "2026-01-09T12:00:00.300Z",
  "level": "error",
  "platform": "python",
  "transaction": "/api/users",
  "release": "v1.2.3",
  "environment": "production",
  "data": { /* full Sentry event JSON */ }
}
```

---

### Auth Tokens

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/tokens` | Bearer/Session | List tokens (masked) |
| `POST` | `/api/tokens` | Bearer/Session | Create a new token |
| `DELETE` | `/api/tokens/{id}` | Bearer/Session | Delete a token |

**POST /api/tokens — Request:**
```json
{ "description": "CI/CD Token" }
```

**POST /api/tokens — Response:**
```json
{
  "id": 1,
  "token": "a3f8c2d1e5b7...",
  "description": "CI/CD Token",
  "created_at": "2026-01-09T12:00:00Z",
  "last_used_at": null
}
```
> **Important:** The full token is only returned once at creation time.

**GET /api/tokens — Response (token is masked):**
```json
[
  {
    "id": 1,
    "token": "a3f8c2d1...****",
    "description": "CI/CD Token",
    "created_at": "2026-01-09T12:00:00Z",
    "last_used_at": "2026-01-09T13:00:00Z"
  }
]
```

---

### Alerts — Notification Channels

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/alerts/channels` | Bearer/Session | List notification channels |
| `POST` | `/api/alerts/channels` | Bearer/Session | Create a channel |
| `GET` | `/api/alerts/channels/{id}` | Bearer/Session | Get channel detail |
| `PATCH` | `/api/alerts/channels/{id}` | Bearer/Session | Update channel |
| `DELETE` | `/api/alerts/channels/{id}` | Bearer/Session | Delete channel |
| `POST` | `/api/alerts/channels/{id}/test` | Bearer/Session | Send test notification |

**Channel types:** `webhook`, `email`, `slack`

**POST /api/alerts/channels — Webhook:**
```json
{
  "name": "My Webhook",
  "channel_type": "webhook",
  "config": {
    "url": "https://example.com/webhook",
    "secret": "optional-hmac-secret",
    "headers": { "X-Custom": "value" }
  }
}
```

**POST /api/alerts/channels — Slack:**
```json
{
  "name": "Slack #errors",
  "channel_type": "slack",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/...",
    "channel": "#errors"
  }
}
```

---

### Alerts — Alert Rules (per project)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/projects/{id}/alerts` | Bearer/Session | List alert rules for project |
| `POST` | `/api/projects/{id}/alerts` | Bearer/Session | Create an alert rule |
| `GET` | `/api/projects/{id}/alerts/{rule_id}` | Bearer/Session | Get alert rule |
| `PATCH` | `/api/projects/{id}/alerts/{rule_id}` | Bearer/Session | Update alert rule |
| `DELETE` | `/api/projects/{id}/alerts/{rule_id}` | Bearer/Session | Delete alert rule |

**Alert types:** `new_issue`, `regression`, `unmute`

**POST /api/projects/{id}/alerts — Request:**
```json
{
  "name": "New Issues Alert",
  "alert_type": "new_issue",
  "conditions": {},
  "cooldown_minutes": 60,
  "channel_ids": [1, 2]
}
```

---

## Error Response Format

All errors follow this structure:
```json
{
  "error": {
    "type": "ValidationError",
    "message": "Invalid envelope format"
  }
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request (validation error, malformed body) |
| `401` | Unauthorized (missing or invalid credentials) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not found |
| `413` | Payload too large |
| `429` | Rate limited (check `Retry-After` header) |
| `500` | Internal server error |
