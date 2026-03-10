# Integration Architecture

> Generated: 2026-03-10 | Scan level: deep

## Overview

Rustrak is a monorepo with 6 components that interact across two primary integration layers:
1. **HTTP REST** — between frontend/client and the server
2. **Sentry SDK envelope protocol** — between any user app and the server

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RUSTRAK MONOREPO                                   │
│                                                                      │
│  ┌──────────────┐    HTTP REST    ┌──────────────────────┐           │
│  │  webview-ui  │◄───────────────►│                      │           │
│  │  (Next.js)   │  Bearer+Cookie  │     server           │           │
│  └──────────────┘                 │  (Rust/Actix-web)    │           │
│         ▲                         │                      │           │
│         │ @rustrak/client         │                      │           │
│         │ (workspace:*)           │                      │           │
│         │                         └──────────┬───────────┘           │
│  ┌──────────────┐                            │                       │
│  │    client    │                            │ SQLx                  │
│  │ (TypeScript) │                            ▼                       │
│  └──────────────┘                 ┌──────────────────────┐           │
│                                   │  SQLite / PostgreSQL  │           │
│  ┌──────────────┐                 └──────────────────────┘           │
│  │    docs      │ (GitHub Pages)                                      │
│  │  (Nextra)    │                                                     │
│  └──────────────┘                                                     │
│                                                                      │
│  ┌──────────────┐  Sentry envelope  ┌──────────────────────┐         │
│  │ test-sentry  │──────────────────►│     server           │         │
│  │   (CLI)      │  @sentry/node SDK │                      │         │
│  └──────────────┘                   └──────────────────────┘         │
│                                                                      │
│  ┌──────────────┐  HTTP load        ┌──────────────────────┐         │
│  │  benchmarks  │──────────────────►│     server           │         │
│  │  (Rust CLI)  │  (reqwest)        └──────────────────────┘         │
│  └──────────────┘                                                     │
└─────────────────────────────────────────────────────────────────────┘

         EXTERNAL INTEGRATIONS
┌──────────────────────────────────────┐
│  Any App + Sentry SDK                │
│  (Python, JS, Ruby, Go, etc.)        │
│         │ Sentry DSN envelope        │
│         ▼                            │
│     server /api/{id}/envelope/       │
└──────────────────────────────────────┘
```

---

## Integration Points

### 1. webview-ui → server

**Type:** HTTP REST
**Direction:** webview-ui calls server
**Auth:** Session cookie (httpOnly) forwarded from browser, or Bearer token for server-side calls

**Via:** `@rustrak/client` package (workspace dependency)

```typescript
// apps/webview-ui/src/lib/rustrak.ts
export async function createClient(): Promise<RustrakClient> {
  const cookies = await getCookies();
  return new RustrakClient({
    baseUrl: process.env.RUSTRAK_API_URL ?? 'http://localhost:8080',
    headers: { Cookie: cookies.toString() },
  });
}
```

**Server Actions pattern (all API calls):**
```typescript
// apps/webview-ui/src/actions/projects.ts
'use server';
export async function getProjects() {
  const client = await createClient();
  return client.projects.list();
}
```

**Endpoints consumed:**
- `GET /auth/me` — auth check in `(main)/layout.tsx`
- `POST /auth/login`, `POST /auth/logout` — login/logout actions
- `GET/POST/PATCH/DELETE /api/projects` — project management
- `GET/PATCH/DELETE /api/projects/{id}/issues` — issue management
- `GET /api/projects/{id}/issues/{id}/events` — event listing
- `GET /api/alerts/channels` + `/api/projects/{id}/alerts` — alert rules
- `GET/POST/DELETE /api/tokens` — API token management

**Environment variable:** `RUSTRAK_API_URL=http://localhost:8080`

---

### 2. client → server

**Type:** HTTP REST
**Package:** `@rustrak/client` (packages/client)
**Auth:** Bearer token OR session cookie (configurable)

**Used by:** webview-ui internally (workspace:*), and external consumers

```typescript
import { RustrakClient } from '@rustrak/client';

const client = new RustrakClient({
  baseUrl: 'http://localhost:8080',
  token: 'your-bearer-token',
});
```

**Resources:**
- `client.projects` — CRUD projects
- `client.issues` — list, get, updateState, delete
- `client.events` — list, get (with full Sentry data)
- `client.tokens` — CRUD API tokens

**Validation:** All responses validated with Zod schemas at runtime.

---

### 3. Any App (Sentry SDK) → server

**Type:** Sentry envelope protocol (HTTP POST)
**Direction:** external apps → server
**Auth:** `sentry_key` UUID (part of DSN)

**DSN format:** `http://<sentry_key>@<host>/<project_id>`

**Flow:**
1. Configure SDK with Rustrak DSN
2. SDK sends events to `POST /api/{project_id}/envelope/`
3. Server validates `sentry_key` against `projects.sentry_key`
4. Event ingested in <50ms, processed async

**Supported SDKs:** Any official Sentry SDK (Python, JavaScript, Ruby, Go, Java, PHP, etc.)

**Envelope format:**
```
{envelope_headers_json}\n
{item_headers_json}\n
{item_payload_json}\n
```

---

### 4. test-sentry → server

**Type:** Sentry envelope protocol (via `@sentry/node`)
**Purpose:** Developer testing tool — sends various event types to verify ingestion
**Auth:** DSN provided via `--dsn` flag

```bash
# Send all event types
pnpm test-sentry --dsn http://<key>@localhost:8080/1 --all

# Test specific types
pnpm test-sentry --dsn <dsn> --error      # TypeError
pnpm test-sentry --dsn <dsn> --message    # Log message
pnpm test-sentry --dsn <dsn> --flood      # Rate limit test
pnpm test-sentry --dsn <dsn> --breadcrumbs
pnpm test-sentry --dsn <dsn> --context
pnpm test-sentry --dsn <dsn> --user
pnpm test-sentry --dsn <dsn> --tags
pnpm test-sentry --dsn <dsn> --fingerprint
```

---

### 5. benchmarks → server

**Type:** HTTP load (reqwest)
**Purpose:** Performance testing and profiling
**Auth:** Bearer token (provisioned by setup script)

**Scenarios:**
| Scenario | Description |
|----------|-------------|
| `baseline` | Warm-up + single-user baseline |
| `burst` | Short spike of concurrent requests |
| `sustained` | Long-running steady load |
| `stress` | Maximum load until failure |

**Setup:**
```bash
cd packages/benchmarks
pnpm docker:up            # Start isolated benchmark environment
pnpm bench:sustained      # Run sustained benchmark
```

---

### 6. server → External Notifications

**Type:** HTTP outbound (via `reqwest`)
**Direction:** server → webhook/Slack/email
**Triggered by:** Alert rules when new issues, regressions, or unmutes occur

**Webhook payload:**
```json
{
  "alert_id": "unique-idempotency-key",
  "alert_type": "new_issue",
  "triggered_at": "2026-03-10T00:00:00Z",
  "project": { "id": 1, "name": "My App", "slug": "my-app" },
  "issue": {
    "id": "uuid",
    "title": "TypeError: Cannot read property...",
    "level": "error",
    "first_seen": "...",
    "last_seen": "...",
    "event_count": 15
  },
  "issue_url": "http://dashboard.example.com/projects/1/issues/uuid/events/latest"
}
```

**HMAC signature** (optional, for webhook security):
```
X-Rustrak-Signature: sha256=<hmac-hex>
```

---

## Deployment Topologies

### Full Stack (Docker Compose)
```yaml
# docker-compose.yml
postgres  ←── server (8080) ←── ui (3000)
```

### Server-Only (Minimal)
```
server (8080) ← Sentry SDKs
     ↑
dashboard running locally or on Vercel
```

### Distributed
```
server (cloud VPS, ~50MB RAM)
  └── SQLite (embedded, no external service)

dashboard (Vercel free tier or local)
  └── RUSTRAK_API_URL=https://your-server.com
```

---

## Data Flow: Event Ingestion End-to-End

```
1. SDK sends:  POST /api/1/envelope/
               X-Sentry-Auth: Sentry sentry_key=<uuid>
               Content-Encoding: gzip
               [gzip-compressed envelope bytes]

2. Server ingest phase (<50ms):
   Rate limit check
   → Auth: validate sentry_key vs projects table
   → Decompress (gzip/deflate/brotli)
   → Parse envelope (stream, no full load)
   → Validate event_id, required fields
   → Write to INGEST_DIR temp file
   → Respond: 200 {"id": "<event_id>"}

3. Server digest phase (async, 100-500ms):
   → Read temp file
   → Calculate grouping key
   → SHA256 hash → lookup groupings table
   → Advisory lock per project (pg only)
   → Create/update issue + grouping
   → Store event (full JSONB)
   → Update quota counters
   → Delete temp file
   → Dispatch alert rules (async)

4. Alert dispatch:
   → Check alert_rules for project
   → Evaluate conditions (new_issue, regression, unmute)
   → Check cooldown_minutes
   → Send to notification_channels (webhook/slack/email)
   → Record in alert_history
```
