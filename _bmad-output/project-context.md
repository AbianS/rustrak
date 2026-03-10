---
project_name: 'rustrak'
user_name: 'Abian'
date: '2026-03-10'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 52
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Monorepo
- Package manager: pnpm 10.28.0
- Build system: Turborepo 2.8.10
- Node.js: >=18 required

### Server (apps/server)
- Language: Rust 2021 edition
- Web framework: actix-web 4.12.1 (with cookies feature)
- Async runtime: tokio 1.49.0 (full features)
- Database ORM: sqlx 0.8 (runtime-tokio, tls-rustls, uuid, chrono, migrate)
- Session: actix-session 0.10 (cookie-session)
- Password hashing: argon2 0.5 (Argon2id)
- Error handling: thiserror 2.0.18
- Serialization: serde 1.0.228 + serde_json 1.0.149
- Hashing (grouping): sha2 0.10.9
- HTTP client (notifications): reqwest 0.13 (rustls, json)
- Database features: sqlite (default) OR postgres (feature flag)

### Frontend (apps/webview-ui)
- Framework: Next.js 16.1.6 (App Router)
- Language: TypeScript 5.9.3 (strict)
- Styling: Tailwind CSS 4.1 + @tailwindcss/postcss 4.2.1
- UI: Radix UI primitives + shadcn/ui pattern
- Theme: next-themes 0.4.6
- Forms: react-hook-form 7.71.2 + @hookform/resolvers 5.2.2
- Validation: zod 4.3.6
- Icons: lucide-react 0.575.0
- Notifications: sonner 2.0.7
- Date: date-fns 4.1.0
- API client: @rustrak/client (workspace)

### Client Package (packages/client)
- Language: TypeScript 5.9.3 (strict, noUncheckedIndexedAccess)
- HTTP client: ky 1.14.3
- Validation: zod 4.3.6
- Build: tsup 8.5.1 (ESM + CJS + DTS)
- Tests: vitest 4.0.18 + msw 2.12.10

### Tooling
- Linter/Formatter: Biome 2.4.4 (replaces ESLint + Prettier)
- Changesets: @changesets/cli 2.29.8

---

## Critical Implementation Rules

### Language-Specific Rules

#### Rust (apps/server)
- Use `thiserror` for all custom error types via `AppError` — never use `Box<dyn Error>` or `anyhow` in handlers
- Prefer `async/await` over blocking calls; never block inside actix-web handlers
- Use `log` crate macros (`info!`, `warn!`, `error!`) with `env_logger` — not `println!`
- Load env vars via `dotenvy` at startup — never call `std::env::var` inline in handlers
- UUID fields must use `uuid::Uuid` with `serde` feature, not raw strings
- Timestamps must use `chrono::DateTime<Utc>` with serde feature — never `std::time`
- Feature flags: `sqlite` is default, `postgres` requires explicit `--features postgres`
- **DO NOT** set `panic = "abort"` in release profile — actix-web needs `catch_unwind` per request

#### TypeScript (all packages)
- Strict mode is mandatory everywhere (`"strict": true`)
- `noUncheckedIndexedAccess: true` in packages/client — always handle `T | undefined` from array indexing
- `noUnusedLocals` and `noUnusedParameters: true` in packages/client — no dead code
- Use Zod schemas as single source of truth — infer TypeScript types from schemas (`z.infer<typeof schema>`)
- Zod v4 API: use `z.object`, `z.string`, `z.number` — NOT deprecated v3 patterns
- Never use `any` explicitly — `unknown` + type guards is preferred
- Import type: use regular imports (Biome `useImportType` is OFF, so no forced `import type`)

#### TypeScript Formatting (Biome 2.4.4)
- Single quotes for JS/TS strings (`quoteStyle: "single"`)
- Double quotes for JSX attributes (`jsxQuoteStyle: "double"`)
- Trailing commas everywhere (`trailingCommas: "all"`)
- Semicolons always (`semicolons: "always"`)
- 2-space indentation, LF line endings, 80 char line width
- File naming: **kebab-case** enforced by Biome (`useFilenamingConvention`)
  - Exception: Next.js special files (page.tsx, layout.tsx, loading.tsx, error.tsx, not-found.tsx)
  - Exception: Rust files use snake_case (enforced by rustfmt)

---

### Framework-Specific Rules

#### Actix-web (Server)
- Register routes via `web::scope` in `routes/mod.rs` — never configure routes in `main.rs`
- Use custom extractors (`BearerAuth`, `SentryAuth`) for authentication — never manually parse headers in handlers
- `AppError` implements `ResponseError` — return `Result<HttpResponse, AppError>` from all handlers
- Session auth exempt routes: `/auth/*`, `/api/sentry/*`, `/health` — enforced by `RequireAuth` middleware
- Advisory locks for sequential `digest_order`: always use `pg_advisory_xact_lock($project_id)` inside a transaction before reading MAX and inserting a new issue
- Rate limit check MUST happen in both ingest (sync) and digest (async) phases — not just one

#### Next.js 16.1 App Router (webview-ui)
- Server Components by default — only add `'use client'` when you need hooks or browser APIs
- All API calls go through Server Actions in `src/actions/` — never call the API directly from Client Components
- Server Actions must start with `'use server'` directive
- Protected routes via `(main)/layout.tsx` — auth check with `getCurrentUser()` redirect pattern
- Use `useTransition` + `router.refresh()` for mutation feedback in Client Components — not SWR or useState for server data
- API client created per-request via `createClient()` in `src/lib/rustrak.ts` — it reads cookies from headers
- Environment variable for API: `RUSTRAK_API_URL` (server-side only, no `NEXT_PUBLIC_` prefix)
- Theme: ThemeProvider wraps root layout with `attribute="class"`, `defaultTheme="dark"`

#### @rustrak/client Package
- Resource pattern: extend `BaseResource` for every new API resource
- Always validate responses with `this.validate(data, schema)` — never trust raw API responses
- Error hierarchy must be followed: use specific error classes (`RateLimitError`, `NotFoundError`, etc.) — never throw generic `Error`
- ky instance is shared via constructor injection — never create a new ky instance per method
- Pagination: all list methods must return `PaginatedResponse<T>` with `items`, `next_cursor`, `has_more`
- Dual output: tsup builds both ESM (`index.js`) and CJS (`index.cjs`) — keep exports compatible with both

---

### Testing Rules

#### Rust (apps/server)
- Use `rstest` for parameterized tests and fixtures
- Use `serial_test` for tests that share state (DB, env vars)
- Integration tests use `testcontainers` with real PostgreSQL — never mock the DB layer
- E2E tests use the real `sentry` SDK (v0.46.1 with `test` feature)
- Use `pretty_assertions` for diff-friendly assertion failures
- Test files live alongside source in `src/` or in `tests/` at crate root

#### TypeScript (packages/client)
- Test structure: `tests/unit/` for schemas/errors, `tests/integration/` for resource behavior
- All HTTP mocked via MSW (Mock Service Worker) — never use `jest.mock` or `vi.mock` for HTTP
- MSW handlers defined in `tests/mocks/handlers.ts` — add new endpoints there
- Setup file: `tests/setup.ts` initializes MSW server (beforeAll/afterEach/afterAll)
- Coverage target: 97%+ — run `pnpm test:coverage` to verify before PR
- Tests excluded from `tsconfig.json` — they run under vitest's own resolution

#### General
- Unit tests: isolated logic, no I/O, no network
- Integration tests: test full request/response cycle with mocked dependencies
- Never test implementation details — test behavior and contracts
- Test file naming: `*.test.ts` (client), `*_test.rs` or inline `#[cfg(test)]` (Rust)

---

### Code Quality & Style Rules

#### Linting & Formatting (Biome 2.4.4)
- Biome replaces both ESLint and Prettier — never add ESLint or Prettier configs
- Run `pnpm lint` and `pnpm format` via Turborepo — not biome directly
- `noUnusedImports` is a warning (not error) — but clean them up anyway
- `noExplicitAny` is OFF — but avoid `any` by convention
- `useFilenamingConvention` is ERROR-level: all new files must be kebab-case

#### Rust Code Style
- Format with `rustfmt` — run `cargo fmt` before committing
- Lint with `clippy` — run `cargo clippy` and fix all warnings
- Group imports: std → external crates → internal modules
- Prefer `impl Trait` in function args over generic bounds when single-use
- Keep handlers thin — business logic in `services/`, not in `routes/`
- Models in `models/` are pure data structs — no business logic

#### Code Organization
- Server: thin routes → services → DB queries pattern
- Client: schemas → types (inferred) → resources → client assembly
- UI: Server Components fetch data → pass to Client Components for interactivity
- Shared UI components in `src/components/ui/` follow shadcn/ui pattern (copy-paste, not npm install)
- Utility functions in `src/lib/utils.ts` — use `cn()` helper for classname merging (clsx + tailwind-merge)

#### Documentation
- Public Rust APIs: doc comments (`///`) required
- TypeScript: no JSDoc unless genuinely complex — types are the documentation
- No inline comments explaining what the code does — only why (non-obvious intent)

---

### Development Workflow Rules

#### Git & Commits
- Commit message format: `type: description` (conventional commits)
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Branch naming: `feat/`, `fix/`, `docs/` prefixes (e.g. `feat/bmad`)
- Never commit directly to `main` — use PRs

#### Versioning & Releases
- Versioning managed via Changesets (`@changesets/cli 2.29.8`)
- Add a changeset with `pnpm changeset` when making user-facing changes
- Release flow: `pnpm version-packages` → `pnpm release`

#### Local Development
- Start DB: `docker-compose up -d postgres`
- Server: `cd apps/server && cargo run`
- Full stack: `docker-compose up --build`
- Frontend: `pnpm dev` (from repo root via Turborepo)

#### Environment Variables
- Server requires: `DATABASE_URL`, `SESSION_SECRET_KEY` (prod), `RUST_LOG`
- Frontend requires: `RUSTRAK_API_URL` (server-side only)
- Bootstrap admin: `CREATE_SUPERUSER="email:password" cargo run` (only if DB is empty)
- Never commit `.env` files — use `.env.example` as reference

#### Database Migrations
- SQLx migrations in `apps/server/migrations/` — numbered with timestamp prefix
- Format: `YYYYMMDDHHMMSS_description.up.sql`
- Run automatically on server startup via SQLx migrate
- Never modify existing migration files — always create new ones

#### CI Pipeline
- `pnpm ci` runs: `turbo run test build lint format:check`
- All checks must pass before merge
- Type checking: `pnpm check-types` (separate from lint)

---

### Critical Don't-Miss Rules

#### Rust Anti-Patterns
- **NEVER** set `panic = "abort"` in release profile — actix-web uses `catch_unwind` per request to isolate panics; aborting kills the entire server process
- **NEVER** use blocking I/O inside async handlers — use `tokio::task::spawn_blocking` if unavoidable
- **NEVER** skip advisory locks when creating issues — `pg_advisory_xact_lock(project_id)` is required to prevent duplicate `digest_order` values under concurrent load
- **NEVER** use `ipnetwork` crate — IPs are stored as `String` for SQLite/Postgres compatibility
- **NEVER** add rate limit check only in ingest — digest worker must also check quota (events may be queued while limit was fine, then exceeded)

#### TypeScript Anti-Patterns
- **NEVER** define TypeScript types manually when a Zod schema exists — always use `z.infer<typeof schema>`
- **NEVER** create a new ky instance inside a resource method — use the injected `this.http`
- **NEVER** call the Rustrak API directly from Next.js Client Components — always go through Server Actions in `src/actions/`
- **NEVER** use `NEXT_PUBLIC_` prefix for `RUSTRAK_API_URL` — it's server-side only and must never be exposed to the browser
- **NEVER** use `router.push()` after mutations without `router.refresh()` — stale Server Component data won't update

#### Security Rules
- Session cookies: `httpOnly`, `SameSite=Lax`, `Secure` (when `SSL_PROXY=true`)
- Passwords: Argon2id only — never MD5, SHA1, bcrypt, or plain storage
- API tokens: 40-char hex strings generated with `rand` crate — never use UUID for tokens
- `SESSION_SECRET_KEY` must be 64 hex chars generated with `openssl rand -hex 32`
- Sentry ingestion endpoints use `SentryAuth` extractor — never `BearerAuth`

#### Performance Gotchas
- `next_quota_check` field on projects/installation: skip expensive COUNT queries until this epoch is reached — always update it after quota changes
- Envelope parser streams line-by-line — never load the entire payload into memory at once
- Cursor-based pagination only — never use `OFFSET` pagination on issues/events tables
- `digest_order` uses advisory lock + `MAX(digest_order) + 1` per project — never use a global sequence

#### Sentry Protocol Edge Cases
- Envelope `length` field: if present read exact bytes; if absent read until newline — both modes must be supported
- Item types `session`, `transaction`, `attachment` must be silently ignored (not errored) — only `event` is processed
- `{{ default }}` in fingerprint array must be replaced with the calculated default grouping key, not kept as literal string
- Grouping key separator is ` ⋄ ` (U+22C4 diamond) — not pipe, dash, or colon

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code in this project
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-03-10
