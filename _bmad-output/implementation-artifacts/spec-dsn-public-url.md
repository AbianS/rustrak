---
title: 'Fix DSN to use PUBLIC_URL instead of bind address'
type: 'bugfix'
created: '2026-05-21'
status: 'done'
baseline_commit: 'c7e9e27f116e6a6126fcc2fac3062712c1182dbe'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every project API response embeds the server's TCP bind address (`0.0.0.0:8080`) in the DSN field, making it unusable in any real deployment. Users copy the DSN and get `http://key@0.0.0.0:8080/2` instead of their actual domain.

**Approach:** Add a `PUBLIC_URL` env var to the server config (e.g., `https://api.myapp.com`). Use it in `build_base_url()` when set; fall back to `http://{HOST}:{PORT}` for local dev when unset.

## Boundaries & Constraints

**Always:**
- `PUBLIC_URL` must include the full scheme (`http://` or `https://`); the existing `dsn()` method already strips and reapplies the scheme correctly — pass the value as-is.
- Fallback when `PUBLIC_URL` is unset must be `http://{HOST}:{PORT}` (current behavior preserved for local dev).
- `docker-compose.yml` must forward `PUBLIC_URL` from the host environment to the server container.
- `.env.example` must document `PUBLIC_URL` with a comment and example value.

**Ask First:**
- If the team wants a different variable name (e.g., `BASE_URL`, `SERVER_URL`) — confirm before implementing.

**Never:**
- Do not change `Project::dsn()` in `models/project.rs` — it is correct.
- Do not add any frontend env var or change the UI code — the frontend just displays what the API returns.
- Do not store the DSN in the database — it stays computed on-the-fly.
- Do not make `PUBLIC_URL` required (mandatory) — it must stay optional with a fallback.
- Do not write production code before a failing test exists (TDD — Iron Law).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PUBLIC_URL set, https | `PUBLIC_URL=https://api.example.com` | DSN: `https://key@api.example.com/2` | N/A |
| PUBLIC_URL set, http | `PUBLIC_URL=http://192.168.1.10:9090` | DSN: `http://key@192.168.1.10:9090/2` | N/A |
| PUBLIC_URL unset (local dev) | `HOST=0.0.0.0`, `PORT=8080` | DSN: `http://key@0.0.0.0:8080/2` (unchanged fallback) | N/A |
| PUBLIC_URL empty string | `PUBLIC_URL=` | Treat as unset → use fallback | N/A |
| PUBLIC_URL with trailing slash | `PUBLIC_URL=https://api.example.com/` | DSN must NOT double-slash: `https://key@api.example.com/2` | Strip trailing slash |

</frozen-after-approval>

## Code Map

- `apps/server/src/config.rs:6-63` -- `Config` struct + `from_env()` — add `public_url: Option<String>` field
- `apps/server/src/routes/projects.rs:165-168` -- `build_base_url()` (private fn) — only function that needs logic change
- `apps/server/tests/unit/config_test.rs` -- existing unit test file for config (serial env var tests)
- `apps/server/src/models/project.rs:58-87` -- `Project::dsn()` — no logic change, add inline `#[cfg(test)]` tests
- `docker-compose.yml:17-31` -- server service environment block — add `PUBLIC_URL` passthrough
- `apps/server/.env.example` -- env var documentation for operators
- `apps/server/CLAUDE.md` -- Configuration section with env vars table

## Tasks & Acceptance

**TDD order: write each failing test first, verify RED, then implement to GREEN.**

**Tests (write BEFORE production code):**
- [x] `apps/server/tests/unit/config_test.rs` -- Add 4 `#[serial]` tests for `Config::public_url`: (1) `None` when env var unset, (2) `Some(url)` when set, (3) trailing slash stripped, (4) empty string treated as `None` — verify each fails before implementing
- [x] `apps/server/src/models/project.rs` -- Add `#[cfg(test)]` module with 3 tests for `Project::dsn()`: (1) `base_url` with `https://` prefix → DSN uses https scheme, (2) `base_url` with `http://` → http scheme, (3) `base_url` without scheme (`0.0.0.0:8080`) → defaults to http — verify each fails (or that coverage was missing) before proceeding
- [x] `apps/server/src/routes/projects.rs` -- Add `#[cfg(test)]` module with 2 tests for private `build_base_url()`: (1) `Config` with `public_url = Some(...)` → returns that value, (2) `Config` with `public_url = None` → returns `http://host:port` — verify RED before implementing

**Implementation (only after tests are RED):**
- [x] `apps/server/src/config.rs` -- Add `public_url: Option<String>` to `Config` struct; in `from_env()` load `PUBLIC_URL`, filter empty strings, strip trailing `/`
- [x] `apps/server/src/routes/projects.rs` -- Rewrite `build_base_url()` to use `config.public_url` with fallback to `format!("http://{}:{}", config.host, config.port)`
- [x] `docker-compose.yml` -- Add `- PUBLIC_URL=${PUBLIC_URL}` to server service `environment` block
- [x] `apps/server/.env.example` -- Add commented `PUBLIC_URL=https://api.yourdomain.com` with explanation
- [x] `apps/server/CLAUDE.md` -- Add `PUBLIC_URL` to the Configuration env vars section with description and example

**Acceptance Criteria:**
- Given `PUBLIC_URL=https://api.example.com`, when `GET /api/projects` is called, then all projects in the response have `dsn` starting with `https://` and containing `api.example.com`
- Given `PUBLIC_URL` is unset, when `GET /api/projects` is called, then `dsn` contains `http://0.0.0.0:8080/` (current behavior preserved)
- Given `PUBLIC_URL=https://api.example.com/` (trailing slash), when DSN is built, then the DSN does not contain `//2` at the end
- Given a fresh `docker-compose.yml` deployment with `PUBLIC_URL` in the host `.env`, when the server starts, then the env var is available inside the container
- All 9 new tests pass (`cargo test`) and were observed RED before implementation

## Design Notes

The `dsn()` method in `models/project.rs` already handles scheme detection correctly by checking `base_url.starts_with("https")` — so passing `https://api.example.com` as `PUBLIC_URL` will correctly produce `https://...` DSNs without any changes to that method.

The trailing-slash strip must happen at load time in `Config::from_env()`, not in `build_base_url()`, so the value is normalized once.

```rust
// In Config::from_env():
public_url: env::var("PUBLIC_URL")
    .ok()
    .filter(|s| !s.is_empty())
    .map(|s| s.trim_end_matches('/').to_string()),
```

## Verification

**Commands:**
- `cd apps/server && cargo build` -- expected: compiles with no errors
- `cd apps/server && cargo clippy` -- expected: no warnings
- `cd apps/server && cargo test config` -- expected: all config tests pass including the 4 new PUBLIC_URL tests
- `cd apps/server && cargo test dsn` -- expected: all dsn tests pass including the 3 new Project::dsn() tests
- `cd apps/server && cargo test build_base_url` -- expected: 2 new build_base_url tests pass
- `cd apps/server && cargo test` -- expected: full suite passes with no regressions

## Suggested Review Order

**Core fix**

- Single-line rewrite: returns `public_url` when set, falls back to `http://host:port`
  [`projects.rs:165`](../../apps/server/src/routes/projects.rs#L165)

**Config**

- New `public_url` field with doc comment explaining semantics and fallback
  [`config.rs:10`](../../apps/server/src/config.rs#L10)

- Load from env: empty-string filter, whitespace trim, trailing-slash strip
  [`config.rs:66`](../../apps/server/src/config.rs#L66)

**Tests**

- 4 serial config tests: None-when-unset, set, trailing-slash, empty-string, with DATABASE_URL save/restore
  [`config_test.rs:107`](../../apps/server/tests/unit/config_test.rs#L107)

- 2 inline tests for private `build_base_url()` via `#[cfg(test)]` in same file
  [`projects.rs:185`](../../apps/server/src/routes/projects.rs#L185)

- 3 inline tests documenting `Project::dsn()` behavior (already correct, now covered)
  [`project.rs:89`](../../apps/server/src/models/project.rs#L89)

**Patch: e2e struct fix**

- Missing `public_url: None` in e2e fixture — prevented full suite from compiling
  [`sentry_sdk_test.rs:46`](../../apps/server/tests/e2e/sentry_sdk_test.rs#L46)

**Deployment & docs**

- `PUBLIC_URL=${PUBLIC_URL:-}` — explicit empty default, safe when var not set in host env
  [`docker-compose.yml:28`](../../docker-compose.yml#L28)

- Operator-facing documentation for the new env var
  [`.env.example:31`](../../apps/server/.env.example#L31)
