# Rustrak Server

The Rust API server. Actix-web 4, SQLx against PostgreSQL, Tokio for background
work. Root context: `/CLAUDE.md`.

## Layout

```
src/
├── main.rs, lib.rs, bootstrap.rs   entry, wiring, startup (superuser, migrations)
├── config.rs, logging.rs           env config and env_logger setup
├── error.rs                        AppError, built on thiserror
├── openapi.rs                      utoipa spec; bin/gen_openapi.rs writes it out
├── routes/                         HTTP handlers, one module per resource
├── services/                       business logic the handlers call
├── models/                         domain types and their SQLx mappings
├── db/                             pool, queries and migrations
├── ingest/                         Sentry envelope parsing and temp storage
├── digest/                         grouping and issue creation, off the hot path
├── workers/                        Tokio background tasks
├── auth/                           the three extractors
├── middleware/                     rate limiting, auth enforcement, tracing
└── pagination/                     cursor and offset helpers
```

## It also serves the dashboard

`routes/dashboard.rs` mounts `apps/dashboard`'s compiled bundle at `/` when a
build is present in `RUSTRAK_DASHBOARD_DIR` (default `./static`), so the
browser and the API share one origin: the session cookie stays first-party and
CORS never enters the dashboard's path.

It stays optional. No `index.html` there means nothing is mounted and the
server is exactly the API it was before -- which is the premise of the product,
not a fallback.

Two rules it exists to keep, both covered by
`tests/integration/dashboard_test.rs`:

- A path the API does not own falls back to the application shell, because
  `/projects/42` is a real page only the router knows about.
- A path the API *does* own never does. `API_PREFIXES` is that list, and an
  unclaimed path under it stays a JSON 404 -- otherwise a mistyped endpoint
  answers `200 text/html` and the client reports a failure against itself.

`RequireAuth` reads the same list: with the dashboard mounted, everything
outside it is public static files.

## Ingestion is two-phase

1. **Ingest**, synchronous, target under 50ms: parse the envelope, validate,
   store raw, return 200. The SDK is never made to wait on grouping.
2. **Digest**, asynchronous: compute the fingerprint, create or update the
   Issue, store the event.

Events group by custom fingerprint if the SDK sent one, otherwise by exception
type plus the first line of the message plus transaction, with a message-based
and then a generic fallback. The algorithm is deterministic: same input, same
group, always.

## Three ways to authenticate

| Method | Who | How |
|---|---|---|
| Session | humans on the dashboard | email + password, Argon2id, httpOnly cookie |
| Bearer token | API and scripts | 40-char hex against `auth_tokens` |
| Sentry auth | SDKs on ingest routes | the key embedded in the DSN |

They are separate on purpose, the same way GitHub separates sessions from PATs.
Session auth is better UX for people; token auth is the standard for machines.

DSN format: `http://<sentry_key>@<host>/<project_id>`.

## Tests

```bash
cargo test                       # all three suites
cargo test --test unit_tests
cargo test --test integration_tests
cargo test --test e2e_tests
```

`tests/unit` is pure logic, `tests/integration` hits the database, `tests/e2e`
drives real HTTP. Shared fixtures live in `tests/common`. Server changes are
written test-first.

## Conventions

- `rustfmt` and `clippy` both clean before a commit.
- Errors are `AppError` via `thiserror`, never `unwrap` on a request path.
- Async everywhere; nothing blocking inside a handler.
- Logging through `log`, configured with `RUST_LOG`.

Targets: under 100MB idle, under 50ms P99 on ingestion, and a distroless image
under 20MB.
