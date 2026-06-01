# Source Tree Analysis

> Generated: 2026-03-10 | Scan level: deep

## Repository Overview

**Type:** Turborepo Monorepo
**Package Manager:** pnpm 10 with workspaces
**Build System:** Turborepo 2.x (parallel task execution)
**Code Quality:** Biome (linting + formatting for TypeScript), Clippy + rustfmt (Rust)

---

## Top-Level Structure

```
rustrak/                              # Monorepo root
├── apps/
│   ├── server/                       # ★ Rust API server (PRIMARY)
│   ├── webview-ui/                   # Next.js dashboard
│   └── docs/                         # Nextra documentation site
├── packages/
│   ├── client/                       # @rustrak/client TypeScript SDK
│   ├── test-sentry/                  # CLI tool for sending test events
│   └── benchmarks/                  # Rust performance benchmark suite
├── docs/                             # Generated AI documentation (this folder)
├── .github/workflows/                # CI/CD pipelines
├── docker-compose.yml                # Production deployment
├── docker-compose.dev.yml            # Development stack
├── turbo.json                        # Turborepo task graph
├── pnpm-workspace.yaml               # Workspace definitions
├── biome.json                        # TypeScript linting/formatting config
├── package.json                      # Root scripts + devDependencies
└── CLAUDE.md                         # AI context (root)
```

---

## apps/server — Rust API Server

```
apps/server/
├── CLAUDE.md                         # Detailed server context for AI
├── Cargo.toml                        # Dependencies (actix-web, sqlx, tokio...)
├── Dockerfile                        # Multi-stage build (distroless image ~20MB)
├── .dockerignore
├── migrations/
│   ├── postgres/                     # PostgreSQL migrations (up + down)
│   └── sqlite/                       # SQLite migrations (up + down)
└── src/
    ├── main.rs                       # ★ Entry point — server bootstrap
    ├── lib.rs                        # Library exports
    ├── config.rs                     # Env var config (RateLimitConfig, SecurityConfig)
    ├── error.rs                      # AppError enum → HTTP responses
    ├── bootstrap.rs                  # CREATE_SUPERUSER logic
    ├── auth/
    │   ├── mod.rs
    │   ├── token.rs                  # 40-char hex token generation
    │   ├── session.rs                # Session management (actix-session)
    │   ├── sentry_auth.rs            # X-Sentry-Auth header parser
    │   └── extractors.rs            # BearerAuth, SentryAuth, SessionUser extractors
    ├── db/
    │   └── mod.rs                    # SQLx connection pool + migration runner
    ├── middleware/
    │   ├── mod.rs
    │   └── auth.rs                   # RequireAuth middleware (exempts /auth/*, /health)
    ├── models/
    │   ├── mod.rs
    │   ├── project.rs                # Project struct + DTO
    │   ├── auth_token.rs             # AuthToken struct
    │   ├── user.rs                   # User struct + DTO
    │   ├── issue.rs                  # Issue struct + IssueResponse
    │   ├── event.rs                  # Event struct + EventDetail
    │   ├── grouping.rs               # Grouping struct
    │   ├── installation.rs           # Installation singleton (rate limiting)
    │   └── alert.rs                  # AlertRule, NotificationChannel, AlertHistory
    ├── pagination/
    │   ├── mod.rs
    │   └── cursor.rs                 # Keyset cursor (base64 encoded)
    ├── services/
    │   ├── mod.rs
    │   ├── project.rs                # ProjectService — CRUD
    │   ├── auth_token.rs             # AuthTokenService — CRUD
    │   ├── issue.rs                  # IssueService — paginated list + state update
    │   ├── event.rs                  # EventService — paginated list + detail
    │   ├── grouping.rs               # GroupingService + grouping key algorithm
    │   ├── rate_limit.rs             # RateLimitService — quota checks + updates
    │   └── alert.rs                  # AlertService — channels, rules, dispatch
    ├── ingest/                       # Phase 1: synchronous ingestion (<50ms)
    │   ├── mod.rs
    │   ├── envelope.rs               # Envelope + Item structs (Sentry protocol)
    │   ├── parser.rs                 # Stream envelope parser
    │   ├── decompression.rs          # gzip / deflate / brotli decompression
    │   └── storage.rs                # Temp file storage (INGEST_DIR)
    ├── digest/                       # Phase 2: async event processing
    │   ├── mod.rs
    │   └── worker.rs                 # Digest worker (grouping → issue → event store)
    └── routes/
        ├── mod.rs                    # Route registration
        ├── health.rs                 # GET /health, GET /health/ready
        ├── auth.rs                   # POST /auth/* (register, login, logout, me)
        ├── projects.rs               # CRUD /api/projects
        ├── tokens.rs                 # CRUD /api/tokens
        ├── issues.rs                 # CRUD + state /api/projects/{id}/issues
        ├── events.rs                 # Read-only /api/.../events
        ├── ingest.rs                 # POST /api/{project_id}/envelope/ (SentryAuth)
        └── alerts.rs                 # /api/alerts/channels + /api/projects/{id}/alerts
```

---

## apps/webview-ui — Next.js Dashboard

```
apps/webview-ui/
├── CLAUDE.md                         # Frontend context for AI
├── Dockerfile                        # Next.js production image
├── package.json                      # Next.js 16.1, Radix UI, shadcn/ui...
├── tsconfig.json                     # TypeScript strict config
├── components.json                   # shadcn/ui config
└── src/
    ├── app/                          # Next.js App Router
    │   ├── layout.tsx                # Root layout (ThemeProvider)
    │   ├── page.tsx                  # Root → redirect to /projects
    │   ├── globals.css               # Tailwind CSS + CSS variables
    │   ├── error.tsx                 # Root error boundary
    │   ├── auth/
    │   │   └── login/
    │   │       ├── page.tsx          # Login page (Server Component)
    │   │       └── login-form.tsx    # Login form (Client Component, react-hook-form)
    │   └── (main)/                   # Protected route group
    │       ├── layout.tsx            # ★ Auth guard + Header
    │       ├── header.tsx            # Navigation header
    │       ├── error.tsx             # Protected error boundary
    │       ├── projects/
    │       │   ├── page.tsx          # Projects list (Server Component)
    │       │   ├── projects-header.tsx  # Create project button
    │       │   ├── projects-list.tsx    # Project cards list
    │       │   └── [id]/
    │       │       ├── page.tsx      # Project detail + issues list
    │       │       ├── project-header.tsx
    │       │       ├── project-settings-dialog.tsx
    │       │       ├── project-alerts-dialog.tsx  # Alert rules management
    │       │       ├── issues-list.tsx
    │       │       └── issues/[issueId]/
    │       │           ├── page.tsx  # Issue detail → redirect to latest event
    │       │           ├── issue-actions.tsx  # Resolve/Mute/Delete
    │       │           └── events/
    │       │               ├── empty/page.tsx  # Empty state
    │       │               └── [eventId]/
    │       │                   ├── page.tsx    # Event detail (6 tabs)
    │       │                   ├── event-navigation.tsx
    │       │                   ├── stack-trace.tsx
    │       │                   ├── breadcrumbs.tsx
    │       │                   ├── event-details.tsx
    │       │                   ├── event-tags.tsx
    │       │                   ├── event-context.tsx
    │       │                   └── raw-json.tsx
    │       └── settings/
    │           ├── layout.tsx        # Settings sidebar layout
    │           ├── page.tsx          # Redirect to /settings/tokens
    │           ├── settings-nav.tsx
    │           ├── tokens/           # API token management
    │           ├── account/          # Account info (read-only)
    │           ├── appearance/       # Theme selector
    │           ├── alerts/           # Notification channels (global)
    │           └── about/            # Version info
    ├── actions/                      # Server Actions (all API calls go here)
    │   ├── auth.ts                   # login, logout, register, getCurrentUser
    │   ├── projects.ts               # CRUD operations
    │   ├── issues.ts                 # Issue management
    │   ├── events.ts                 # Event listing and detail
    │   ├── tokens.ts                 # API token management
    │   └── alerts.ts                 # Notification channels + alert rules
    ├── components/
    │   ├── theme-provider.tsx        # next-themes ThemeProvider wrapper
    │   ├── toaster.tsx               # Sonner toast notifications
    │   └── ui/                       # shadcn/ui components
    │       ├── button.tsx
    │       ├── card.tsx
    │       ├── dialog.tsx
    │       ├── alert-dialog.tsx
    │       ├── dropdown-menu.tsx
    │       ├── table.tsx
    │       ├── tabs.tsx
    │       ├── badge.tsx
    │       ├── checkbox.tsx
    │       ├── input.tsx
    │       ├── label.tsx
    │       ├── select.tsx
    │       ├── separator.tsx
    │       ├── switch.tsx
    │       ├── textarea.tsx (if present)
    │       ├── tooltip.tsx
    │       └── form.tsx
    └── lib/
        ├── rustrak.ts                # API client factory + cookie forwarding
        ├── event-schema.ts           # Zod schemas for Sentry event validation
        ├── constants.ts              # App-wide constants
        └── utils.ts                  # cn() helper for classnames
```

---

## apps/docs — Nextra Documentation Site

```
apps/docs/
├── package.json                      # Next.js 16.1 + Nextra 4.x
├── tsconfig.json
└── content/                          # ★ MDX documentation pages
    ├── index.mdx                     # Landing page (LandingPage component)
    ├── getting-started/
    │   ├── overview.mdx              # What is Rustrak, why use it
    │   ├── installation.mdx          # Docker + binary install instructions
    │   └── quickstart.mdx            # 5-minute quickstart guide
    ├── configuration/
    │   ├── environment.mdx           # All env variables reference
    │   ├── database.mdx              # SQLite vs PostgreSQL setup
    │   └── production.mdx            # Production hardening
    ├── usage/
    │   ├── projects.mdx              # Creating and managing projects
    │   ├── issues.mdx                # Working with issues
    │   ├── tokens.mdx                # API token management
    │   └── alerts.mdx                # Setting up notifications
    ├── reference/
    │   ├── api.mdx                   # API reference
    │   ├── architecture.mdx          # Architecture overview
    │   └── contributing.mdx          # Contribution guide
    └── troubleshooting/
        ├── common-issues.mdx         # Common problems and solutions
        └── faq.mdx                   # Frequently asked questions
```

**Deployment:** GitHub Pages (auto-deployed on `docs@X.Y.Z` tag via GitHub Actions)

---

## packages/client — TypeScript API Client

```
packages/client/
├── CLAUDE.md                         # Client context for AI
├── README.md                         # Usage documentation
├── package.json                      # @rustrak/client, ky + zod
├── tsconfig.json
├── tsup.config.ts                    # Builds ESM + CJS + DTS
├── vitest.config.ts
├── src/
│   ├── index.ts                      # ★ Public API exports
│   ├── client.ts                     # RustrakClient main class
│   ├── config.ts                     # ClientConfig interface
│   ├── types/                        # TypeScript types (inferred from Zod)
│   │   ├── common.ts                 # PaginatedResponse, SortOrder
│   │   ├── project.ts
│   │   ├── issue.ts
│   │   ├── event.ts
│   │   └── token.ts
│   ├── schemas/                      # ★ Zod schemas (source of truth)
│   │   ├── common.ts
│   │   ├── project.ts
│   │   ├── issue.ts
│   │   ├── event.ts
│   │   └── token.ts
│   ├── errors/                       # Custom error hierarchy
│   │   ├── base.ts                   # RustrakError
│   │   ├── http.ts                   # 401/403/404/429/500 errors
│   │   └── validation.ts             # ValidationError
│   ├── resources/                    # API resource classes
│   │   ├── base.ts                   # BaseResource + validate()
│   │   ├── projects.ts
│   │   ├── issues.ts
│   │   ├── events.ts
│   │   └── tokens.ts
│   └── utils/
│       └── http.ts                   # ky instance factory
├── tests/
│   ├── setup.ts                      # MSW server setup
│   ├── mocks/handlers.ts             # Request handlers
│   ├── unit/                         # 39 unit tests
│   └── integration/                  # 94 integration tests
└── dist/                             # Build output (gitignored)
    ├── index.js                      # ESM
    ├── index.cjs                     # CommonJS
    └── index.d.ts                    # Type declarations
```

---

## packages/test-sentry — Test CLI

```
packages/test-sentry/
├── README.md
├── package.json                      # @rustrak/test-sentry, @sentry/node
├── tsconfig.json
└── src/
    └── cli.ts                        # CLI entry point (tsx/tsup)
```

**Usage:**
```bash
pnpm test-sentry --dsn http://<key>@localhost:8080/1 --all
pnpm test-sentry --dsn <dsn> --error      # single exception
pnpm test-sentry --dsn <dsn> --flood      # rate limit testing
```

---

## packages/benchmarks — Performance Suite

```
packages/benchmarks/
├── README.md
├── Cargo.toml                        # reqwest, tokio, clap, hdrhistogram
├── docker-compose.benchmark.yml      # Isolated benchmark environment
├── scripts/
│   ├── setup-benchmark.sh
│   └── run-benchmark.sh
├── scenarios/                        # Benchmark scenario configs (TOML)
├── results/                          # Output JSON (gitignored)
└── src/
    └── main.rs                       # Benchmark runner (Rust CLI)
```

**Scenarios:** `baseline`, `burst`, `sustained`, `stress`

---

## CI/CD Pipelines

```
.github/workflows/
├── ci.yml                            # PR validation (test + build + lint)
├── docker-publish.yml                # Docker image builds on release tag
└── release.yml                       # Changesets-based release automation
```

**Release flow:**
1. Create changeset: `pnpm changeset`
2. Merge PR → auto-creates "Version Packages" PR
3. Merge version PR → creates GitHub release tags per package
4. Tags trigger Docker builds (`server@X.Y.Z` → Docker Hub)
5. `docs@X.Y.Z` tag → builds and deploys to GitHub Pages

**Docker images:**
- `rustrak/rustrak-server:latest` (SQLite, linux/amd64 + linux/arm64)
- `rustrak/rustrak-server:postgres` (PostgreSQL, linux/amd64 + linux/arm64)
- `rustrak/rustrak-ui:latest` (linux/amd64 + linux/arm64)
