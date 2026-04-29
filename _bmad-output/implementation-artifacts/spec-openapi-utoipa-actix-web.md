---
title: 'OpenAPI spec generation with utoipa'
type: 'feature'
created: '2026-04-26'
status: 'done'
baseline_commit: '2dc2f1f0765fc89cbfbf6bb553bf47fb918de73c'
context:
  - 'apps/server/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Rustrak's REST API has no machine-readable spec, so consumers must reverse-engineer endpoints from source code, and no interactive explorer exists for development/debugging.

**Approach:** Add OpenAPI 3.x spec generation using `utoipa 5` behind a compile-time `openapi` feature flag. Each route module gets a local `OpenApi` struct; a root `ApiDoc` in `src/openapi.rs` composes them via `nest()`. A `/docs` UI (Scalar) and `/api-docs/openapi.json` endpoint are served only when the feature is enabled. A `gen_openapi` binary emits the spec to disk for downstream use.

## Boundaries & Constraints

**Always:**
- All utoipa derives use `#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]` so models compile without the feature
- Ingest routes (`/api/{project_id}/envelope`, `/api/{project_id}/store`) are excluded from the spec — they follow Sentry protocol, not Rustrak's API
- Use `utoipa-scalar` (not swagger-ui) for the UI — lighter binary
- Feature flag name: `openapi`; production builds ship without it

**Ask First:**
- If any existing struct has a field type that utoipa can't derive schema for (e.g., opaque foreign types), HALT and ask before adding `value_type` overrides

**Never:**
- Do not call `ApiDoc::openapi()` inside a request handler — store in `app_data`
- Do not remove the `configure`-based route registration in `main.rs` — utoipa-actix-web auto-collection doesn't apply here (routes use `.route().to()` pattern)
- Do not add `utoipa` as a non-optional dependency

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |  Error Handling |
|----------|--------------|---------------------------|-----------------|
| Feature enabled, GET `/api-docs/openapi.json` | Server built with `--features openapi` | JSON spec with all documented endpoints | — |
| Feature enabled, GET `/docs` | Server built with `--features openapi` | Scalar UI HTML page | — |
| Feature disabled (production) | Server built without `--features openapi` | 404 on both `/docs` and `/api-docs/openapi.json` | Expected — endpoint does not exist |
| `cargo run --bin gen_openapi` | Feature `openapi` must be enabled at compile time | Writes `openapi.json` to crate root | Exits non-zero if write fails |

</frozen-after-approval>

## Code Map

- `apps/server/Cargo.toml` — add `openapi` feature + optional utoipa deps
- `apps/server/src/lib.rs` — expose `pub mod openapi` under `#[cfg(feature = "openapi")]`
- `apps/server/src/openapi.rs` (NEW) — root `ApiDoc` + `SecurityAddon` modifier
- `apps/server/src/main.rs` — pre-compute spec + scalar doc outside closure; add Scalar UI + JSON spec endpoint; no local `mod openapi`
- `apps/server/src/middleware/auth.rs` — add `/docs` and `/api-docs/` to `is_exempt` check
- `apps/server/src/error.rs` — `ToSchema` on `ErrorResponse`, `ErrorDetail`
- `apps/server/src/models/project.rs` — `ToSchema` on `ProjectResponse`, `CreateProject`, `UpdateProject`
- `apps/server/src/models/issue.rs` — `ToSchema` on `IssueResponse`, `UpdateIssueState`
- `apps/server/src/models/event.rs` — `ToSchema` on `EventResponse`, `EventDetailResponse`
- `apps/server/src/models/auth_token.rs` — `ToSchema` on `AuthTokenResponse`, `AuthTokenCreatedResponse`, `CreateAuthToken`
- `apps/server/src/models/user.rs` — `ToSchema` on `CreateUserRequest`, `LoginRequest`
- `apps/server/src/models/alert.rs` — `ToSchema` on alert request/response structs + enums
- `apps/server/src/routes/projects.rs` — `IntoParams` on query struct + `#[utoipa::path]` on 5 handlers + `ProjectsApi` struct
- `apps/server/src/routes/issues.rs` — same pattern → `IssuesApi`
- `apps/server/src/routes/events.rs` — same pattern → `EventsApi`
- `apps/server/src/routes/tokens.rs` — same pattern → `TokensApi`
- `apps/server/src/routes/auth.rs` — same pattern → `AuthApi`
- `apps/server/src/routes/health.rs` — inline response structs + `HealthApi`
- `apps/server/src/routes/alerts.rs` — same pattern → `AlertsApi`
- `apps/server/src/bin/gen_openapi.rs` (NEW) — binary that calls `ApiDoc::openapi()` and writes `openapi.json` to `CARGO_MANIFEST_DIR`

## Tasks & Acceptance

**Execution:**

- [x] `apps/server/Cargo.toml` — add feature `openapi = ["dep:utoipa", "dep:utoipa-actix-web", "dep:utoipa-scalar"]` and optional deps: `utoipa = { version = "5", features = ["actix_extras", "uuid", "chrono"], optional = true }`, `utoipa-actix-web = { version = "0.1", optional = true }`, `utoipa-scalar = { version = "0.3", features = ["actix-web"], optional = true }`

- [x] `apps/server/src/lib.rs` — add `#[cfg(feature = "openapi")] pub mod openapi;` so `rustrak::openapi` is accessible from `main.rs` and `gen_openapi.rs` without a second `mod` declaration

- [x] `apps/server/src/middleware/auth.rs` — extend `is_exempt` check: add `|| path.starts_with("/docs") || path.starts_with("/api-docs/")` so unauthenticated browsers can reach the Scalar UI and the JSON spec endpoint

- [x] `apps/server/src/error.rs` — add `#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]` to `ErrorResponse` and `ErrorDetail`

- [x] `apps/server/src/models/project.rs` — add `#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]` to `ProjectResponse`, `CreateProject`, `UpdateProject`

- [x] `apps/server/src/models/issue.rs` — add `#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]` to `IssueResponse`, `UpdateIssueState`

- [x] `apps/server/src/models/event.rs` — add `#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]` to `EventResponse`, `EventDetailResponse`

- [x] `apps/server/src/models/auth_token.rs` — add `#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]` to `AuthTokenResponse`, `AuthTokenCreatedResponse`, `CreateAuthToken`

- [x] `apps/server/src/models/user.rs` — add `#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]` to `CreateUserRequest`, `LoginRequest`

- [x] `apps/server/src/models/alert.rs` — add `#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]` to all public request/response structs and enums

- [x] `apps/server/src/routes/projects.rs` — `IntoParams` + `#[utoipa::path]` on 5 handlers + `ProjectsApi`

- [x] `apps/server/src/routes/issues.rs` — `IssuesApi` with 4 handlers

- [x] `apps/server/src/routes/events.rs` — `EventsApi` with 2 handlers

- [x] `apps/server/src/routes/tokens.rs` — `TokensApi` with 3 handlers

- [x] `apps/server/src/routes/auth.rs` — `AuthApi` with 4 handlers (no bearer security on auth routes)

- [x] `apps/server/src/routes/health.rs` — `HealthApi` with inline response structs (no bearer security on health routes)

- [x] `apps/server/src/routes/alerts.rs` — `AlertsApi` with 12 handlers

- [x] `apps/server/src/openapi.rs` (NEW) — `ApiDoc` + `SecurityAddon` with bearer_auth scheme; all non-auth/non-health paths tagged with `security(("bearer_auth" = []))`

- [x] `apps/server/src/main.rs` — pre-compute `openapi_spec: web::Data<String>` and `openapi_scalar_doc: utoipa::openapi::OpenApi` OUTSIDE `HttpServer::new` closure (once per process, not once per worker); inside the closure add them under `#[cfg(feature = "openapi")]`; do NOT declare `mod openapi` here (use `rustrak::openapi`)

- [x] `apps/server/src/bin/gen_openapi.rs` (NEW) — binary: calls `rustrak::openapi::ApiDoc::openapi()` and writes to `format!("{}/openapi.json", env!("CARGO_MANIFEST_DIR"))`; exits non-zero on write failure

**Acceptance Criteria:**

- Given server built with `--features openapi`, when GET `/api-docs/openapi.json`, then response is valid JSON with `openapi: "3.x.x"` and documents projects, issues, events, tokens, auth, health, and alerts endpoints
- Given server built with `--features openapi`, when GET `/docs`, then Scalar UI HTML is returned
- Given server built without `--features openapi` (default), then `cargo build` succeeds and no utoipa code is compiled
- Given `cargo run --bin gen_openapi --features openapi`, then file `openapi.json` is written to `apps/server/`
- Given any documented endpoint, when the spec is inspected, then `bearer_auth` security scheme is defined and applied to all non-auth, non-health endpoints

## Design Notes

**cfg_attr pattern for models** — utoipa is optional so derives must be conditional:
```rust
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ProjectResponse { ... }
```

**Route modules don't use `#[get]` macros**, so utoipa can't auto-detect paths. Every `#[utoipa::path]` annotation must include an explicit `path = "/api/projects"` argument.

**Module-local OpenApi pattern:**
```rust
#[cfg(feature = "openapi")]
use utoipa::OpenApi;

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(
    paths(list_projects, get_project, create_project, update_project, delete_project),
    components(schemas(ProjectResponse, CreateProject, UpdateProject, ErrorResponse)),
)]
pub struct ProjectsApi;
```

**Root ApiDoc nesting:**
```rust
#[derive(OpenApi)]
#[openapi(
    info(title = "Rustrak", version = env!("CARGO_PKG_VERSION")),
    nest(
        (path = "/api", api = crate::routes::projects::ProjectsApi),
        (path = "/api", api = crate::routes::issues::IssuesApi),
        // ...
    ),
    modifiers(&SecurityAddon),
)]
pub struct ApiDoc;
```

**Spec pre-computed outside closure, cloned per-worker** — `ApiDoc::openapi()` must NOT be called inside `HttpServer::new` (runs once per worker). Call it twice before the server is constructed — once to produce the JSON string, once for the Scalar service:

```rust
// OUTSIDE HttpServer::new — runs once per process:
#[cfg(feature = "openapi")]
let openapi_spec = web::Data::new(
    rustrak::openapi::ApiDoc::openapi()
        .to_pretty_json()
        .expect("valid spec")
);
#[cfg(feature = "openapi")]
let openapi_scalar_doc = rustrak::openapi::ApiDoc::openapi();

let server = HttpServer::new(move || {
    let app = App::new()
        // ... existing app_data + middleware + configure calls ...
        ;

    #[cfg(feature = "openapi")]
    let app = {
        use utoipa_scalar::{Scalar, Servable};
        app
            .app_data(openapi_spec.clone())
            .service(Scalar::with_url("/docs", openapi_scalar_doc.clone()))
            .route(
                "/api-docs/openapi.json",
                web::get().to(|s: web::Data<String>| async move {
                    actix_web::HttpResponse::Ok()
                        .content_type("application/json")
                        .body(s.get_ref().clone())
                }),
            )
    };

    app
});
```

**`gen_openapi` output path** — use `env!("CARGO_MANIFEST_DIR")` so the file lands at `apps/server/openapi.json` regardless of working directory:
```rust
let path = format!("{}/openapi.json", env!("CARGO_MANIFEST_DIR"));
std::fs::write(&path, json).expect("write openapi.json");
```

## Verification

**Commands:**
- `cargo build --features openapi` in `apps/server` — expected: compiles without warnings
- `cargo build` in `apps/server` — expected: compiles without utoipa (default features only)
- `cargo clippy --features openapi --all-targets -- -D warnings` — expected: no warnings
- `cargo run --features openapi` + `curl http://localhost:8080/api-docs/openapi.json | jq .info` — expected: `{"title": "Rustrak", "version": "..."}`
- `cargo run --bin gen_openapi --features openapi` — expected: `openapi.json` created in `apps/server/`
- `curl -s http://localhost:8080/docs` (no auth header) — expected: Scalar HTML (not 401)
- `curl -s http://localhost:8080/api-docs/openapi.json` (no auth header) — expected: JSON spec (not 401)

## Spec Change Log

### 2026-04-26 — bad_spec loopback after review pass 1

**Triggering finding:** Three-reviewer pass found `bad_spec`: `/docs` and `/api-docs/openapi.json` returned 401 because `RequireAuth` middleware has no exemption for those paths. The spec's AC2 ("GET /docs → Scalar HTML") implicitly required unauthenticated access but no task existed to add the exemption.

**Secondary patch findings folded into this amendment:**
- `main.rs` was declaring a local `mod openapi;` in addition to the one in `lib.rs` — causes double module compilation; fix: remove from `main.rs`, access via `rustrak::openapi`
- `ApiDoc::openapi()` was called inside `HttpServer::new` closure (runs once per worker, not once per process); fix: pre-compute both JSON spec and scalar doc outside the closure
- `gen_openapi.rs` used CWD-relative `"openapi.json"` path — non-deterministic; fix: `env!("CARGO_MANIFEST_DIR")`
- No-op `#[cfg(not(feature = "openapi"))] let app = app;` binding removed

**Sections amended (non-frozen only):**
- `## Code Map` — added `lib.rs` and `middleware/auth.rs` entries; updated `main.rs` and `gen_openapi.rs` descriptions
- `## Tasks & Acceptance` — reset all tasks to `[ ]`; added `lib.rs` and `middleware/auth.rs` tasks; updated `main.rs` and `gen_openapi.rs` task descriptions
- `## Design Notes` — replaced incorrect single-call-inside-closure pattern with correct outside-closure pattern; added `gen_openapi` path note
- `## Verification` — added two curl-without-auth checks

**Known-bad state avoided:**
- `/docs` and `/api-docs/openapi.json` returning 401 to unauthenticated browsers
- `ApiDoc::openapi()` serializing the full spec JSON on every worker spawn
- Double `mod openapi` causing Rust to compile the same file twice

**KEEP instructions (preserved from first implementation pass):**
- `utoipa::path` annotations with explicit `path` arg (routes don't use `#[get]` macros)
- Module-local `*Api` structs with `#[derive(OpenApi)]` pattern (Pattern B)
- `cfg_attr(feature = "openapi", derive(utoipa::ToSchema))` pattern on all model structs
- `SecurityAddon` modifier adding HTTP Bearer scheme + applying it to all non-auth/non-health paths
- Ingest routes remain excluded from spec entirely

## Suggested Review Order

**Feature flag wiring**

- Defines the `openapi` feature and gates all three optional deps
  [`Cargo.toml:154`](../../apps/server/Cargo.toml#L154)

- Gates the `openapi` module so `rustrak::openapi` is accessible from binaries
  [`lib.rs:15`](../../apps/server/src/lib.rs#L15)

**Root spec assembly**

- `SecurityAddon` initialises the bearer scheme; `ApiDoc` composes all 32 paths flat (nest() rejected empty prefixes)
  [`openapi.rs:1`](../../apps/server/src/openapi.rs#L1)

- `get_or_insert_with(Default::default)` ensures scheme registers even when utoipa produces no components block
  [`openapi.rs:8`](../../apps/server/src/openapi.rs#L8)

**Runtime integration**

- Both `ApiDoc::openapi()` calls happen outside the closure — once per process, not once per worker
  [`main.rs:75`](../../apps/server/src/main.rs#L75)

- Scalar UI + JSON endpoint added inside `#[cfg(feature = "openapi")]` block
  [`main.rs:148`](../../apps/server/src/main.rs#L148)

- `/docs` and `/api-docs/` exemption is itself cfg-gated — no effect in production builds where routes don't exist
  [`middleware/auth.rs:63`](../../apps/server/src/middleware/auth.rs#L63)

**Route annotations**

- Representative full example: 5 handlers, `IntoParams` query struct, inline paginated response body
  [`routes/projects.rs:16`](../../apps/server/src/routes/projects.rs#L16)

- Largest surface: 12 alert handlers (channels, rules, history) with explicit path strings
  [`routes/alerts.rs:43`](../../apps/server/src/routes/alerts.rs#L43)

- Auth routes: register/login/logout/me all have no `security(...)` — spec says auth routes are bearer-free
  [`routes/auth.rs:78`](../../apps/server/src/routes/auth.rs#L78)

- Health routes define inline response structs (`LivenessResponse`, `ReadinessResponse`) co-located with the handlers
  [`routes/health.rs:11`](../../apps/server/src/routes/health.rs#L11)

**Schema derives**

- `schema(bound = "T: utoipa::ToSchema")` pattern enables generic `PaginatedResponse<T>` to satisfy ToSchema
  [`pagination/mod.rs:13`](../../apps/server/src/pagination/mod.rs#L13)

- `schema(value_type = Object)` overrides opaque `serde_json::Value` fields utoipa can't introspect
  [`models/event.rs:67`](../../apps/server/src/models/event.rs#L67)

**CLI binary**

- `env!("CARGO_MANIFEST_DIR")` anchors output to `apps/server/openapi.json` regardless of CWD; `required-features` prevents compilation without the feature
  [`bin/gen_openapi.rs:8`](../../apps/server/src/bin/gen_openapi.rs#L8)
