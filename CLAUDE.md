# Rustrak - Error Tracking System

> **Context Architecture Note**: This is the **root context** file for the Rustrak project.
> For component-specific context, see:
> - Server (Rust backend): `apps/server/CLAUDE.md`
> - WebView UI (Next.js frontend): `apps/webview-ui/CLAUDE.md`
> - Client Package (TypeScript API client): `packages/client/CLAUDE.md`

## Project Vision

Rustrak is an ultra-lightweight, self-hosted error tracking system compatible with Sentry SDKs. The key differentiator is the separation of concerns:

- **Server (Rust/Actix-web)**: API-only backend, minimal memory footprint (~50-100MB)
- **Frontend (Next.js)**: Optional separate dashboard, can be self-hosted or use Vercel

This architecture allows users to deploy just the server for maximum efficiency, connecting it to any Sentry SDK.

## Architecture

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   Sentry SDK    │────▶│   Rustrak Server    │────▶│   PostgreSQL    │
│   (any app)     │     │   (Rust/Actix-web)  │     │                 │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
                                  │
                                  ▼
                        ┌─────────────────┐
                        │  Rustrak UI     │ (optional)
                        │  (Next.js)      │
                        └─────────────────┘
```

## Tech Stack

### Server (`apps/server`)
- **Language**: Rust (2021 edition)
- **Framework**: Actix-web 4.x
- **Database**: PostgreSQL 16 with SQLx
- **Async Runtime**: Tokio
- **Background Processing**: Tokio tasks (in-process)

### Client Package (`packages/client`)
- **Language**: TypeScript (strict mode), Node >= 20
- **HTTP Client**: ky 2 (~3KB)
- **Validation**: Zod 4 (~10KB, runtime type safety)
- **Build**: tsup (esbuild-based)
- **Testing**: Vitest + MSW (452 tests, 97% statement coverage)
- **Error handling**: no exceptions. Every method returns
  `Result<T, RustrakError>`, a plain-object discriminated union keyed on `kind`,
  which survives `structuredClone` and therefore React's server/client
  boundary. See `packages/client/CLAUDE.md`.

### Test Sentry Package (`packages/test-sentry`)
- **Language**: TypeScript 5.9
- **Purpose**: CLI tool to send test errors to Sentry-compatible endpoints
- **Usage**: `pnpm test-sentry --dsn <dsn> --all` or individual error types
- **Supports**: errors, warnings, logMessages, breadcrumbs, contexts, user, tags

### WebView UI (`apps/webview-ui`)
- **Framework**: Next.js 16.1 (App Router)
- **Language**: TypeScript 5.9
- **Styling**: Tailwind CSS 4.1
- **UI**: Radix UI + shadcn/ui patterns

## Directory Structure

```
rustrak/
├── CLAUDE.md              # This file - project culture
├── apps/
│   ├── server/            # Rust API server
│   │   ├── CLAUDE.md      # Server-specific context
│   │   ├── Cargo.toml
│   │   ├── Dockerfile
│   │   └── src/
│   └── webview-ui/        # Next.js dashboard
│       ├── CLAUDE.md      # UI-specific context
│       └── src/
├── packages/
│   └── client/            # TypeScript API client
│       ├── CLAUDE.md      # Client-specific context
│       ├── src/           # Client source code
│       ├── tests/         # Vitest + MSW tests (452 tests, 97% coverage)
│       └── dist/          # Build output (ESM + CJS + DTS)
├── docs/
│   ├── ingestion-flow.md  # Event ingestion documentation
│   ├── api-design.md      # API specification
│   ├── database-schema.md # DB schema documentation
│   └── ...
├── docker-compose.yml     # Local development setup
├── turbo.json             # Turborepo config
└── package.json           # Workspace root (pnpm)
```

## Key Concepts

### Sentry Compatibility
Rustrak accepts events from any Sentry SDK using the standard Sentry envelope protocol. The DSN format is:
```
http://<sentry_key>@<host>/<project_id>
```

### Two-Phase Ingestion
1. **Ingest (synchronous, <50ms)**: Parse, validate, store temporarily, return 200
2. **Digest (asynchronous)**: Calculate grouping, create/update issues, store event

### Issue Grouping
Events are grouped into Issues using a deterministic algorithm based on:
- Custom fingerprint (if provided by SDK)
- Exception type + first line of message + transaction
- Log message + transaction
- Fallback grouping

### Authentication Architecture

Rustrak uses **two separate authentication methods** for different use cases:

#### 1. Session Authentication (Web UI)
- **Method**: Email + password login with httpOnly cookies
- **Use case**: Human users accessing the web dashboard
- **Implementation**:
  - Argon2id password hashing (OWASP recommended)
  - actix-session middleware for session management
  - Server Components verify auth via `getCurrentUser()` helper
  - Client Components only for interactive forms
- **Flow**:
  1. User logs in at `/auth/login`
  2. Server creates httpOnly session cookie
  3. All subsequent requests include cookie automatically
  4. Server validates session on each request

#### 2. Token Authentication (SDK/API)
- **Method**: Bearer tokens (40-char hex strings)
- **Use case**: Sentry SDKs sending events, programmatic API access
- **Implementation**:
  - Tokens managed via `/settings/tokens` in web UI
  - Validated via `BearerAuth` extractor on API endpoints
  - SentryAuth extractor for SDK ingestion endpoints
- **Flow**:
  1. Create API token in web UI
  2. Include in SDK DSN or API request headers
  3. Server validates token against `auth_tokens` table

**Why Two Methods?**
- Session auth provides better UX for humans (no token management)
- Token auth is standard for SDK ingestion and API clients
- Separation follows industry best practices (Sentry, GitHub, etc.)

**Bootstrap Setup:**
```bash
# First-time setup: Create initial admin user
CREATE_SUPERUSER="admin@example.com:password123" cargo run

# Generate session secret (required)
openssl rand -hex 32
# Add to .env: SESSION_SECRET_KEY=<generated-key>
```

## Code Conventions

### Rust
- Use `rustfmt` for formatting
- Use `clippy` for linting
- Error handling with `thiserror` for custom errors (AppError)
- Prefer `async/await` over blocking code
- Use `log` crate with `env_logger` (RUST_LOG env var)

### Versioning

Rustrak uses **lockstep versioning for the shipped artifacts**. `@rustrak/server`, `webview-ui`, `@rustrak/client` and `@rustrak/mcp` form a `fixed` group in `.changeset/config.json`: they always share one version number and bump together, even when a package has no changes.

The number identifies the **Rustrak release**, not the semver of one artifact. This is what lets a user answer "which version of Rustrak am I running?" and lets `@rustrak/client@X.Y.Z` be known-compatible with server `X.Y.Z` without a compatibility matrix.

- A changeset only needs to name `@rustrak/server`; the group propagates the bump.
- The group takes the **highest** bump present.
- **While on `0.x`, never write a `major` changeset.** Use `minor` for breaking changes, per the 0.x convention. A `major` would push the product to 1.0.0 as a side effect.
- `@rustrak/test-sentry` and `@rustrak/benchmarks` are internal and excluded via `ignore`.
- `scripts/sync-version.sh` propagates the version from `apps/server/package.json` to `Cargo.toml` after `changeset version`.

**`docs` is versioned independently.** It sits outside the `fixed` group and only bumps when a changeset names `docs` explicitly. It is `private`, never published, and nothing reads its version: the docs site builds its version switcher from the frontmatter of `apps/docs/content/changelog/*.mdx`, not from `package.json`. Its number will therefore fall behind the product version, and that is expected: `release.yml` deliberately excludes `apps/docs` from the fixed-group alignment check.

The deploy follows the version. `deploy-docs.yml` publishes the site when the version in `apps/docs/package.json` changes on `main`, which is exactly when a version PR carrying a `docs` changeset merges. It also runs on `release: published`, so a new changelog entry reaches the site with a product release, and on `workflow_dispatch`. It deliberately does not deploy on every push to `main`: publishing is tied to a version someone chose to cut. And the changelog MDX files remain **product** changelogs (`v0.14.0`, ...), since `release.yml` matches them by product version to build the GitHub release body.

Post-1.0 the management API should get its own `api_version` in `/health/version`, which would allow decoupling the client from the product version if needed.

### General
- Commit messages: `type: description` (feat, fix, docs, refactor, test)
- Keep functions small and focused
- Document public APIs
- Write tests for critical paths

## Reference Documentation

The `/docs` directory contains technical documentation:

- `/docs/ingestion-flow.md` - Complete event flow documentation
- `/docs/api-design.md` - API endpoint specifications
- `/docs/database-schema.md` - PostgreSQL schema design
- `/docs/grouping-algorithm.md` - Issue grouping logic
- `/docs/FUTURE_FEATURES.md` - Features deferred for post-MVP

## Development Workflow

### Local Development
```bash
# Start PostgreSQL and server
docker-compose up -d postgres
cd apps/server && cargo run

# Or run everything with Docker
docker-compose up --build
```

### Testing
```bash
# Server (Rust) — subshell, so the commands below still run from the repo root
(cd apps/server && cargo test)

# Frontend (vitest + jsdom)
pnpm --filter=webview-ui test

# TypeScript client (vitest + MSW)
pnpm --filter=@rustrak/client test

# MCP server (vitest + InMemoryTransport)
pnpm --filter=@rustrak/mcp test

# Everything, the way CI runs it
pnpm run ci
```

### Building for Production
```bash
cd apps/server
cargo build --release
# Binary at target/release/rustrak
```

## Performance Goals

- **Memory**: <100MB idle, <200MB under load
- **Ingestion latency**: <50ms P99
- **Image size**: <20MB (distroless)
- **Throughput**: 10,000+ events/second

## Skills System

Rustrak uses the [Agent Skills](https://agentskills.io) standard for organizing AI-assisted development context. Skills are located in `.claude/skills/` and follow the SKILL.md format specification.

### Available Skills

**Generic Skills** (framework/language patterns):
- **rust-coder** - Idiomatic Rust patterns, data modeling, traits
- **rust-debugger** - Debugging Rust compile errors, borrow checker issues
- **typescript-strict** - Type-safe TypeScript patterns
- **vercel-react-best-practices** - Next.js performance optimization
- **web-design-guidelines** - UI/UX best practices

**Project-Specific Skills** (to be created as needed):
- **rustrak-server** - Rustrak server architecture, Sentry protocol, ingestion patterns

### Skill Usage

Skills are **automatically activated** when:
- Working in relevant scope (server → rust-* skills, webview-ui → typescript/react skills)
- Matching trigger conditions defined in skill frontmatter
- Explicitly requested by user

Each skill contains:
- **Trigger conditions** - When to activate
- **Scope** - Which parts of codebase it applies to
- **Instructions** - Step-by-step coding guidance
- **Examples** - One-shot learning patterns
- **References** - Detailed documentation (loaded on demand)

For more details on individual skills, see their respective SKILL.md files.
