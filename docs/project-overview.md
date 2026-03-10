# Project Overview — Rustrak

> Generated: 2026-03-10 | Scan level: deep

## Executive Summary

**Rustrak** is an ultra-lightweight, self-hosted error tracking system fully compatible with Sentry SDKs. The core differentiator is its minimal footprint: the server consumes ~50MB RAM idle and ships as a ~20MB Docker image, making it suitable for VPS deployments with limited resources.

Any application already using a Sentry SDK can switch to Rustrak by simply changing the DSN — no SDK code changes required.

---

## Key Characteristics

| Property | Value |
|----------|-------|
| **License** | GPL-3.0 |
| **Type** | Self-hosted, open source |
| **Sentry compatibility** | Full SDK protocol support |
| **Server RAM** | ~50MB idle, <200MB under load |
| **Ingestion latency** | <50ms P99 |
| **Docker image** | ~20MB (distroless) |
| **Database backends** | SQLite (default), PostgreSQL 16 |
| **Architecture** | Linux/amd64 + Linux/arm64 |

---

## Repository Structure

**Type:** Turborepo Monorepo (pnpm workspaces)

```
rustrak/
├── apps/server          ← Rust API server (PRIMARY)
├── apps/webview-ui      ← Next.js dashboard
├── apps/docs            ← Nextra documentation site (GitHub Pages)
├── packages/client      ← @rustrak/client TypeScript SDK
├── packages/test-sentry ← CLI for sending test events
└── packages/benchmarks  ← Rust performance benchmark suite
```

---

## Tech Stack Summary

| Part | Language | Framework | Version |
|------|----------|-----------|---------|
| Server | Rust | Actix-web | 4.12 |
| Dashboard | TypeScript | Next.js | 16.1 |
| Docs | TypeScript | Nextra | 4.6 |
| Client SDK | TypeScript | — | 5.9 |
| Test CLI | TypeScript | tsup/tsx | — |
| Benchmarks | Rust | reqwest + clap | — |

**Shared tooling:** Turborepo 2, pnpm 10, Biome (TS linting), Changesets (versioning)

---

## Architecture Overview

```
External App
(any language)
    │
    │  Sentry SDK
    │  (DSN = http://<key>@server/<project_id>)
    ▼
┌─────────────────────────────────────────┐
│          Rustrak Server                  │
│          Rust / Actix-web 4             │
│                                         │
│  ┌─────────────┐   ┌─────────────────┐  │
│  │  Ingest     │   │   REST API      │  │
│  │  (<50ms)    │   │  (projects,     │  │
│  │  envelope   │   │   issues,       │  │
│  │  parsing    │   │   events,       │  │
│  └──────┬──────┘   │   tokens,       │  │
│         │ async    │   alerts)       │  │
│  ┌──────▼──────┐   └────────┬────────┘  │
│  │   Digest    │            │           │
│  │  (grouping) │            │           │
│  └──────┬──────┘            │           │
└─────────┼───────────────────┼───────────┘
          │                   │
          ▼                   ▼
   SQLite / PostgreSQL    @rustrak/client
                               │
                         ┌─────▼──────┐
                         │ webview-ui │
                         │  (Next.js) │
                         └────────────┘
                               │
                         GitHub Pages
                         ┌─────▼──────┐
                         │    docs    │
                         │  (Nextra)  │
                         └────────────┘
```

---

## Core Features

- **Error and exception tracking** — stack traces with code context
- **Issue grouping** — deterministic SHA256-based deduplication
- **Issue lifecycle** — open, resolved, muted, deleted states
- **User context & breadcrumbs** — full Sentry event payload preserved
- **Tags and custom data** — full metadata stored as JSONB
- **Rate limiting** — global + per-project, minute + hour windows
- **Alert notifications** — webhook, Slack, email with cooldown and retry
- **Cursor-based pagination** — efficient for large datasets
- **Two database backends** — SQLite (zero-ops) or PostgreSQL (production)
- **Multi-arch Docker** — `linux/amd64` + `linux/arm64`
- **REST API** — Bearer token or session auth for all management operations
- **TypeScript SDK** — `@rustrak/client` with Zod runtime validation

---

## What Rustrak Does NOT Support (by design)

- Performance monitoring (transactions, spans)
- Session tracking
- Release management + regression detection (on roadmap)
- Replay / attachments
- Per-event pricing / limits

See `docs/FUTURE_FEATURES.md` for the full deferred features list.

---

## Implementation Status

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Project setup, auth, projects API, tokens API | ✅ Complete |
| 2 | Event ingestion (envelope parsing, decompression, temp storage) | ✅ Complete |
| 3 | Event digest (grouping algorithm, issue creation, async processing) | ✅ Complete |
| 4 | Issues/Events API with cursor-based pagination | ✅ Complete |
| 5.1 | Rate limiting (global + per-project, minute + hour) | ✅ Complete |
| 6 | User authentication (session-based, Argon2id password hashing) | ✅ Complete |
| 7 | Alert notifications (webhook, Slack, email) | ✅ Complete |
| — | Data retention/cleanup | 🔲 Pending |
| — | Session tracking | 🔲 Pending |
| — | Performance monitoring | 🔲 Pending |
| — | Email verification + password reset | 🔲 Pending |

---

## Getting Started

**5-minute quickstart (SQLite, no external dependencies):**

```bash
docker run -d \
  --name rustrak \
  -p 8080:8080 \
  -v rustrak-data:/data \
  -e DATABASE_URL=sqlite:/data/rustrak.db \
  -e SESSION_SECRET_KEY=$(openssl rand -hex 32) \
  -e CREATE_SUPERUSER=admin@example.com:yourpassword \
  abians7/rustrak-server:latest
```

Then configure your app's Sentry SDK with:
```
http://<project_sentry_key>@localhost:8080/<project_id>
```

See [full documentation](https://abians.github.io/rustrak) for more.
