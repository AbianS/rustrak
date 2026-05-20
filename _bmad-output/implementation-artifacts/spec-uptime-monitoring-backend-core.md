---
title: 'Uptime Monitoring — Backend Core'
type: 'feature'
created: '2026-05-20'
status: 'done'
baseline_commit: 'c7e9e27f116e6a6126fcc2fac3062712c1182dbe'
context:
  - 'apps/server/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Rustrak detects application errors but has no mechanism to detect infrastructure failures (servers down, endpoints unreachable). Developers discover outages only via user reports.

**Approach:** Add an in-process Tokio scheduler that probes HTTP/TCP monitors on configurable intervals, persists check results, drives a 4-state alerting machine (UP/PENDING_DOWN/DOWN/PENDING_UP), and dispatches alerts via the existing notification system when state transitions occur.

## Boundaries & Constraints

**Always:**
- **All implementation follows TDD using the `/tdd` skill.** Write tests first, then implementation. Every task in this spec is preceded by its tests. The implementation agent must invoke `/tdd` before writing any production code.
- Scheduler runs as a Tokio background task spawned in `main.rs`, following the existing digest worker pattern (`tokio::spawn(async move { ... })`)
- HTTP probes use the existing `reqwest::Client` pattern from `src/services/notification/webhook.rs`
- TCP probes use `tokio::net::TcpStream::connect` — zero new deps
- Alert dispatch reuses existing `NotificationDispatcher` trait and `create_dispatcher()` factory from `src/services/notification/`
- All DB access via `sqlx` macros following existing patterns — no raw SQL strings
- `AppError` + `AppResult<T>` for all error handling — no `anyhow` or `Box<dyn Error>` in handlers
- Follow existing migration naming: `20260520000000_uptime_monitoring.{up,down}.sql` for both postgres and sqlite dirs
- OpenAPI derives gated behind `#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]`

**Ask First:**
- If the existing `alert_channels` table schema is incompatible with `monitor_alert_channels` FK (e.g., different id type)
- If adding `UptimeConfig` to `Config` breaks any existing tests

**Never:**
- No new Cargo dependencies required for MVP (HTTP=reqwest, TCP=tokio::net, both already present)
- Do not modify the existing alert/notification system — only call it
- No TimescaleDB, no external TSDB
- No heartbeat/push monitoring (Phase 2)
- No ICMP, no DNS checks (Phase 2)
- Do not add `project_id` FK to monitors — monitors are global (not project-scoped)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| HTTP check — success | Monitor enabled, URL returns 200 | `monitor_checks` row inserted (status=0, latency_ms recorded), `monitor_states.state` stays UP | — |
| HTTP check — 2 consecutive failures | Monitor UP, 2× non-2xx or timeout | State → DOWN, DOWN alert dispatched via existing notification system | Dispatch failure logged, not retried |
| TCP check — connection refused | host:port closed | Probe returns error "connection refused", recorded as status=2 | Distinguish refused vs timeout in error_message |
| Recovery | Monitor DOWN, 2 consecutive successes | State → UP, RECOVERY alert dispatched | — |
| Repeat alert | Monitor DOWN for >1h | Repeat DOWN alert dispatched, `last_alerted_at` updated | — |
| Scheduler concurrency cap | 50+ monitors due simultaneously | Max 50 concurrent in-flight probes via `Arc<Semaphore>` | 51st waits; no check dropped |
| Server restart while DOWN | Monitor state=DOWN in DB | On restart, scheduler reads existing state — no duplicate DOWN alert fired | — |
| Monitor disabled | `enabled = false` | Scheduler skips it in `WHERE enabled = true` query | — |
| No channels assigned | Monitor has 0 entries in `monitor_alert_channels` | Alert state machine runs normally; dispatch step is a no-op | — |

</frozen-after-approval>

## Code Map

- `apps/server/migrations/postgres/` -- add `20260520000000_uptime_monitoring.up.sql`
- `apps/server/migrations/sqlite/` -- same migration for SQLite backend
- `apps/server/src/models/monitor.rs` -- new: Monitor, MonitorCheck, MonitorState, MonitorIncident models + DTOs
- `apps/server/src/services/monitor.rs` -- new: MonitorService (CRUD)
- `apps/server/src/services/uptime/mod.rs` -- new: module root
- `apps/server/src/services/uptime/probes.rs` -- new: run_http_probe(), run_tcp_probe()
- `apps/server/src/services/uptime/state_machine.rs` -- new: transition() pure fn, AlertAction enum
- `apps/server/src/services/uptime/scheduler.rs` -- new: run_scheduler() Tokio task
- `apps/server/src/routes/monitors.rs` -- new: configure(), CRUD handlers + manual check trigger
- `apps/server/src/config.rs` -- add UptimeConfig { retention_days, max_concurrent_checks }
- `apps/server/src/lib.rs` -- register monitors routes
- `apps/server/src/main.rs` -- spawn run_scheduler() task, add UptimeConfig to Config
- `apps/server/src/services/notification/` -- read-only reference: existing dispatch trait + factory
- `apps/server/src/services/alert.rs` -- read-only reference: existing AlertService pattern

## Tasks & Acceptance

**Execution:**
- [x] `apps/server/migrations/postgres/20260520000000_uptime_monitoring.up.sql` -- CREATE tables: `monitors`, `monitor_checks`, `monitor_states`, `monitor_incidents`, `monitor_alert_channels` -- foundation for all other tasks
- [x] `apps/server/migrations/sqlite/20260520000000_uptime_monitoring.up.sql` -- SQLite-compatible version (TEXT timestamps, INTEGER status, no PARTITION BY RANGE) -- required for default sqlite feature
- [x] `apps/server/src/models/monitor.rs` -- define Monitor (FromRow+Serialize), CreateMonitor/UpdateMonitor (Deserialize), MonitorState (sqlx::Type enum), MonitorCheck, MonitorIncident -- required by service and routes; CreateMonitor must enforce: interval_secs in [30, 86400], timeout_secs in [1, 60], fail_threshold in [1, 5], recovery_threshold in [1, 5] — return AppError::Validation on violation
- [x] `apps/server/src/services/monitor.rs` -- implement MonitorService: list(), get(), create(), update(), delete(), assign_channels(), get_state() -- CRUD layer consumed by routes; create() and update() must call validate_monitor_url() before persisting
- [x] `apps/server/src/services/uptime/probes.rs` -- implement run_http_probe(client, monitor) and run_tcp_probe(monitor) returning ProbeResult{ok, latency_ms, error} -- consumed by scheduler
- [x] `apps/server/src/services/uptime/state_machine.rs` -- implement pure fn transition(state, config, probe_result, now) -> (MonitorStateEnum, AlertAction) with AlertAction::{None, FireDown, FireRecovery, FireRepeat} -- pure logic, no DB or I/O
- [x] `apps/server/src/services/uptime/scheduler.rs` -- implement run_scheduler(pool, config, reqwest_client): 1-second tick loop, FOR UPDATE SKIP LOCKED query for due monitors, Arc<Semaphore> concurrency cap, per-probe timeout, startup jitter, persist result, call transition(), dispatch alerts via existing create_dispatcher() factory -- main scheduler task; state_load + state_write must be a single DB transaction (BEGIN … SELECT monitor_states FOR UPDATE … UPDATE monitor_states … COMMIT); all fallible functions return AppResult<T>, not Box<dyn Error>
- [x] `apps/server/src/services/uptime/mod.rs` -- module declaration re-exporting scheduler::run_scheduler -- wires the module
- [x] `apps/server/src/routes/monitors.rs` -- REST handlers: GET /api/monitors, POST /api/monitors, GET /api/monitors/:id, PATCH /api/monitors/:id, DELETE /api/monitors/:id, POST /api/monitors/:id/check (manual trigger) -- auth: Bearer/Session (same as projects routes); POST and PATCH must validate URL via validate_monitor_url() (reject RFC-1918/loopback/metadata IPs and non-http(s) schemes for HTTP monitors; reject non-host:port format for TCP monitors) before delegating to MonitorService
- [x] `apps/server/src/config.rs` -- add UptimeConfig { retention_days: u32, max_concurrent_checks: usize } with from_env(); add to Config struct -- drives scheduler behavior
- [x] `apps/server/src/lib.rs` -- register monitors routes via .configure(routes::monitors::configure) -- makes API accessible
- [x] `apps/server/src/main.rs` -- spawn tokio::spawn(uptime::scheduler::run_scheduler(pool, config.uptime, http_client)) after existing task spawns; add nightly cleanup task for expired monitor_checks rows -- activates scheduler

**Acceptance Criteria:**
- Given a monitor with check_type=http and a live URL, when the scheduler fires, then a row appears in monitor_checks within 5 seconds of next_check_at
- Given 2 consecutive HTTP failures on a monitor in UP state, when the state machine processes them, then monitor_states.state = 'down' and an alert is dispatched to all channels in monitor_alert_channels
- Given a monitor in DOWN state and 2 consecutive successes, when transition() is called, then state = 'up' and a RECOVERY alert is dispatched
- Given 51 monitors due simultaneously, when the scheduler fires, then at most 50 probes run concurrently (verified by semaphore permit count)
- Given a server restart with a monitor in DOWN state, when the scheduler starts, then no duplicate DOWN alert is fired (alerted_down_at is already set)
- Given DELETE /api/monitors/:id, when called, then the monitor row, its monitor_checks history, monitor_states, and monitor_incidents are all removed (CASCADE)
- Given POST /api/monitors with valid JSON, when called with Bearer auth, then 201 with the created monitor is returned
- Given POST /api/monitors with url="http://192.168.1.1/health", when called, then 400 is returned (SSRF: RFC-1918 blocked)
- Given POST /api/monitors with url="http://169.254.169.254/latest/meta-data", when called, then 400 is returned (SSRF: link-local/metadata IP blocked)
- Given POST /api/monitors with interval_secs=10, when called, then 400 is returned (below minimum 30)
- Given POST /api/monitors with timeout_secs=0, when called, then 400 is returned (below minimum 1)
- Given POST /api/monitors with fail_threshold=6, when called, then 400 is returned (above maximum 5)

## Design Notes

**State machine is pure:** `transition()` takes current state + probe result, returns new state + action. No DB or I/O. Makes it trivially testable and keeps the scheduler clean.

**Reuse existing notification system:** The scheduler calls `create_dispatcher(channel.channel_type)` to get a `Box<dyn NotificationDispatcher>` and calls `.dispatch(payload)`. No new notification code written.

**`FOR UPDATE SKIP LOCKED`** on the monitor scheduling query ensures two server instances never double-run the same check during rolling deploys.

**Nightly cleanup** follows the same `tokio::spawn` pattern as the scheduler — a separate long-lived task that wakes every 24h and runs `DELETE FROM monitor_checks WHERE checked_at < NOW() - INTERVAL '{retention_days} days'`.

**URL validation (SSRF prevention):** `validate_monitor_url(url: &str, check_type: CheckType) -> AppResult<()>` must be implemented in `src/services/monitor.rs` (or a dedicated `src/utils/validation.rs`). Rules:
- HTTP monitors: scheme must be `http` or `https`; resolved host must not fall in RFC-1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.0/8, ::1), or link-local/metadata (169.254.0.0/16, 100.64.0.0/10) ranges. DNS resolution is checked at creation time; the check is advisory (dynamic DNS can change), so the probe itself does not re-validate.
- TCP monitors: url field must be in `host:port` format where port is 1–65535.
- Called from both `MonitorService::create()` and `MonitorService::update()` before any DB write.

**Input bounds (validated in CreateMonitor/UpdateMonitor):**
- `interval_secs`: min 30, max 86400 (24h)
- `timeout_secs`: min 1, max 60
- `fail_threshold`: min 1, max 5
- `recovery_threshold`: min 1, max 5
- Violations return `AppError::Validation(String)` (HTTP 400).

**State atomicity:** The scheduler's per-monitor state update is a single DB transaction:  `BEGIN → SELECT … FROM monitor_states WHERE monitor_id = $1 FOR UPDATE → compute new state → UPDATE monitor_states … → INSERT monitor_checks … → COMMIT`. This prevents a TOCTOU race where two concurrent scheduler instances (during a rolling deploy) could both read the same state and both fire a DOWN alert.

**AppError scope:** `AppError` + `AppResult<T>` apply to ALL production code including background task helper functions (scheduler, cleanup, probe dispatch). `Box<dyn Error>` / `anyhow` are forbidden in production code paths. The `run_scheduler` top-level function may return `()` (errors are logged internally), but every sub-function it calls must use `AppResult<T>`.

## Verification

**Commands:**
- `cd apps/server && cargo build` -- expected: zero errors, zero new warnings
- `cd apps/server && cargo clippy -- -D warnings` -- expected: clean
- `cd apps/server && cargo test` -- expected: all existing tests pass; new state_machine unit tests pass
- `cd apps/server && cargo run --bin gen_openapi --features openapi` -- expected: openapi.json updated with /api/monitors endpoints

**Manual checks:**
- POST /api/monitors with `{"name":"test","check_type":"http","url":"https://httpbin.org/status/200","interval_secs":60}` → 201 with monitor JSON
- Wait 65 seconds → GET /api/monitors/:id/checks → at least 1 row with status=0
- PATCH monitor to point at `https://httpbin.org/status/500` → after 2 checks, GET /api/monitors/:id → state=pending_down or down

## Spec Change Log

### Loop 2 — 2026-05-20 (bad_spec loopback)

**Triggering findings (from step-04 review):**
- B1 (SSRF): No URL validation on monitor creation — attacker could use Rustrak as a probe for internal network resources (RFC-1918, link-local, metadata endpoints).
- B2 (race condition): state read and state write were two separate DB operations, not an atomic transaction. Two concurrent scheduler instances (rolling deploy) could both read UP state and both fire DOWN alerts.
- B3 (input bounds): No min/max constraints on `interval_secs` (could be 0 or 1), `timeout_secs` (could be 0), `fail_threshold`/`recovery_threshold` (unbounded). Invalid values would silently produce broken behaviour.
- B4 (AppError scope): `scheduler.rs` used `Box<dyn Error>` in sub-functions despite the spec's "AppError for all error handling" constraint. Constraint was ambiguous about background tasks.

**What was amended (non-frozen sections only):**
- Tasks: reset all [x] → [ ]; added URL validation, input bounds, and transaction atomicity requirements to relevant task descriptions (models, service, routes, scheduler).
- Acceptance Criteria: added 5 new ACs covering SSRF rejection, interval/timeout/threshold bound violations.
- Design Notes: added four new notes — URL validation (SSRF prevention), input bounds, state atomicity, AppError scope.

**Known-bad state avoided:**
- SSRF probe reachable from the API without authentication bypass.
- Duplicate DOWN alerts on rolling-deploy restart.
- panic or silent no-op on interval_secs=0.
- `Box<dyn Error>` leaking into production code paths.

**KEEP instructions for re-derivation:**
- Pure state machine function structure: `transition(state, config, probe_result, now) -> (MonitorStateEnum, AlertAction)` with `AlertAction::{None, FireDown, FireRecovery, FireRepeat}` — 15 unit tests must be preserved.
- Migration schema structure: 5 tables (monitors, monitor_checks, monitor_states, monitor_incidents, monitor_alert_channels), FK cascades, SQLite-compatible variant.
- `Arc<Semaphore>` concurrency cap pattern in scheduler.
- `alerted_down_at` guard: on scheduler start, if state is already DOWN and `alerted_down_at` is set, do NOT fire another DOWN alert.
- `mockito` as `[dev-dependencies]` only — not a production dep.
- No `project_id` FK on monitors table.
- OpenAPI `#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]` gating pattern.
