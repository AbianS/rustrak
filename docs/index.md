# Rustrak — Project Documentation Index

> Generated: 2026-03-10 | Scan level: deep | workflow_version: 1.2.0
>
> **Primary entry point for AI-assisted development.**
> When implementing features, always reference this index and the relevant architecture docs.

---

## Project Overview

- **Type:** Turborepo Monorepo — 6 parts
- **Primary Language:** Rust (server), TypeScript (UI, client, tools)
- **Architecture:** Decoupled server + optional dashboard, Sentry SDK compatible
- **Repository:** https://github.com/AbianS/rustrak

### Quick Reference by Part

| Part | Root | Type | Tech |
|------|------|------|------|
| **server** | `apps/server/` | backend | Rust, Actix-web 4, SQLx, Tokio |
| **webview-ui** | `apps/webview-ui/` | web | Next.js 16.1, TypeScript, Tailwind, shadcn/ui |
| **docs** | `apps/docs/` | web | Next.js 16.1, Nextra 4, MDX, GitHub Pages |
| **client** | `packages/client/` | library | TypeScript, Zod, ky, Vitest+MSW |
| **test-sentry** | `packages/test-sentry/` | cli | TypeScript, @sentry/node |
| **benchmarks** | `packages/benchmarks/` | backend | Rust, reqwest, clap |

---

## Generated Documentation

### Project-Wide
- [Project Overview](./project-overview.md) — Executive summary, feature status, architecture diagram
- [Source Tree Analysis](./source-tree-analysis.md) — Annotated directory trees for all 6 parts
- [Integration Architecture](./integration-architecture.md) — How parts communicate, data flow end-to-end
- [Development Guide](./development-guide.md) — Setup, testing, building, common tasks
- [Deployment Guide](./deployment-guide.md) — Docker Compose, production checklist, release process

### Architecture per Part
- [Architecture — Server](./architecture-server.md) — Two-phase ingestion, auth, rate limiting, grouping, alerts
- [Architecture — WebView UI](./architecture-webview-ui.md) — RSC-first, Server Actions, auth flow, routes
- [Architecture — Docs](./architecture-docs.md) — Nextra setup, content structure, deployment to GitHub Pages
- [Architecture — Client](./architecture-client.md) — Schema-first (Zod), resource pattern, error hierarchy

### API & Data
- [API Contracts — Server](./api-contracts-server.md) — All REST endpoints with request/response schemas
- [Data Models — Server](./data-models-server.md) — Full database schema (SQLite + PostgreSQL), migration history

### Component Inventory
- [Component Inventory — WebView UI](./component-inventory-webview-ui.md) — shadcn/ui primitives + page components

---

## Existing Documentation

| Document | Description |
|----------|-------------|
| [README.md](../README.md) | Project introduction and quick start |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution guidelines, code style, PR process |
| [CLAUDE.md](../CLAUDE.md) | Root AI context: vision, tech stack, architecture overview |
| [apps/server/CLAUDE.md](../apps/server/CLAUDE.md) | Detailed server context: Sentry protocol, ingestion flow, DB schema, auth |
| [apps/webview-ui/CLAUDE.md](../apps/webview-ui/CLAUDE.md) | Dashboard context: routes, patterns, auth flow, component list |
| [packages/client/CLAUDE.md](../packages/client/CLAUDE.md) | Client SDK context: resource pattern, Zod schemas, error handling |
| [apps/server/CHANGELOG.md](../apps/server/CHANGELOG.md) | Server release history |
| [apps/webview-ui/CHANGELOG.md](../apps/webview-ui/CHANGELOG.md) | UI release history |
| [apps/docs/CHANGELOG.md](../apps/docs/CHANGELOG.md) | Docs release history |
| [packages/test-sentry/README.md](../packages/test-sentry/README.md) | Test CLI usage |
| [packages/benchmarks/README.md](../packages/benchmarks/README.md) | Benchmark setup and results |
| [packages/client/README.md](../packages/client/README.md) | Client SDK public documentation |

### Public Documentation Site (`apps/docs/content/`)

| Section | Files |
|---------|-------|
| Getting Started | overview.mdx, installation.mdx, quickstart.mdx |
| Configuration | environment.mdx, database.mdx, production.mdx |
| Usage | projects.mdx, issues.mdx, tokens.mdx, alerts.mdx |
| Reference | api.mdx, architecture.mdx, contributing.mdx |
| Troubleshooting | common-issues.mdx, faq.mdx |

> **Important:** Any user-facing feature change must be reflected in `apps/docs/content/`.

---

## Getting Started for AI Context

### Working on the server (Rust)
1. Read [Architecture — Server](./architecture-server.md)
2. Read [API Contracts — Server](./api-contracts-server.md)
3. Read [Data Models — Server](./data-models-server.md)
4. Read [Integration Architecture](./integration-architecture.md) for cross-part context
5. Reference: `apps/server/CLAUDE.md` for fine-grained patterns

### Working on the dashboard (Next.js)
1. Read [Architecture — WebView UI](./architecture-webview-ui.md)
2. Read [Component Inventory — WebView UI](./component-inventory-webview-ui.md)
3. Reference: `apps/webview-ui/CLAUDE.md` for component patterns

### Working on the public docs
1. Read [Architecture — Docs](./architecture-docs.md)
2. Edit files in `apps/docs/content/`
3. Reflect every user-facing feature change in the docs before shipping

### Working on the client SDK
1. Read [Architecture — Client](./architecture-client.md)
2. Reference: `packages/client/CLAUDE.md` for adding new resources

### Adding a full-stack feature
1. Read [Architecture — Server](./architecture-server.md) + [Architecture — WebView UI](./architecture-webview-ui.md)
2. Read [Integration Architecture](./integration-architecture.md)
3. Follow the development guide's "Add a new API endpoint" section in [Development Guide](./development-guide.md)
4. Update [apps/docs/content/](../apps/docs/content/) with user-facing changes

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Server language | Rust | Memory safety, minimal footprint (~50MB), speed |
| Database | SQLite (default) / PostgreSQL | SQLite for zero-ops; PG for production scale |
| Frontend | Next.js App Router | RSC for server-side data fetching, no client-side API calls |
| API calls (UI) | Server Actions only | Avoids exposing token to browser, cleaner auth forwarding |
| Validation | Zod (client SDK) | Runtime safety, single source of truth for types |
| Auth (SDK ingest) | Sentry key (UUID) | Full Sentry SDK compatibility without code changes |
| Auth (web) | Session cookies (httpOnly) | Standard web security, no token management for users |
| Event processing | Two-phase (sync ingest + async digest) | <50ms response to SDKs, correct grouping without blocking |
| Pagination | Cursor-based (keyset) | Efficient on large datasets, no offset drift |
| Alerting | Cooldown + retry queue | Prevents notification storms, resilient delivery |
