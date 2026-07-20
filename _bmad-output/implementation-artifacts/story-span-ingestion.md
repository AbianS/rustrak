# Story: Standalone Span (`ItemType::Span`) Envelope Ingestion

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Standalone story (no epic/PRD numbering in this project — implementation-artifacts uses flat spec-*.md/story-*.md files). -->

> **Implementation workflow: TDD, mandatory.** Every task below (1–8) is implemented via `/tdd` — red (failing test first) → green (minimal implementation) → refactor. Do not write `SpanProcessor`, `SpanService`, the route handler, or the envelope/migration changes before their test exists and fails for the right reason. Task 9's scenarios are the test list to drive each task's red step, not a final QA pass bolted on afterward.

## Story

As a Sentry SDK / OpenTelemetry integration sending standalone spans (not attached to a parent transaction — e.g. serverless functions, background jobs, OTel bridges),
I want Rustrak to accept and store `"type":"span"` envelope items,
so that span data isn't silently dropped, and downstream features (trace views, AI Agent Monitoring — GH #180) have span data to build on.

## Acceptance Criteria

1. An envelope item with `"type":"span"` is parsed into a new `EnvelopeItemKind::Span(Vec<u8>)` variant instead of falling into `EnvelopeItemKind::Other` and being silently dropped.
2. A valid standalone span (has `span_id`, `trace_id`, `start_timestamp` ≤ `timestamp`) is persisted as a new row in the `spans` table with `transaction_id = NULL`.
3. A standalone span envelope item is accepted **without** a `trace` envelope header (DSC) present — this must not be required for acceptance, matching real-world SDK behavior (see Dev Notes: Relay pipeline research).
4. An invalid span (missing/unparseable `span_id` or `trace_id`, or `start_timestamp > timestamp`, or malformed JSON) is dropped and logged — the envelope's own HTTP response is unaffected (ingest already returned 200 before processors run, same as Transaction/Log today).
5. `GET /api/projects/{project_id}/spans` lists spans for a project with offset pagination (mirroring `GET /api/projects/{project_id}/logs`), filterable by `op`, `status`, `trace_id`.
6. Existing transaction-embedded span behavior (`TransactionProcessor::insert_span`, `GET /transactions/{id}/spans`) is unchanged — this story adds a second producer into the same `spans` table, it does not modify the existing one.
7. A querying by `trace_id` returns spans from both origins (standalone AND transaction-embedded) in one result set — this should fall out naturally from both producers writing into the same table with the same `trace_id` column, not from new cross-origin logic.
8. ~~The rate-limiting decision (see Dev Notes Phase H) is made explicitly and documented in the PR/commit — not silently inherited from Transaction's exemption. Default recommendation: standalone spans **do** participate in Rustrak's existing minute/hour quota (global + per-project), unlike transactions today.~~ **DECIDED 2026-07-14**: spans stay exempt for this story, same as Transaction/Log (`SpanProcessor` never calls `RateLimitService`) — Rustrak's quota is a single shared counter, not per-category like Relay's, so sharing it risks starving legitimate error quota once span volume dominates. The correct fix is a separate per-category quota track matching Relay's `DataCategory::Span` model — logged as deferred work **D-23** (`_bmad-output/implementation-artifacts/deferred-work.md`), not silently dropped.
9. `cargo test` passes on both `sqlite` (default) and `postgres` feature flags; migrations exist in both `apps/server/migrations/postgres/` and `apps/server/migrations/sqlite/`.
10. OpenAPI spec (`apps/server/openapi.json`) is regenerated and committed to include the new route(s).

## Tasks / Subtasks

- [ ] **Task 1 — Envelope layer** (AC: #1)
  - [ ] `apps/server/src/ingest/envelope.rs`: add `EnvelopeItemKind::Span(Vec<u8>)` variant (raw bytes, like `Event`/`Transaction` — not a typed struct like `Session`)
  - [ ] Add `"span" => Self::Span(payload)` arm to the `From<(ItemHeaders, Vec<u8>)>` impl
  - [ ] **Verify before setting `requires_event()`**: read its exact consumer in `routes/ingest.rs` (step "Resolve/validate `event_id`, only if `requires_event_id` was set") before assuming a value. Best guess is `false` (a span has its own identity via `span_id`/`trace_id`, doesn't need an envelope-level `event_id` the way `Event`/`Transaction` do) — but this wasn't independently confirmed against the full body of that check, so read it first rather than copying `Transaction`'s `true` on faith

- [ ] **Task 2 — `SpanProcessor`** (AC: #2, #3, #4)
  - [ ] New file `apps/server/src/digest/processors/span.rs`
  - [ ] `pub struct SpanProcessor;` implementing `Processor { type Input = Vec<u8>; async fn process(...) }`
  - [ ] Parse payload as `serde_json::Value` (single flat object — **not** an item container; see Dev Notes, this differs from `LogsProcessor`)
  - [ ] Malformed JSON → `AppError::Validation`, logged and dropped (do not panic, do not unwrap)
  - [ ] Validate `span_id` and `trace_id` present + parseable, `start_timestamp` present and `<=` `timestamp` — drop+log otherwise (mirror Relay's `DiscardReason::InvalidSpan`/`Timestamp`, do not require a `trace` DSC header)
  - [ ] Compute `duration_ms = (timestamp - start_timestamp) * 1000` — there is no wire `duration` field on Relay's `Span`, it's always derived
  - [ ] Store `data` (the span's `data`/attributes object) as JSONB catch-all, same approach `TransactionProcessor::insert_span` already uses
  - [ ] Single `INSERT INTO spans (...)` with `transaction_id = NULL`; no advisory lock (no grouping/issue concept, same as `TransactionProcessor`)

- [ ] **Task 3 — Ingest route wiring** (AC: #1, #4)
  - [ ] `apps/server/src/routes/ingest.rs`: add `EnvelopeItemKind::Span(payload) => { ... }` match arm — mirror the `Transaction` handling exactly: capture, `tokio::spawn(processors.spans.process(payload, &ctx))` **before** the early-return for non-`event` envelopes
  - [ ] `apps/server/src/digest/processors/mod.rs`: add `Route::Span` variant to the pure `route()` match (compiler-enforced exhaustive match — this alone will surface any spot that still needs updating)
  - [ ] Add `spans: SpanProcessor` field to the `Processors` struct, register in `Processors::new()`

- [ ] **Task 4 — DB migration** (AC: #2, #9)
  - [ ] New migration pair in **both** `apps/server/migrations/postgres/` and `apps/server/migrations/sqlite/`, named `YYYYMMDDHHMMSS_standalone_spans.{up,down}.sql`
  - [ ] `ALTER TABLE spans ALTER COLUMN transaction_id DROP NOT NULL` (currently `NOT NULL` FK to `transactions`)
  - [ ] Add nullable `platform`, `release`, `environment` columns — transaction-child spans inherit these from their parent transaction row; standalone spans have no parent row to inherit from
  - [ ] `project_id` already exists on `spans` (confirmed via the existing `(project_id, op)` index) — no change needed there
  - [ ] Add index `(project_id, trace_id)` if not already covered by the existing `trace_id` index, to support AC #7's cross-origin trace query

- [ ] **Task 5 — Model** (AC: #5)
  - [ ] Extend `SpanResponse` in `apps/server/src/models/transaction.rs` with `transaction_id: Option<Uuid>` (distinguishes standalone vs transaction-child in API responses) and the new optional `platform`/`release`/`environment` fields
  - [ ] Keep `#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]` convention

- [ ] **Task 6 — `SpanService`** (AC: #5, #7)
  - [ ] New file `apps/server/src/services/span.rs`
  - [ ] `SpanFilters { op: Option<String>, status: Option<String>, trace_id: Option<String> }` — mirror `LogFilters`'/`TransactionFilters`' `($n IS NULL OR col = $m)` guard pattern (static SQL, positional binds, dialect-portable)
  - [ ] `list_offset(pool, project_id, page, per_page, filters) -> AppResult<(Vec<SpanResponse>, i64)>` — same shape as `LogService::list_offset` / `TransactionService::list_offset` (clamp `per_page` to `[1,100]`, separate COUNT query, `ORDER BY start_timestamp DESC, id DESC`)

- [ ] **Task 7 — Route + OpenAPI** (AC: #5, #10)
  - [ ] New file `apps/server/src/routes/spans.rs`, closely mirroring `apps/server/src/routes/logs.rs` (it's the more direct precedent — single list endpoint, no stats/detail sub-routes needed for this story)
  - [ ] Mount at `/api/projects/{project_id}/spans`, `GET ""` → `list_spans` handler
  - [ ] Auth: `ApiActor` extractor + `access::require(pool, actor.is_admin(), actor.user_id(), project_id, Action::ViewProject)`
  - [ ] `ListSpansQuery` in `apps/server/src/pagination/mod.rs` (mirror `ListLogsQuery`)
  - [ ] `#[cfg_attr(feature = "openapi", utoipa::path(...))]` on the handler, local `SpansApi` `#[derive(OpenApi)]` struct, `pub fn configure(cfg: &mut web::ServiceConfig)`
  - [ ] Register `routes::spans::configure` in `main.rs` (alongside the other route modules) and add to `apps/server/src/openapi.rs`'s `ApiDoc`
  - [ ] Regenerate: `cd apps/server && cargo run --bin gen_openapi --features openapi`, commit `openapi.json`

- [x] **Task 8 — Rate limiting decision** (AC: #8) — **DECIDED, not implemented**: spans stay exempt (no `RateLimitService` call in `SpanProcessor`), matching Transaction/Log. Rationale + follow-up tracked as **D-23** in `deferred-work.md` — Rustrak's quota is one shared counter, not per-DataCategory like Relay's, so participating today risks error-event quota starvation once span volume dominates. Revisit once a per-category quota track exists.

- [x] **Task 9 — Test scenarios** (AC: #9) — drove Tasks 1–7 via `/tdd`, vertical-sliced (red→green per scenario, not batched)
  - [x] Unit tests for `SpanProcessor` validation logic — `tests/unit/span_test.rs::level2` (missing `span_id`, missing `trace_id`, `start_timestamp > timestamp`, malformed JSON — all rejected, no row stored)
  - [x] Integration test: full envelope with a standalone `"type":"span"` item → row in `spans` with `transaction_id IS NULL` — `tests/integration/ingest_test.rs::test_ingest_standalone_span_envelope_without_trace_header_stores_row`
  - [x] Integration test: envelope with NO `trace` header still accepts the span (AC #3) — same test above; also `test_ingest_multiple_standalone_spans_in_one_envelope` (spans are NOT containerized like logs — one item per span)
  - [x] Integration test: `GET /api/projects/{id}/spans` round-trip, filter by `op`/`trace_id` — `tests/integration/spans_api_test.rs`. Gap found and closed during review: `op`/`status` were only tested at the `SpanService` layer, bypassing the `ListSpansQuery` HTTP boundary, and `status` had zero coverage anywhere — added `test_list_spans_filters_by_op` and `test_list_spans_filters_by_status` at the HTTP level
  - [x] Integration test (AC #7): standalone span + transaction-embedded span sharing a `trace_id` → filter query returns both — `tests/unit/span_test.rs::level2::test_list_spans_by_trace_id_returns_both_standalone_and_transaction_spans`
  - [x] Run against both `sqlite` (default) and `--features postgres` (via `testcontainers`) — full suite green on both: sqlite 254 unit + 271 integration (0 failed), postgres full regression 0 failed

## Dev Notes

### Why this story exists

Rustrak already has span extraction **from transactions** (`TransactionProcessor::insert_span`, dedicated `spans` table, `GET /transactions/{id}/spans` — all working today). What's missing is the **standalone** `Span` envelope item — an SDK/OTel bridge sending a bare `"type":"span"` item (not attached to a parent transaction) currently falls into `EnvelopeItemKind::Other` and is silently dropped. This story adds that second producer into the same `spans` table.

This story is item 1 (P0) of GH #143 ("remaining performance item types") and the hard blocking prerequisite for GH #180 ("AI Agent Monitoring") — `gen_ai.*` attribute normalization has nowhere to live without span data existing as first-class, queryable rows.

### Twin precedent: copy `LogsProcessor`'s shape, but NOT its wire format

Two existing standalone-item-type additions already establish the pattern to follow — read both before writing code:

- **`apps/server/src/digest/processors/logs.rs`** (`LogsProcessor`, added for GH #143's Log item type, commit `5d15af5`) — closest precedent for a *standalone* (non-transaction-child) item type: single DB transaction batching all rows from one payload, then `tx.commit()`; **no advisory lock**; **no rate-limit participation at all** (grep confirms `LogsProcessor` never touches `RateLimitService`) — this is the precedent Task 8 needs an explicit decision against, not a silent copy. `apps/server/src/routes/logs.rs` is also the closest route precedent — a single minimal `GET` list handler, nothing more.
- **`apps/server/src/digest/processors/transaction.rs`** (`TransactionProcessor::insert_span`) — closest precedent for the **spans table schema and column extraction** (`span_id, parent_span_id, op, description, status, segment_id, is_segment, duration_ms, exclusive_time_ms, tags JSONB, data JSONB`), and for the **route dispatch pattern in `routes/ingest.rs`** (`tokio::spawn` before the early-return, no temp-file/digest-worker involvement — spans have no grouping/issue concept, same as transactions).

**Critical divergence — do not copy blindly**: `LogsProcessor` parses an **item container** (`{"items":[OurLog, ...]}`, one envelope item can carry many log records — see `LogContainer::parse` in `models/log.rs`). Standalone `Span` items are **not** containerized in Relay's default (`legacy_spans`) pipeline — each envelope item holds exactly **one flat span JSON object** (`Annotated::<Span>::from_json_bytes`, confirmed against `relay-event-schema/src/protocol/span.rs` and real Relay test fixtures — no array/NDJSON body support for the plain `ItemType::Span` item). Multiple spans require multiple separate envelope items, which the existing envelope parser already handles item-by-item. `SpanProcessor::process` therefore parses **one span per call**, not a batch — much closer to `TransactionProcessor`'s single-object parse than to `LogsProcessor`'s container loop.

### Relay research: target `legacy_spans`, not `SpanV2`

Relay currently runs **two parallel pipelines** for `ItemType::Span`, gated by `Feature::SpanV2ExperimentalProcessing`:
```rust
// relay-server/src/processing/relay.rs:127-131 (SHA f42b1c8a1)
if !pi.has_feature(Feature::SpanV2ExperimentalProcessing) {
    run!(self.legacy_spans);   // DEFAULT — real SDK traffic today
}
run!(self.spans);              // opt-in, forward-looking
```
`legacy_spans` operates on the V1 `Span` struct and is what real SDKs get accepted through by default. `spans` (V2) is opt-in/experimental and — critically — **requires a DSC (`trace` envelope header)**, while `legacy_spans` does **not** (confirmed: `legacy_spans::Error` has no missing-DSC variant at all; two real Relay integration test fixtures send standalone spans with zero `trace` header and are accepted). Implementing against `SpanV2`'s DSC requirement would reject valid real-world traffic — this is why AC #3 explicitly forbids requiring it.

**V1 `Span` field reference** (relay-event-schema/src/protocol/span.rs#L17-127, SHA f42b1c8a1) — the fields Rustrak's `spans` table should be able to hold, most already present per the existing schema: `timestamp` (required), `start_timestamp` (required), `exclusive_time` (optional, ms), `op` (optional, max 128 chars), `span_id` (required), `parent_span_id` (optional), `trace_id` (required), `segment_id` (optional — self-referential to `span_id` when `is_segment: true`), `is_segment` (optional bool), `status` (optional), `description` (optional, no schema-level max length — Relay truncates downstream at the tag-extraction stage instead, ~200 bytes, out of scope here), `tags` (optional object), `origin` (optional, max 128 chars), `data`/`SpanData` (optional — ~80 named OTel/GenAI attributes + a generic catch-all `other` object for anything unrecognized), `measurements`, `platform`, `kind` (OTel SpanKind). **No `duration` field exists** — always computed as `timestamp - start_timestamp`.

**Real wire-format example** (from `tests/integration/test_spans_standalone.py:1064-1085`):
```json
{
  "op": "http.client",
  "data": {"http.request.method": "GET", "http.route": "https://example.com"},
  "description": "Test span",
  "parent_span_id": "8a6626cc9bdd5d9b",
  "span_id": "9fd17741416e8e4e",
  "start_timestamp": 1234567890.0,
  "timestamp": 1234567890.5,
  "trace_id": "d3d20f000885466b8c8f947c9b92b8d3",
  "origin": "manual",
  "exclusive_time": 0,
  "measurements": {},
  "segment_id": "8a6626cc9bdd5d9b",
  "is_segment": false
}
```
Envelope item header: `"type":"span"`, `"content_type":"application/json"`.

**Segment semantics**: a "segment" is the subtree rooted at whichever span in a trace has `is_segment: true` (conceptually the old "transaction" root, expressed natively as a span). `segment_id` equals that root span's own `span_id`, and every descendant span carries the same `segment_id`. Relay's own ingestion processors do **not** assemble this tree — it's a downstream/query-time concern, matching this story's explicit non-goal on trace/segment assembly.

**Validation Relay actually enforces at ingestion** (the baseline this story replicates): `span_id` parseable and present (else `DiscardReason::InvalidSpan`), `start_timestamp <= timestamp` with both present (else `DiscardReason::Timestamp`). No hard-coded max-spans-per-envelope count exists — bounded only by overall envelope size limits, which Rustrak already enforces (1MB per item / 100MB per body in `ingest/parser.rs` — standalone spans should fall under the existing generic `MAX_ITEM_SIZE`, no special-casing needed, matching how Relay's own per-item size cap is enforced upstream of the span processor rather than inside it).

**Rate limiting reference (Relay's own behavior, informs Task 8's decision)**: Relay tracks two DataCategories for spans — `Span` (coarse, hard-reject when exhausted) and `SpanIndexed` (full-storage, soft-downgrade when exhausted) — because production span volume typically dwarfs error volume. Rustrak's existing quota system (global + per-project, minute + hour windows, no per-DataCategory split) is coarser than Relay's, but the underlying motivation — spans arrive at much higher volume than errors — is the reason this story's default recommendation (AC #8) is to have spans participate in quota, unlike transactions today.

*(Relay repo pinned at SHA `f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f`; re-verified clean against `origin/master` `9b930e710` — the 20 intervening commits only touch an internal `TotalCategory` trait refactor and add a cosmetic `normalize_segment_name` flag, no behavior change relevant to this story.)*

### Explicitly out of scope for this story

(Relay itself defers all of these past its own ingestion stage too — this is not Rustrak cutting corners relative to Relay, it's matching where Relay actually draws the line)

- Per-field PII scrubbing of `SpanData`'s ~80 named attributes — store `data` as opaque JSONB for now (same tradeoff `TransactionProcessor::insert_span` already accepts)
- Inbound filters (browser/IP rules)
- Segment-tree/trace assembly (a future `GET /traces/{trace_id}` endpoint, made easier but not built by this story's `(project_id, trace_id)` index)
- `SpanV2` / mandatory DSC
- `gen_ai.*` attribute normalization — that's GH #180's job, blocked on this story landing first

### Project Structure Notes

- **New files**: `apps/server/src/digest/processors/span.rs`, `apps/server/src/services/span.rs`, `apps/server/src/routes/spans.rs`, migration pair in both `migrations/postgres/` and `migrations/sqlite/`
- **Modified files**: `apps/server/src/ingest/envelope.rs` (new enum variant), `apps/server/src/routes/ingest.rs` (new match arm), `apps/server/src/digest/processors/mod.rs` (new `Route` variant + `Processors` field), `apps/server/src/models/transaction.rs` (extend `SpanResponse`), `apps/server/src/pagination/mod.rs` (new `ListSpansQuery`), `apps/server/src/main.rs` (register route), `apps/server/src/openapi.rs` (register paths/schemas), `apps/server/openapi.json` (regenerated)
- Dual-backend discipline is non-negotiable per `project-context.md`: `sqlite` is the default feature, `postgres` is opt-in — every new query must work on both; migrations must exist in both `migrations/postgres/` and `migrations/sqlite/` directories with matching filenames
- No conflicts detected with the "cursor-pagination only on issues/events" project rule — spans, like transactions and logs, are an established exception using offset pagination (`OffsetPaginatedResponse<T>`), not a new divergence introduced by this story

### References

- [Source: apps/server/src/digest/processors/logs.rs] — standalone-item-type precedent (container parsing, single-tx batch commit, no advisory lock, no rate-limit call)
- [Source: apps/server/src/digest/processors/transaction.rs#insert_span] — `spans` table column extraction precedent
- [Source: apps/server/src/routes/logs.rs] — minimal single-list-endpoint route precedent to mirror for `routes/spans.rs`
- [Source: apps/server/src/models/log.rs, apps/server/src/services/log.rs] — `LogFilters`/`list_offset` filter-guard pattern precedent
- [Source: apps/server/migrations/postgres/20260626000000_create_logs.up.sql] — migration comment convention (references the GH issue), retention-key column convention (`ingested_at` + `project_id`)
- [Source: apps/server/migrations/postgres/20260624000001_create_spans.up.sql] — existing `spans` table schema being extended (not replaced) by this story
- [Source: _bmad-output/project-context.md#Rust Anti-Patterns] — "Rate limit check MUST happen in both ingest (sync) and digest (async) phases — not just one"
- [Relay source, SHA f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f] `relay-server/src/processing/relay.rs#L127-L131` (legacy vs V2 pipeline split), `relay-server/src/processing/legacy_spans/mod.rs` (no DSC requirement), `relay-event-schema/src/protocol/span.rs#L17-L127` (V1 `Span` field reference), `tests/integration/test_spans_standalone.py#L1064-L1085` (real wire-format fixture)
- GitHub: blocks #180 (AI Agent Monitoring), is item 1 of #143 (remaining performance item types)

## Dev Agent Record

### Agent Model Used

_(populated at dev time)_

### Debug Log References

### Completion Notes List

### File List
