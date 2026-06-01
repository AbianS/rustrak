# Development Guide

> Generated: 2026-03-10 | Scan level: deep

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Rust | stable (via rustup) | Server development |
| Node.js | ≥18 | Frontend/tooling |
| pnpm | 10.x | Package manager |
| Docker | Any recent | Local PostgreSQL, benchmarks |
| Git | Any | Version control |

**Install Rust:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup component add rustfmt clippy
```

**Install pnpm:**
```bash
npm install -g pnpm@10
```

---

## Initial Setup

```bash
# Clone repo
git clone https://github.com/rustrak/rustrak
cd rustrak

# Install Node.js dependencies
pnpm install

# Set up server environment
cp apps/server/.env.example apps/server/.env  # if exists, or create manually
```

**Minimum `.env` for server (apps/server/.env):**
```bash
DATABASE_URL=sqlite:rustrak.db           # SQLite (default, no setup required)
# Or for PostgreSQL:
# DATABASE_URL=postgres://user:pass@localhost:5432/rustrak
HOST=0.0.0.0
PORT=8080
RUST_LOG=info
INGEST_DIR=/tmp/rustrak/ingest
```

**For the webview-ui (.env.local in apps/webview-ui/):**
```bash
RUSTRAK_API_URL=http://localhost:8080
```

---

## Running the Project

### Start everything (Turborepo)
```bash
# Start all dev servers in parallel
pnpm dev

# Start specific parts
pnpm dev --filter=webview-ui
pnpm dev --filter=docs
```

### Start server (Rust)
```bash
cd apps/server

# First run: create admin user + run migrations
CREATE_SUPERUSER="admin@example.com:password123" cargo run

# Subsequent runs
cargo run

# Release mode
cargo run --release
```

### Start webview-ui (Next.js dashboard)
```bash
cd apps/webview-ui
pnpm dev       # http://localhost:3000
```

### Start docs site (Nextra)
```bash
cd apps/docs
pnpm dev       # http://localhost:3001
```

### Start with Docker (PostgreSQL stack)
```bash
# Development stack
docker-compose -f docker-compose.dev.yml up -d

# Production stack (uses pre-built images)
docker-compose up -d
```

---

## Testing

### Run all tests
```bash
pnpm test        # Turborepo runs all workspace tests
```

### Server tests (Rust)
```bash
cd apps/server
cargo test                         # all tests
cargo test -- --nocapture          # with stdout
cargo test integration             # only integration tests
RUST_LOG=debug cargo test          # with debug logging
```

The server tests use `testcontainers` — they spin up a real PostgreSQL container automatically.

### Client tests (TypeScript)
```bash
cd packages/client
pnpm test                          # run once
pnpm test:watch                    # watch mode
pnpm test:coverage                 # coverage report (target: 97%+)
```

### Send test events
```bash
# First, get your project's DSN from the dashboard
# Then use test-sentry CLI:
cd packages/test-sentry
pnpm start --dsn http://<sentry_key>@localhost:8080/1 --all
pnpm start --dsn <dsn> --error     # single error
pnpm start --dsn <dsn> --flood     # rate limit test
```

---

## Building

### Build everything
```bash
pnpm build       # Turborepo builds all in dependency order
```

### Server (Rust)
```bash
cd apps/server

# Debug build
cargo build

# Release build (optimized, ~15MB binary)
cargo build --release
# Binary: target/release/rustrak

# With PostgreSQL support
cargo build --release --features postgres --no-default-features

# Docker image
docker build -t rustrak-server apps/server/
docker build -t rustrak-server --build-arg FEATURES=postgres apps/server/
```

### Client package
```bash
cd packages/client
pnpm build       # outputs dist/index.js, dist/index.cjs, dist/index.d.ts
```

### Dashboard
```bash
cd apps/webview-ui
pnpm build       # Next.js production build
```

### Docs site
```bash
cd apps/docs
pnpm build       # Static export to apps/docs/out/
```

---

## Code Quality

### Linting and Formatting

**TypeScript (Biome — all workspaces):**
```bash
pnpm lint            # Check all TypeScript
pnpm format          # Format all TypeScript
pnpm format:check    # Check formatting only (used in CI)
pnpm check-types     # TypeScript type checking
```

**Rust:**
```bash
cd apps/server
cargo fmt                     # Format
cargo fmt -- --check          # Check formatting (CI)
cargo clippy                  # Lint
cargo clippy -- -D warnings   # Fail on warnings (CI)
```

### Dead Code Detection (webview-ui)
```bash
cd apps/webview-ui
pnpm knip    # Reports unused exports and files
```

---

## Database Migrations

Migrations are managed by SQLx and run automatically on server startup.

```bash
# Install sqlx-cli
cargo install sqlx-cli --no-default-features --features rustls,sqlite,postgres

# Create new migration (SQLite)
sqlx migrate add --source migrations/sqlite <migration_name>

# Create new migration (PostgreSQL)
sqlx migrate add --source migrations/postgres <migration_name>

# Run migrations manually (SQLite)
sqlx migrate run --source migrations/sqlite --database-url sqlite:rustrak.db

# Revert last migration
sqlx migrate revert --source migrations/sqlite --database-url sqlite:rustrak.db
```

> Both `migrations/sqlite/` and `migrations/postgres/` must be kept in sync for equivalent features.

---

## Benchmarks

```bash
cd packages/benchmarks

# Start isolated benchmark environment
pnpm docker:up

# Run scenarios
pnpm bench:baseline     # Warm-up
pnpm bench:burst        # Short spike
pnpm bench:sustained    # Long steady load (default)
pnpm bench:stress       # Push to limits

# View results
ls results/

# Teardown
pnpm docker:down
```

---

## Common Development Tasks

### Add a new API endpoint to the server

1. Add route handler in `apps/server/src/routes/<resource>.rs`
2. Register in `apps/server/src/routes/mod.rs`
3. Add service method in `apps/server/src/services/<resource>.rs`
4. Add model/DTO in `apps/server/src/models/<resource>.rs`
5. Write tests in `apps/server/src/routes/<resource>.rs` (integration tests)
6. Add to `packages/client/src/resources/<resource>.ts`
7. Add Zod schema in `packages/client/src/schemas/<resource>.ts`
8. Update `apps/docs/content/reference/api.mdx`

### Add a new page to the dashboard

1. Create page at `apps/webview-ui/src/app/(main)/<route>/page.tsx`
2. Add Server Action if needed in `apps/webview-ui/src/actions/<resource>.ts`
3. Mark as `'use client'` only if interactive (forms, transitions)
4. Update navigation in `apps/webview-ui/src/app/(main)/header.tsx` if top-level
5. Update docs in `apps/docs/content/usage/<feature>.mdx`

### Update public documentation

1. Edit MDX files in `apps/docs/content/`
2. Test locally: `cd apps/docs && pnpm dev` → http://localhost:3001
3. Commit and push
4. Create changeset: `pnpm changeset`
5. Release will auto-deploy to GitHub Pages

---

## Environment Variables Reference

### Server (apps/server)

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8080` | Server port |
| `RUST_LOG` | `info` | Log level (trace/debug/info/warn/error) |
| `DATABASE_URL` | — | SQLite path or PostgreSQL URL |
| `DATABASE_MAX_CONNECTIONS` | `10` | Connection pool max |
| `DATABASE_MIN_CONNECTIONS` | `1` | Connection pool min |
| `SESSION_SECRET_KEY` | random | 64 hex chars (required in production with SSL) |
| `SSL_PROXY` | `false` | Set `true` when behind HTTPS proxy |
| `INGEST_DIR` | `/tmp/rustrak/ingest` | Temp directory for event buffering |
| `CREATE_SUPERUSER` | — | `email:password` to bootstrap admin user |
| `MAX_EVENTS_PER_MINUTE` | `1000` | Global rate limit |
| `MAX_EVENTS_PER_HOUR` | `10000` | Global rate limit |
| `MAX_EVENTS_PER_PROJECT_PER_MINUTE` | `500` | Per-project rate limit |
| `MAX_EVENTS_PER_PROJECT_PER_HOUR` | `5000` | Per-project rate limit |

### WebView UI (apps/webview-ui)

| Variable | Default | Description |
|----------|---------|-------------|
| `RUSTRAK_API_URL` | `http://localhost:8080` | Backend API base URL |

---

## Git Workflow

```bash
# Feature branch
git checkout -b feat/my-feature

# Make changes, then:
pnpm run ci   # Runs: test + build + lint + format:check

# Create changeset (for versioned packages)
pnpm changeset

# Commit
git add .
git commit -m "feat: add my feature"

# Push and open PR against main
git push origin feat/my-feature
```

**Commit message format:** `type: description`

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

---

## Project Structure Quick Reference

| What | Where |
|------|-------|
| Server entry point | `apps/server/src/main.rs` |
| Server routes | `apps/server/src/routes/` |
| Server services | `apps/server/src/services/` |
| DB migrations (SQLite) | `apps/server/migrations/sqlite/` |
| DB migrations (PG) | `apps/server/migrations/postgres/` |
| UI pages | `apps/webview-ui/src/app/` |
| UI API calls | `apps/webview-ui/src/actions/` |
| UI components | `apps/webview-ui/src/components/ui/` |
| Client SDK | `packages/client/src/` |
| Public docs | `apps/docs/content/` |
| Generated AI docs | `docs/` |
