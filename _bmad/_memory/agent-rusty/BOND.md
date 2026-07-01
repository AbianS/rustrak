# Bond

## Basics
- **Name:** Abian
- **Call them:** Abian
- **Language:** Spanish

## Rustrak Implementation State
_What the owner has told me about Rustrak's current Sentry compatibility._

### Implemented
- Envelope parsing (newline-delimited format, item headers + payloads)
- `event` item type handling (only type currently processed)
- Decompression: gzip, deflate, brotli
- Auth: `X-Sentry-Auth` header + `?sentry_key=` query param (project sentry_key UUID validation)
- Rate limiting: 429 + `Retry-After` header (global + per-project, minute + hour windows)
- Envelope response: `{"id": "<uuid>"}` on success (200)
- Payload size limits: 1MB per item, 100MB max compressed body
- Async digest: grouping, issue creation, advisory locks per project

### Implemented (also in feat/source-map-processing, merged to main track)
- Source map upload protocol (3-step: capability check → chunk upload → assemble)
- Artifact bundle ZIP extraction with path traversal + symlink protection
- manifest.json parsing with `debug-id` / `debug_id` header support
- LocalSourceMapStore: filesystem CAS with atomic writes
- Assembly worker: background job with retry logic + crash recovery
- Frame rewriting (debug_meta.images → source map lookup → frame annotation)
- Frame rewriting called BEFORE grouping (correct ordering)

### In Progress
- feat/source-map-processing (current branch, PR under review)

### Known Missing
- `X-Sentry-Rate-Limits` header on 429 responses
- `/store/` endpoint functional implementation (currently returns 400)
- Transaction items — silently ignored
- Attachment items — silently ignored

### Transaction/Performance Implementation Status (verified 2026-06-23)
**State**: Basic MVP exists. Envelope parsing → TransactionProcessor → events table (event_type='transaction') → read-only GET endpoints. Missing significant Relay-level processing.

**Implemented:**
- `EnvelopeItemKind::Transaction(Vec<u8>)` in envelope enum and parser
- `TransactionProcessor` in `digest/processors/transaction.rs` — direct INSERT into `events`
- DB columns: `events.event_type`, `events.start_timestamp`, `events.spans` (JSONB)
- `TransactionService` — list_offset + get_by_id
- `GET /api/projects/{id}/transactions` + `GET /api/projects/{id}/transactions/{id}`
- `TransactionResponse` + `TransactionDetailResponse` models

**Missing (Transaction-specific vs Relay pipeline):**
| Gap | Relay Ref | Impact |
|-----|-----------|--------|
| No normalization (TransactionSource, TransactionInfo) | relay-event-normalization/src/transactions/ | SDK sends `source: "custom"`, Relay normalizes to `"route"`, `"url"`, etc. Rustrak stores raw. |
| No span extraction (spans stored raw JSONB, not indexed) | relay-server/src/processing/transactions/spans.rs | Spans are not searchable. No standalone span items created. |
| No metrics extraction from transactions | relay-server/src/processing/transactions/extraction.rs | Relay extracts latency, count, etc. metrics per transaction name+op. |
| No dynamic sampling | relay-sampling + relay-server DSC | All transactions stored, no sampling decision support. |
| No PII scrubbing | relay-event-normalization/src/transactions/processor.rs | PII in transaction names/payloads goes raw to DB. |
| No quota enforcement per DataCategory | relay-server/src/utils/rate_limits.rs | Transaction rate limiting uses same pool as error events. |
| No split Indexed/Total billing | relay-server/src/processing/transactions/mod.rs | Relay splits into 2 categories for billing. |
| No trace_id / DSC in envelope headers | relay-server/src/envelope/ | Rustrak ignores `trace` field in envelope headers entirely. |

### Performance Item Types NOT Implemented (beyond transactions)
Every one of these has its own `Processor` pipeline in Relay with dedicated Kafka topics:

| ItemType | Relay Pipeline | Description |
|----------|---------------|-------------|
| `Span` (standalone) | `SpansProcessor` — validate, DSC, normalize, filter, rate limit, store | OTel-style spans not attached to transactions. Different schema (`SpanV2`). |
| `Profile` | `ProfilesProcessor` — expand, validate, rate limit. Linked to transactions. | Continuous profiling. Arrives in same envelope as its transaction. |
| `ProfileChunk` | `ProfileChunksProcessor` — platform check, rate limit | Standalone profile chunks (Android continuous profiling). |
| `CheckIn` | `CheckInsProcessor` — normalize, rate limit | Cron monitoring. Kafka topic `Monitors`. |
| `ReplayEvent` + `ReplayRecording` + `ReplayVideo` | `ReplaysProcessor` — expand, validate, filter, PII scrub, rate limit | Session replay. Three item types share one `DataCategory::Replay`. |
| `Statsd` / `MetricBuckets` | Inline in processor.rs → internal metrics aggregator → Kafka `MetricsGeneric` | Custom metrics. Not rate limited by category. |
| `Log` | `LogsProcessor` — validate, DSC, filter, expand, normalize, rate limit | Standalone logs. Schema `OurLog` with trace_id + span_id. |
| `Integration` | Routes by content_type (OTel logs → LogsProcessor, OTel spans → SpansProcessor) | Integration items must be converted before forwarding. |
| `TraceMetric` | Inline in processor.rs | Trace-level metrics with trace_id + span_id. |

### Envelope Item Types Rustrak Handles
Current `EnvelopeItemKind` enum:
- `Event` ✓
- `Transaction` ✓ (basic)
- `Session` ✓
- `Sessions` ✓
- `Other` ✓ (catch-all, silently ignored)

Relay has 21+ `ItemType` variants. Rustrak handles 4 with dedicated types. The remaining 17 land in `Other` and are silently dropped.

### DynamicSamplingContext (DSC)
Relay parses `trace` field from envelope headers as `DynamicSamplingContext`. Used for: sampling decisions, span validation, metrics extraction. Contains `trace_id`, `public_key`, `release`, `environment`, `transaction`, `replay_id`, `sample_rate`, `user`. Rustrak does not parse or use this at all.

## Local Repo State
- **relay-repo SHA:** 97f9c4beab78baaa2d2be1f05dacaba0a987821d (2026-06-26)
- **relay-repo last updated:** 2026-06-29 (verified during issue #165 confirmation)
- **⚠️ pending upstream:** origin/master at ded5f96f8 — `git -C ~/.rusty/relay-repo pull` to refresh
- **sentry-data-schemas SHA:** 6d2c435b8ce3a67e2065f38374bb437f274d0a6c
- **sentry-data-schemas last updated:** 2026-05-22

## Known Protocol Gaps Already Investigated
_Gaps we've already dug into — so I don't repeat the same work. Append after each [AU] session._

| Gap | Status | Session | Notes |
|-----|--------|---------|-------|
| `X-Sentry-Rate-Limits` header | ❌ Missing | 2026-05-22 | Relay returns `retry_after:categories:scope:reason_code:namespaces`. Rustrak only returns `Retry-After`. Fix: add header with format `"<secs>:error:project"` minimum. Relay permalink: relay-server/src/utils/rate_limits.rs#L18 |
| `/store/` endpoint | ❌ Missing | 2026-05-22 | Relay accepts POST JSON body, wraps in envelope, returns `{"id":"..."}`. Rustrak returns 400. Affects legacy SDK users. Relay permalink: relay-server/src/endpoints/store.rs#L105 |
| `event_id` auto-generation | ⚠️ Different | 2026-05-22 | Relay: if event_id absent + envelope has event item, auto-generates UUID. Rustrak: returns 400. Relay permalink: relay-server/src/envelope/mod.rs#L290 |
| 429 response body format | ⚠️ Different | 2026-05-22 | Relay returns `{}` (empty). Rustrak returns `{"error":"rate_limit_exceeded","retry_after":N}`. Low impact — SDKs don't parse 429 body. |
| Source map: `abs_path` not cleared after frame rewrite | ✅ Fixed | 2026-05-25 | `frame["abs_path"] = null` added after rewrite in sourcemap.rs. TDD: test_rewrite_clears_abs_path. |
| Source map: chunk upload field name | ✅ Fixed | 2026-05-25 | Filter changed from `!= "file"` to `is_empty()`. Accepts any named field (real sentry-cli uses SHA1). TDD: test_chunk_upload_sha1_field_name_accepted. |
| Source map: `frame.data.sourcemap` not set | ✅ Fixed | 2026-05-25 | `frame["data"]["sourcemap"] = debug_id` added after rewrite. TDD: test_rewrite_sets_data_sourcemap. |
| Source map: no total bundle size limit | ✅ Fixed | 2026-05-25 | `max_bundle_size_bytes: usize` added to `assemble_bundle` signature. Worker passes `max_chunk_size_bytes * 64`. TDD: test_assemble_bundle_rejects_oversized_bundle. |
| **Issues full audit (GH #165)** | 📋 Confirmed | 2026-06-29 | 28 gaps. ALL verified against source both sides. Rustrak: `Issue` struct 16 fields, only `is_resolved`/`is_muted` booleans, PATCH-only API, no PUT/bulk/hashes/tags endpoints. Grouping confirmed gaps below. |
| #165 fingerprint coercion | ✅ Fixed in #165 | 2026-06-29 | grouping.rs:17 uses `.as_str().unwrap_or("")` → bool/number/null fingerprint elements collapse to `""`, merging distinct issues. Relay `LenientString` (relay-event-schema/src/protocol/types.rs:722-747 @97f9c4b): Bool→"True"/"False", U64/I64→to_string, F64→trunc().to_string(), null→skip. |
| #165 mechanism.synthetic in grouping | ✅ Fixed in #165 | 2026-06-29 | `mechanism.rs:113` synthetic:Annotated<bool>. When synthetic, Relay ignores exc type/value for grouping. Rustrak never checks it. |
| #165 grouping_config passthrough | ❌ Missing (low pri for self-host) | 2026-06-29 | `event.rs:435` grouping_config:Annotated<Object>. Rustrak single hardcoded algorithm. Acceptable for self-host MVP. |
| #165 status/substatus enum | ✅ Fixed in #165 | 2026-06-29 | 2 booleans vs Sentry 3-status+7-substatus state machine (not 6 — see next row, the "6" here was itself the miscount that later caused a real gap). Regression detection (`trigger_regression_alert` was dead_code, now wired up) implemented. |
| #165 substatus CHECK constraint missing `escalating` | ✅ Fixed | 2026-07-01 | PR #169 review-fix pass added Postgres/SQLite CHECK constraints on `status`/`substatus`/`priority`/`assignee_type` (CodeRabbit finding) and a matching `UpdateIssueState::validated_substatus()` guard in `models/issue.rs`. Both enumerated only 6 of the 7 substatus values from `docs/sentry-compat/issue-165-roadmap.md:75` (`new/ongoing/escalating/regressed/archived_until_escalating/archived_until_condition_met/archived_forever`) — `escalating` (standalone, distinct from `archived_until_escalating`) was silently dropped. Caught before commit: nothing in the current codebase sets `escalating` today (zero call sites), so no live bug, but the CHECK + validator would have permanently blocked it once an escalation-detection feature landed, without any obvious error pointing back here. Fixed by adding `SUBSTATUS_ESCALATING` const + CHECK-list entry in both migrations. `assignee_type IN ('user','team')` in the same migration is **unverified** — outside relay-repo/sentry-data-schemas scope (issue assignment is Sentry-monolith, not Relay), no contradicting evidence found, zero current call sites either way. |

## How They Work
{Preferences learned during First Breath and refined over sessions — how deep to go, raw source vs synthesis, what to emphasize.}

## Things They've Asked Me to Remember
{Explicit requests — protocol decisions, design choices, things to keep in mind across sessions.}

## Things to Avoid
{What doesn't work for them — e.g. "don't explain what an envelope is every session", "skip the basics".}
