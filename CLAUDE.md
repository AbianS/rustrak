# Rustrak

Self-hosted error tracking, compatible with Sentry SDKs. A Rust API server with
a small memory footprint, and an optional Next.js dashboard that can be deployed
separately or not at all.

```
Sentry SDK  ──▶  Rustrak server  ──▶  PostgreSQL
(any app)        (Rust/Actix-web)
                       ▲
                       │
                 Rustrak dashboard (optional)
```

The split is the point: deploy only the server and connect any Sentry SDK to it.

## Layout

| Path | What |
|---|---|
| `apps/server` | Rust API server. The product. |
| `apps/webview-ui` | Next.js dashboard |
| `apps/docs` | Public documentation site (Nextra) |
| `packages/client` | `@rustrak/client`, the TypeScript API client |
| `packages/mcp` | `@rustrak/mcp`, MCP server over the client |
| `packages/test-sentry` | CLI to send test events to a DSN |
| `packages/benchmarks` | Load and throughput benchmarks |

Each app and package has its own `CLAUDE.md` with its architecture and rules.
Read that one before working inside it.

## Commands

```bash
docker compose up -d postgres     # database
cd apps/server && cargo run       # server on :8000
pnpm dev                          # dashboard and docs

pnpm test                         # everything except the Rust side
(cd apps/server && cargo test)    # unit, integration and e2e
pnpm run ci                       # what CI runs: test, build, lint, types
```

First run needs a superuser and a session key:

```bash
openssl rand -hex 32              # put in .env as SESSION_SECRET_KEY
CREATE_SUPERUSER="admin@example.com:password" cargo run
```

## Conventions

- Rust goes through `rustfmt` and `clippy`. TypeScript through Biome.
- Commit messages are conventional and in English: `type: description`.
- Tests come with the change, not after it.

## Versioning

`@rustrak/server`, `webview-ui`, `@rustrak/client` and `@rustrak/mcp` are a
`fixed` group in `.changeset/config.json`. They always share one number, even
when a package has no changes, because that number identifies the **Rustrak
release** rather than the semver of any single artifact. It is what lets someone
answer "which version am I running?" and makes `@rustrak/client@X.Y.Z`
known-compatible with server `X.Y.Z` without a compatibility matrix.

- A changeset only needs to name `@rustrak/server`; the group propagates it.
- The group takes the highest bump present.
- **While on `0.x`, never write a `major` changeset.** Use `minor` for breaking
  changes. A `major` would push the product to 1.0.0 as a side effect.
- `apps/docs` sits outside the group and bumps only when a changeset names it.
- `scripts/sync-version.sh` copies the version into `Cargo.toml` afterwards.
