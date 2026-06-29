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
- Attachment items — silently ignored (HIGH SDK reach; #143 does NOT cover this)

### NOTE: Log is now IMPLEMENTED (v0.8.0, verified 2026-06-29)
`EnvelopeItemKind::Log(Vec<u8>)` in envelope.rs:60, `digest/processors/logs.rs`.
Mirrors Relay LogsProcessor (expands `{"items":[OurLog,...]}`). Item #7 of issue #143 is DONE.

### NOTE: Crons / CheckIn IMPLEMENTED (branch feat/crons-monitors, 2026-06-29)
Item #4 of #143 done end-to-end. `EnvelopeItemKind::CheckIn` + `CheckInProcessor`
(upsert monitor by project+slug, schedule config via COALESCE, in_progress→ok
lifecycle, next_expected_at from cron/interval+timezone). `monitors` + `check_ins`
tables (dual PG/SQLite). `MonitorWorker` computes missed/timeout server-side
(mirrors Relay: `missed` cannot be ingested → coerced to unknown). Read API
`GET /monitors` + `/monitors/{slug}/checkins`. Client + MCP + webview-ui "Crons"
tab + test-sentry `demo:crons` (real @sentry/node `withMonitor`). Verified live
against the Postgres dev server. Schema ground truth: relay-monitors/src/lib.rs.
**Dialect bug caught live:** minute columns must be BIGINT in PG (read as i64);
SQLite tests miss it — see auto-memory project_sqlite_postgres_dialect_testing.

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
- **relay-repo SHA:** 97f9c4beab78baaa2d2be1f05dacaba0a987821d (changed externally from 4222d43; observed 2026-06-29)
- **relay-repo last updated:** 2026-06-29 (SHA refreshed by external pull, not by me)
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

## How They Work
{Preferences learned during First Breath and refined over sessions — how deep to go, raw source vs synthesis, what to emphasize.}

## Things They've Asked Me to Remember
{Explicit requests — protocol decisions, design choices, things to keep in mind across sessions.}

## Things to Avoid
{What doesn't work for them — e.g. "don't explain what an envelope is every session", "skip the basics".}
