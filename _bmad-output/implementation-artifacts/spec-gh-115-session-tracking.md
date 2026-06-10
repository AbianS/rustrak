---
title: 'Session tracking & release health (gh-115)'
type: 'feature'
created: '2026-06-10'
status: 'done'
baseline_commit: '1a7da538208f19fc3169db51152e24ae47620cf9'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/apps/server/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sentry SDKs emit `session` / `sessions` envelope items for release health, but Rustrak parses and silently drops them at `routes/ingest.rs` (only `item_type == "event"` is processed). No crash-free rate, no per-release health is captured.

**Approach:** Capture session items on the ingest path and hand them to an in-process Tokio aggregator that buckets counters in memory and flushes batched UPSERTs to two small rollup tables (`session_counts`, `session_users`) — never a DB write per session/update (mandatory: SQLite is the default DB and cannot take per-update writes). Expose `GET /api/projects/{id}/sessions/stats`, add a `sessions` client resource, and render a release-health card on the project page. Dual-DB (SQLite + Postgres) throughout.

## Boundaries & Constraints

**Always:**
- Mirror Relay's counting rules (verified in `relay-event-schema/src/protocol/session.rs`): a session's `total` is counted once, on the update with `init=true`; status classification (`crashed`/`abnormal`/`errored`) is taken from the terminal update; `errored` = terminal `status` is errored OR `errors > 0`. Healthy is **derived** = `total - errored - crashed - abnormal`, never stored.
- The session ingest path performs **zero per-session DB writes** — it only feeds the in-memory aggregator. All persistence happens in the aggregator's periodic + on-shutdown flush via batched `INSERT ... ON CONFLICT DO UPDATE`.
- Every migration is written for **both** `migrations/postgres/` and `migrations/sqlite/` with matching dialect types; SQLite datetimes bind via `.naive_utc()`, UUIDs as TEXT.
- TDD: write the failing test first for each unit of logic (bucketing/classification, flush UPSERT, stats query, schema validation, resource method). Follow the `/tdd` skill.
- Session items still return `200` and never block or error the event path; an unparseable session payload is dropped with a `warn!`, never a 4xx.
- Aggregator state is flushed on graceful shutdown (reuse the existing `shutdown_signal` path in `main.rs`).

**Ask First:**
- Adding per-category **session rate limiting** (separate quota counters) — out of scope below; confirm before introducing.
- Introducing the `postgresql-hll` extension or table partitioning/`fillfactor` tuning — deferred; confirm before adding.
- Any change to the existing event ingest/digest behavior or the `events` table.

**Never:**
- Never store one row per raw session update, nor a per-update DB write (write amplification kills SQLite).
- Never add Kafka/ClickHouse/a generic metrics engine, HLL, or table partitioning in this spec.
- Never treat `unhandled` as a `session`-item status (it exists only as an aggregate counter in `sessions`).
- Never block the HTTP response on a flush; flushes are async/interval-driven.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Init update | `session` item, `init=true`, status `ok` | bucket `total += 1`; user `did` recorded | N/A |
| Heartbeat | `session` item, `init=false`, status `ok` | No counter change (already counted at init) | N/A |
| Crash | `session` item, status `crashed` | bucket `crashed += 1`; `did` → crashed-users | N/A |
| Errored exit | `session` item, status `exited`, `errors>0` | bucket `errored += 1` | N/A |
| Pre-aggregated | `sessions` item with `aggregates[]` | counters added directly per item (`exited/errored/abnormal/crashed`) | N/A |
| Missing release | `attrs.release` absent | item dropped | `warn!`, return 200 |
| Cardinality flood | distinct `(release,env)` over cap for project | excess folded into `release='<overflow>'` | bounded memory |
| Invalid JSON | malformed session payload | item dropped, event path unaffected | `warn!`, return 200 |
| Stats query | `GET …/sessions/stats?period=24h` | per-release rows: counts + crash-free sessions% + crash-free users% | 403 if no project access |

</frozen-after-approval>

## Code Map

- `apps/server/src/ingest/parser.rs` -- already type-agnostic; no change, source of session items
- `apps/server/src/routes/ingest.rs:77` -- extract `session`/`sessions` items alongside `event`, feed aggregator handle
- `apps/server/src/models/session.rs` -- NEW: wire structs (`SessionUpdate`, `SessionAggregates`, `SessionAggregateItem`, `SessionAttributes`, `SessionStatus`) + read models (`ReleaseHealthRow`) + response DTO
- `apps/server/src/workers/session_aggregator.rs` -- NEW: in-memory `HashMap<BucketKey,Counters>` + user dedup set; `run()` interval loop (mirror `workers/sourcemap_assembly.rs`), `flush()`, `ingest_session()`/`ingest_aggregates()`
- `apps/server/src/services/session.rs` -- NEW: `SessionService::release_health(pool, project_id, period)` dual-DB read query
- `apps/server/src/routes/sessions.rs` -- NEW: `get_stats` handler (`ApiActor` + `access::require(... ViewProject)`), `configure()`
- `apps/server/src/routes/mod.rs` -- register `pub mod sessions`
- `apps/server/src/main.rs:59-67` -- build aggregator, share handle via `web::Data`, `tokio::spawn(run)`, flush on shutdown; `.configure(routes::sessions::configure)`
- `apps/server/src/config.rs` -- `SESSION_FLUSH_INTERVAL_SECS` (default 30), `SESSION_CARDINALITY_CAP` (default 10000)
- `apps/server/migrations/{postgres,sqlite}/20260610000000_create_sessions.{up,down}.sql` -- NEW: `session_counts`, `session_users`
- `packages/client/src/schemas/session.ts`, `src/types/session.ts`, `src/resources/sessions.ts`, `src/resources/index.ts`, `src/client.ts` -- NEW `sessions` resource w/ `stats(projectId, period?)` (mirror `events`)
- `packages/client/tests/mocks/handlers.ts`, `tests/integration/sessions.test.ts` -- MSW handler + tests
- `packages/mcp/src/tools/sessions.ts` -- NEW `registerSessionTools` exposing `get_release_health` tool → `client.sessions.stats(...)` (mirror `tools/issues.ts`)
- `packages/mcp/src/server.ts:22` -- register `registerSessionTools(server, client)`
- `packages/mcp/tests/tools/sessions.test.ts` (TDD) + `tests/integration/server.test.ts` -- add tool test; add `get_release_health` to `EXPECTED_TOOLS` + bump count
- `apps/webview-ui/src/actions/sessions.ts` -- NEW server action `getReleaseHealth(projectId, period)`
- `apps/webview-ui/src/app/(main)/projects/[id]/release-health-card.tsx` -- NEW client card (recharts 3.8.0 available)
- `apps/webview-ui/src/app/(main)/projects/[id]/page.tsx:47` -- add `getReleaseHealth` to the parallel fetch, render card
- `apps/server/openapi.json` -- regenerate after endpoint added (see Verification)

## Tasks & Acceptance

**Execution:**
- [x] `apps/server/migrations/postgres/20260610000000_create_sessions.up.sql` + sqlite twin -- create `session_counts(project_id, release, environment, bucket, total, errored, crashed, abnormal, PK(project_id,release,environment,bucket))` and `session_users(project_id, release, environment, day, did, crashed, PK(project_id,release,environment,day,did))`; Postgres: INTEGER/TEXT/TIMESTAMPTZ/BIGINT, SQLite: INTEGER/TEXT(datetime)/INTEGER -- storage
- [x] `apps/server/src/models/session.rs` -- port wire structs with serde renames (`sid/did/seq/init/attrs`) + `SessionStatus` enum (`ok/exited/crashed/abnormal/errored`) + classification helpers + response DTO -- write unit tests first for parse + classify
- [x] `apps/server/src/workers/session_aggregator.rs` -- pure bucketing/classification (unit-testable, no I/O) + interval `run()` + batched `flush()` UPSERT (dual-DB) + cardinality cap/overflow -- TDD the bucketing & flush separately
- [x] `apps/server/src/routes/ingest.rs` -- iterate items, parse session/sessions, call aggregator handle; keep 200 + event path intact
- [x] `apps/server/src/services/session.rs` + `routes/sessions.rs` -- dual-DB release-health query + `GET /api/projects/{id}/sessions/stats?period=` returning per-release rows with crash-free rates
- [x] `apps/server/src/{main.rs,routes/mod.rs,config.rs}` -- wire aggregator (spawn + shutdown flush + `web::Data` handle), register route, add config knobs
- [x] `packages/client/**` -- `SessionsResource.stats()` + Zod schema + type + register on client; MSW handler + integration tests (mirror `events.test.ts`)
- [x] `packages/mcp/**` -- `get_release_health` tool wrapping `client.sessions.stats()` (`try/catch` → `toMcpError`, JSON text content); add to `EXPECTED_TOOLS`; TDD via `tests/tools/sessions.test.ts` with mocked client (mirror `tools/issues.test.ts`)
- [x] `apps/webview-ui/**` -- server action + release-health card on project page

**Acceptance Criteria:**
- Given a `session` envelope with `init=true` then a later `crashed` update for the same `sid`, when both are ingested and flushed, then `session_counts` shows `total=1, crashed=1` for that `(release, environment, bucket)` — no double count.
- Given a `sessions` (pre-aggregated) item, when ingested and flushed, then its `exited/errored/abnormal/crashed` counts are added to the matching bucket.
- Given sessions exist, when `GET /api/projects/{id}/sessions/stats?period=24h` is called by an authorized actor, then it returns per-release `{total, healthy, errored, crashed, abnormal, crash_free_sessions_rate, crash_free_users_rate}`; an unauthorized actor gets 403.
- Given the server receives SIGTERM with un-flushed buckets, when it shuts down gracefully, then in-memory counters are flushed before exit.
- Given the build, when run for both DB backends, then `cargo test` and `cargo test --no-default-features --features postgres` both pass.
- Given the project page, when sessions exist for a project, then the release-health card renders crash-free % and status counts.
- Given an MCP client, when it calls `get_release_health` with a `project_id`, then it receives the same per-release health JSON as the REST endpoint; the integration tool-count test reflects the added tool.

## Spec Change Log

<!-- Append-only. Populated by step-04 during review loops. -->

## Design Notes

**Counting model (verified against Relay source):** classify each `session` update — `total` only when `init=true`; from the terminal update derive one of crashed/abnormal/errored, else healthy. This makes every counter increment a single self-describing event, so the aggregator needs **no cross-flush dedup state** for sessions. Distinct users are deduped by the `session_users` PK at the DB layer (day-bucketed → bounded by users/day, not traffic), so crash-free-users is exact without HLL.

```
// aggregator bucket key + flush (pseudocode)
key = (project_id, release, environment, truncate_minute(started))
on init:        counts[key].total += 1
on terminal:    match classify(status, errors) { Crashed=>crashed+=1, Abnormal=>abnormal+=1, Errored=>errored+=1, Healthy=>() }
flush(): one multi-row INSERT .. ON CONFLICT (..) DO UPDATE SET total = session_counts.total + EXCLUDED.total, ...
```

Read query derives `crash_free_sessions_rate = 1 - sum(crashed)/nullif(sum(total),0)` and `crash_free_users_rate = 1 - count(distinct crashed did)/nullif(count(distinct did),0)` grouped by release over the period window.

## Verification

**Commands:**
- `cd apps/server && cargo test` -- expected: all pass (SQLite default, incl. aggregator + stats tests)
- `cd apps/server && cargo test --no-default-features --features postgres` -- expected: pass (Postgres path)
- `cd apps/server && cargo clippy --all-features` -- expected: no warnings
- `cd apps/server && cargo run --features openapi -- --dump-openapi > openapi.json` (or existing gen task) -- expected: `sessions/stats` present; commit regenerated `openapi.json`
- `pnpm --filter @rustrak/client test` -- expected: new sessions resource tests pass
- `pnpm --filter @rustrak/mcp test` -- expected: `get_release_health` tool test + integration tool-count test pass
- `pnpm lint && pnpm check-types` -- expected: clean

**Manual checks:**
- Run `pnpm test-sentry --dsn <dsn> --all` (or a session-emitting SDK), then `GET …/sessions/stats?period=24h` returns non-zero counts; project page shows the card.

## Suggested Review Order

**Entry point — aggregator design**

- In-memory `HashMap<BucketKey, Counters>` + interval flush; the core design decision.
  [`session_aggregator.rs:94`](../../apps/server/src/workers/session_aggregator.rs#L94)

**Data model & counting rules**

- Relay counting rules: `classify()` maps status+errors → outcome; `is_terminal()` gates double-count.
  [`session.rs:79`](../../apps/server/src/models/session.rs#L79)

- Response DTO with derived `healthy` field; never stored, computed on query.
  [`session.rs:97`](../../apps/server/src/models/session.rs#L97)

- Schema: minute-bucketed counts + day-bucketed users; two tables, one PK per.
  [`20260610000000_create_sessions.up.sql`](../../apps/server/migrations/sqlite/20260610000000_create_sessions.up.sql#L1)

**Ingest path**

- Envelope item dispatch: session/sessions/event fan-out; aggregator optional for test compat.
  [`ingest.rs:76`](../../apps/server/src/routes/ingest.rs#L76)

**Aggregator internals**

- `ingest_session`: init gate (total++), cardinality cap, terminal classification.
  [`session_aggregator.rs:94`](../../apps/server/src/workers/session_aggregator.rs#L94)

- `flush`: `mem::take` drains state, per-row UPSERT accumulates into DB.
  [`session_aggregator.rs:207`](../../apps/server/src/workers/session_aggregator.rs#L207)

- `apply_cardinality_cap`: overflow folding; `apply_aggregate_item`: pre-agg sums.
  [`session_aggregator.rs:324`](../../apps/server/src/workers/session_aggregator.rs#L324)

**Stats query & API**

- Dual-DB `release_health` query: Postgres single JOIN; SQLite sequential per-release.
  [`services/session.rs:9`](../../apps/server/src/services/session.rs#L9)

- `get_stats` handler: access guard, period parsing, JSON response.
  [`routes/sessions.rs:55`](../../apps/server/src/routes/sessions.rs#L55)

**Wiring & config**

- Aggregator spawn, `web::Data` registration, shutdown flush.
  [`main.rs:71`](../../apps/server/src/main.rs#L71)

- `SESSION_FLUSH_INTERVAL_SECS` / `SESSION_CARDINALITY_CAP` env knobs.
  [`config.rs:25`](../../apps/server/src/config.rs#L25)

**Client + MCP**

- `SessionsResource.stats()` with Zod schema validation.
  [`resources/sessions.ts:14`](../../packages/client/src/resources/sessions.ts#L14)

- `get_release_health` MCP tool wrapping `client.sessions.stats()`.
  [`tools/sessions.ts:10`](../../packages/mcp/src/tools/sessions.ts#L10)

**UI**

- `ReleaseHealthCard`: table with color-coded crash-free rates; null guard on empty data.
  [`release-health-card.tsx:18`](../../apps/webview-ui/src/app/(main)/projects/[id]/release-health-card.tsx#L18)

- Page integration: parallel fetch with resilient `.catch(() => [])`.
  [`page.tsx:63`](../../apps/webview-ui/src/app/(main)/projects/[id]/page.tsx#L63)
