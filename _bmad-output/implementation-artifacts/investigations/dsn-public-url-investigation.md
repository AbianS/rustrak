# Investigation: DSN Public URL Bug

## Hand-off Brief

1. **What happened.** The DSN returned by every project API endpoint embeds `0.0.0.0:8080` (the server's bind address) instead of the real public URL because `build_base_url()` in `apps/server/src/routes/projects.rs:166` directly formats `config.host:config.port` — confirmed at source.
2. **Where the case stands.** Root cause confirmed. No `PUBLIC_URL` env var exists anywhere in server config. The `dsn()` method in `models/project.rs` is correct but receives wrong input.
3. **What's needed next.** Add `public_url: Option<String>` to `Config`, update `build_base_url()` to use it with fallback to `http://HOST:PORT`, update `docker-compose.yml` and `.env.example`.

## Case Info

| Field            | Value                                                             |
| ---------------- | ----------------------------------------------------------------- |
| Ticket           | N/A                                                               |
| Date opened      | 2026-05-21                                                        |
| Status           | Concluded                                                         |
| System           | Rust/Actix-web server + Next.js 16 frontend, Docker Compose prod  |
| Evidence sources | Source code (config.rs, routes/projects.rs, models/project.rs, docker-compose.yml) |

## Problem Statement

The DSN shown to users in the frontend always contains `0.0.0.0:8080` instead of the real public domain. Example: `http://0890471e6ad14e10951042b8aee694fe@0.0.0.0:8080/2`. This makes the DSN unusable for SDK configuration in any real deployment.

## Evidence Inventory

| Source                                          | Status    | Notes                                                  |
| ----------------------------------------------- | --------- | ------------------------------------------------------ |
| `apps/server/src/config.rs`                     | Available | HOST defaults to `"0.0.0.0"`, no PUBLIC_URL field      |
| `apps/server/src/routes/projects.rs:166-168`    | Available | `build_base_url()` confirmed root cause                |
| `apps/server/src/models/project.rs:60-71`       | Available | `dsn()` method correct; bug is upstream                |
| `apps/webview-ui/src/lib/rustrak.ts:33`         | Available | Frontend uses `RUSTRAK_API_URL` for API calls          |
| `docker-compose.yml`                            | Available | Server gets `HOST=0.0.0.0`, no PUBLIC_URL passed       |
| `apps/server/.env.example`                      | Available | No PUBLIC_URL documented                               |
| Tests for `build_base_url()` / `Project::dsn()` | Missing   | No unit tests for DSN construction in server           |

## Confirmed Findings

### Finding 1: build_base_url() uses bind address, not public URL

**Evidence:** `apps/server/src/routes/projects.rs:166-168`

```rust
fn build_base_url(config: &Config) -> String {
    format!("{}:{}", config.host, config.port)
}
```

**Detail:** `config.host` defaults to `"0.0.0.0"` (from `config.rs:53`). This is the TCP listen address, not a public hostname. All four project handlers (`list_projects`, `get_project`, `create_project`, `update_project`) call this function before building the response.

### Finding 2: Config struct has no public URL field

**Evidence:** `apps/server/src/config.rs:6-13`

**Detail:** `Config` has `host: String` and `port: u16`, both sourced from `HOST`/`PORT` env vars. No `PUBLIC_URL`, `BASE_URL`, or equivalent field exists.

### Finding 3: dsn() method is correct — bug is in its input

**Evidence:** `apps/server/src/models/project.rs:60-71`

**Detail:** `dsn(&self, base_url: &str)` correctly strips scheme and reconstructs the DSN format `{scheme}://{key}@{host}/{id}`. The scheme detection (`starts_with("https")`) works. The method just receives `"0.0.0.0:8080"` from `build_base_url()`, so scheme defaults to `http`.

### Finding 4: Frontend already has RUSTRAK_API_URL — server doesn't

**Evidence:** `apps/webview-ui/src/lib/rustrak.ts:33`, `docker-compose.yml:38`

**Detail:** The UI service receives `RUSTRAK_API_URL=${RUSTRAK_API_URL}` from docker-compose. The server service gets no equivalent. The value the user sets for `RUSTRAK_API_URL` (e.g., `http://api.myapp.com`) is the exact value that should also be used as the server's `PUBLIC_URL` for DSN generation.

### Finding 5: E2E tests build DSN independently — won't catch this regression

**Evidence:** `apps/server/tests/e2e/sentry_sdk_test.rs:122-127`

```rust
fn dsn(&self, sentry_key: &str, project_id: i32) -> String {
    format!("http://{}@127.0.0.1:{}/{}", sentry_key, self.port, project_id)
}
```

**Detail:** E2E tests construct their own DSN manually and never use `Project::dsn()` or `build_base_url()`. A bug in `build_base_url()` would not be caught by any existing test.

## Deduced Conclusions

### Deduction 1: Every production deployment is affected

**Based on:** Findings 1, 2, 4

**Reasoning:** The bug is unconditional — `build_base_url()` always returns `HOST:PORT`. There is no code path that produces a correct public DSN. Any user who deployed and looked at their project DSN saw `0.0.0.0:8080`.

### Deduction 2: No fix needed in models/project.rs or the frontend

**Based on:** Findings 3, 4

**Reasoning:** The DSN method and the frontend display are correct. The fix is entirely in the server config and the `build_base_url()` function.

## Source Code Trace

| Element       | Detail                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------- |
| Error origin  | `apps/server/src/routes/projects.rs:167` — `format!("{}:{}", config.host, config.port)`    |
| Trigger       | Any request to GET/POST/PATCH `/api/projects` or `/api/projects/{id}`                       |
| Condition     | `HOST` env var is `0.0.0.0` (default) and no `PUBLIC_URL` override exists                   |
| Related files | `apps/server/src/config.rs` (Config struct), `apps/server/src/models/project.rs` (dsn()), `docker-compose.yml` |

## Conclusion

**Confidence:** High

Root cause confirmed: `build_base_url()` uses `config.host` (TCP bind address, default `"0.0.0.0"`) instead of a public-facing URL. The `Config` struct has no `public_url` field. No existing test covers this code path. The fix requires changes to 3 files: `config.rs`, `routes/projects.rs`, and `docker-compose.yml`/`.env.example` for documentation.

## Fix Direction

**Mechanism: add PUBLIC_URL to Config with fallback**

1. **`apps/server/src/config.rs`** — Add `public_url: Option<String>` to `Config`, load from `PUBLIC_URL` env var in `from_env()`.
2. **`apps/server/src/routes/projects.rs:166-168`** — Update `build_base_url()` to use `config.public_url` if set, else fallback to `format!("http://{}:{}", config.host, config.port)`.
3. **`docker-compose.yml`** — Add `PUBLIC_URL=${PUBLIC_URL}` to the server service environment.
4. **`apps/server/.env.example`** — Document `PUBLIC_URL` (e.g., `https://api.yourdomain.com`).

**No changes needed in:**
- `apps/server/src/models/project.rs` — `dsn()` method is correct
- `apps/webview-ui/` — Frontend just displays what the API returns
- `packages/client/` — `dsn: z.string()` schema is fine

**Symmetry note:** The user already sets `RUSTRAK_API_URL` for the UI. They should set `PUBLIC_URL` on the server to the same base URL (minus the internal Docker hostname).

## Reproduction Plan

1. Deploy with `docker-compose.yml` (no `PUBLIC_URL` set)
2. Create a project via API or UI
3. Observe DSN in response: `http://key@0.0.0.0:8080/{id}`
4. After fix: set `PUBLIC_URL=https://api.example.com` in server env
5. Verify DSN becomes `https://key@api.example.com/{id}`

## Side Findings

- **No unit tests for `build_base_url()` or `Project::dsn()`** (`Confirmed` — gap in test coverage for a user-visible field).
- **`docker-compose.yml` passes `HOST=0.0.0.0` explicitly** (`apps/server/docker-compose.yml:22`) — this is correct for the bind address but makes it clearer that a separate `PUBLIC_URL` is needed.
- **`dsn()` scheme detection subtle note**: Sequential trims `trim_start_matches("http://")` then `trim_start_matches("https://")` work correctly for both schemes. Not a bug.
