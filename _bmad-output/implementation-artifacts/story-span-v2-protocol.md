# Story: Sentry Spans Protocol v2 Ingestion (`application/vnd.sentry.items.span.v2+json`)

Status: ready-for-dev

<!-- Standalone story. Discovered as a blocking gap while validating GH #180 (AI Agent Monitoring, story-ai-agent-monitoring.md) against a REAL @sentry/node 10.65 SDK + Vercel AI SDK integration test — not a hand-rolled envelope. Investigated by Rusty (agent-rusty skill) against relay-repo @ f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f (github.com/getsentry/relay), 2026-07-16. -->

## Why this exists

`story-ai-agent-monitoring.md` (GH #180) implemented `gen_ai.*` normalization and denormalized columns against the **legacy standalone-span wire format**: one envelope item per span, `{"type":"span"}` header, flat JSON payload (`span_id`, `trace_id`, `op` at top level, attributes under `data: {...}}`). That implementation is fully tested and correct **for that format**.

The problem: a real, current Sentry SDK (`@sentry/node@10.65.0` + `ai@6.0.33`'s `vercelAIIntegration()`) does not send that format for OTel-instrumented spans — including every AI Agent Monitoring span. It sends **Spans Protocol v2** (`application/vnd.sentry.items.span.v2+json`), a batched container with a completely different shape: no top-level `op`, typed key/value attributes, `end_timestamp` instead of `timestamp`, `name` instead of `description`. Rustrak's ingest pipeline does not recognize this content type at all — items dispatch into `EnvelopeItemKind::Other` and are silently dropped, or (if the item's bare `"type":"span"` header is matched without checking content type) get force-fed into `SpanProcessor::process` and rejected with `Validation("span missing span_id")` — which is what actually happened in the reproduction below.

**Net effect: as shipped, #180 receives zero data from any current Sentry SDK's automatic AI/OTel instrumentation.** Only a hand-crafted legacy-format envelope (like the one used to build/test #180) would ever populate the Agents page. This story closes that gap.

## Reproduction (source of truth for the wire format below)

`packages/test-sentry/demo/src/ai-agent{,-instrument}.ts` (added this session, `pnpm demo:ai-agent`): `generateText()` from the real `ai` package, tool-calling multi-step agent loop, `MockLanguageModelV3` standing in for the LLM (no network/API key needed), instrumented by the real `Sentry.vercelAIIntegration()`. Captured raw envelope bytes via a local HTTP echo server acting as the DSN target. Full captured payload structure below is a direct transcript of what the real SDK put on the wire, not a synthetic reconstruction.

## The wire format

### Envelope-level: two items for one trace, not one

For this SDK/config (root `generateText()` call with no pre-existing active span), the trace's ROOT span and its CHILDREN go out in **two different item types in the same envelope**:

1. One `"type":"transaction"` item (the pre-existing legacy transaction event format Rustrak already parses) — its `contexts.trace` object carries the root span's own op/status/attributes (including gen_ai.* — Sentry's JS SDK client-side rolls up child token/cost totals onto this root context via `applyAccumulatedTokens`, see `@sentry/core/build/esm/tracing/vercel-ai/index.js`'s `vercelAiEventProcessor`). Its `spans: []` array is **always empty** for this SDK version — child spans never land there.
2. One `"type":"span"` item, `content_type: "application/vnd.sentry.items.span.v2+json"`, `item_count: <n>` — a **batch container** holding the non-root children (in the captured trace: two `generate_content` LLM-call spans + one `execute_tool` span).

Relay confirms this two-container design in source: `ContainerItem for relay_event_schema::protocol::SpanV2` binds `ItemType::Span` to `ContentType::SpanV2Container` with `Header = NoHeader` (no per-item header beyond `item_count`) — [relay-server/src/envelope/container.rs#L380-L386](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-server/src/envelope/container.rs#L380-L386).

Note: a root/segment span **can** also be sent through the same v2 container mechanism (`"is_segment": true` on one entry of the batch) — see Relay's own basic fixture, `tests/integration/test_spansv2.py`. The transaction-event bridging above is specific to this SDK's current OTel-exporter behavior when there's no separate legacy transaction concept in play, not an inherent v2 requirement. **A v2 ingestion path must accept `is_segment: true` items as legitimate root spans on their own — do not assume the root always arrives via a transaction event.**

### Payload shape (the v2 container item)

```json
{
  "version": 2,
  "items": [
    {
      "trace_id": "800087bbed8c481faaabed73e41e5d4b",
      "span_id": "8a743a442038cceb",
      "parent_span_id": "8efc25d3729c267c",
      "name": "generate_content gpt-4o",
      "start_timestamp": 1784231017.8907192,
      "end_timestamp": 1784231017.893409,
      "status": "ok",
      "is_segment": false,
      "attributes": {
        "sentry.origin": { "value": "auto.vercelai.otel", "type": "string" },
        "sentry.op": { "value": "gen_ai.generate_content", "type": "string" },
        "gen_ai.operation.name": { "value": "generate_content", "type": "string" },
        "gen_ai.request.model": { "value": "gpt-4o", "type": "string" },
        "gen_ai.response.model": { "value": "gpt-4o", "type": "string" },
        "gen_ai.function_id": { "value": "research_agent", "type": "string" },
        "gen_ai.usage.input_tokens": { "value": 210, "type": "integer" },
        "gen_ai.usage.output_tokens": { "value": 34, "type": "integer" },
        "gen_ai.usage.total_tokens": { "value": 244, "type": "integer" },
        "...": "many more, see full capture in session log"
      }
    }
  ]
}
```

Source-verified against the actual struct — [relay-event-schema/src/protocol/span_v2/mod.rs#L13-L56](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-event-schema/src/protocol/span_v2/mod.rs#L13-L56):

| v2 field | Type | Rustrak `spans` column | Notes |
|---|---|---|---|
| `trace_id` | required | `trace_id` | same as legacy |
| `span_id` | required | `span_id` | same as legacy |
| `parent_span_id` | optional | `parent_span_id` | same as legacy |
| `name` | required | `description` | legacy has both `op` (semantic) and `description` (human label) as separate top-level fields; v2 only has `name`, and the semantic op lives in `attributes["sentry.op"]` |
| `status` | required, `"ok"\|"error"\|<other>` | `status` | subset of OTel — simpler than legacy's free-form status strings |
| `is_segment` | optional bool | `is_segment` | same concept as legacy |
| `start_timestamp` | required, float epoch seconds | `start_timestamp` | same as legacy |
| `end_timestamp` | required, float epoch seconds | `timestamp` | **renamed** — legacy calls this `timestamp` |
| `attributes` | typed map, see below | → `op` (from `attributes["sentry.op"]`) + `data` JSONB (unwrapped values) + the 12 `gen_ai_*` denormalized columns | see attribute unwrapping below |
| `links` | optional array | *(not currently modeled by Rustrak's `spans` table for legacy either — out of scope)* | span-to-span links, unrelated to AI Agent Monitoring |
| `segment_id` (legacy field) | *(no v2 equivalent)* | `segment_id` | v2 has no segment_id field at all — `is_segment: true` on a span makes it self-identifying as its own segment root; Rustrak should set `segment_id = span_id` when `is_segment` is true, else leave it derived from `parent_span_id`/existing convention, matching how standalone legacy spans already handle it |
| *(no top-level `op`)* | — | `op` | must be read from `attributes["sentry.op"].value`, defaulting to `attributes["gen_ai.operation.name"].value` if absent — see `derive_op_for_v2_span`/`normalize_sentry_op`, [relay-event-normalization/src/eap/mod.rs#L40-L50](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-event-normalization/src/eap/mod.rs#L40-L50) |

### Attribute unwrapping (`Attribute`/`AttributeValue`/`AttributeType`)

Source: [relay-event-schema/src/protocol/attributes.rs#L14-L20,61-65,137-176,240](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-event-schema/src/protocol/attributes.rs#L14).

Each attribute is `{"value": <json value>, "type": "boolean"|"integer"|"double"|"string"|"array"|<other string>}`. To reconstruct the flat `data: {...}` object Rustrak's existing `services/gen_ai.rs` normalization functions already operate on, unwrap every entry to `key → value` (drop the `type` wrapper — Rustrak doesn't need to validate type/value agreement the way Relay does for its Kafka schema; **that validation is a Relay-side concern for its own downstream storage strictness, not a wire-format requirement** — malformed combos can be passed through as-is or dropped defensively, implementer's choice, not a correctness requirement for self-hosted single-tenant storage).

## AI normalization: v2 has MORE fields than the legacy port, and 3 key names silently diverged

Rustrak's existing `services/gen_ai.rs::normalize_gen_ai_attributes` is a faithful port of the **legacy** normalization — [relay-event-normalization/src/normalize/span/ai.rs](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-event-normalization/src/normalize/span/ai.rs). Relay's **current, actively-maintained** equivalent for v2/EAP spans is a separate, larger function — [relay-event-normalization/src/eap/ai.rs#L22-L195](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-event-normalization/src/eap/ai.rs#L22), called from the v2 pipeline at [relay-server/src/processing/spans/process.rs#L255](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-server/src/processing/spans/process.rs#L255) (`if ctx.is_processing()` — Rustrak, being both ingest+digest in one process, always satisfies this, so: always apply).

**Shared logic (identical behavior, confirmed by reading both):** `is_ai_item`/`is_ai_span` (same 3-way check), `normalize_model` (response.model defaults from request.model), `normalize_ai_type`/`normalize_operation_type` (**reuses the exact same `infer_ai_operation_type`/`infer_operation_type` function** — [relay-event-normalization/src/eap/ai.rs#L86](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-event-normalization/src/eap/ai.rs#L86) calls `crate::span::ai::infer_ai_operation_type` — the LEGACY module. **Rustrak's `infer_operation_type` port does not need to change or be duplicated** — it's already correct for both formats.), `normalize_total_tokens` (same formula).

**v2-only, not yet in Rustrak (net-new work, not a fix):**
- `normalize_tokens_per_second` → `gen_ai.response.tokens_per_second = output_tokens / duration_seconds` when duration > 0 and output_tokens > 0 — [relay-event-normalization/src/eap/ai.rs#L108-L125](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-event-normalization/src/eap/ai.rs#L108).
- `normalize_context_utilization` → `gen_ai.context.window_size`/`gen_ai.context.utilization`, requires a model→context-size lookup table Rustrak does not have today — [relay-event-normalization/src/eap/ai.rs#L127-L151](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-event-normalization/src/eap/ai.rs#L127). **Recommendation: skip for this story** — no dashboard widget in #180 needs it, and it requires new pricing-table-adjacent data Rustrak doesn't maintain. Revisit only if a future widget wants context-window visualization.

**Bug found in existing Rustrak code — confirm and fix as part of this story:** `services/gen_ai.rs`'s `GenAiColumns` extraction (`apps/server/src/services/gen_ai.rs:73,75,78`) reads cache/reasoning token attributes under the **legacy** key names:

| Rustrak reads today (legacy key, still correct for legacy-format spans) | Real v2/EAP key (what every modern SDK actually sends) |
|---|---|
| `gen_ai.usage.input_tokens.cached` | `gen_ai.usage.cache_read.input_tokens` |
| `gen_ai.usage.input_tokens.cache_write` | `gen_ai.usage.cache_creation.input_tokens` |
| `gen_ai.usage.output_tokens.reasoning` | `gen_ai.usage.reasoning.output_tokens` |

Confirmed on both sides: legacy key names verified at [relay-event-schema/src/protocol/span.rs#L496-L515](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-event-schema/src/protocol/span.rs#L496) (`#[metastructure(field = "gen_ai.usage.input_tokens.cached")]` etc. — Rustrak's existing constants are byte-for-byte correct **for legacy-format spans**); v2 key names verified via literal test fixtures/snapshots in [relay-event-normalization/src/eap/ai.rs#L297-L305](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-event-normalization/src/eap/ai.rs#L297) (`"gen_ai.usage.cache_read.input_tokens" => 500` in `test_normalize_ai_all_tokens`, echoed unchanged in the snapshot). No bridging/alias exists between the two sets anywhere in Relay (`write_legacy_attributes`, [relay-event-normalization/src/eap/mod.rs#L859-L897](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-event-normalization/src/eap/mod.rs#L859), only bridges DB/HTTP/transaction attributes, never gen_ai ones) — they are two independently-evolved conventions that never converged.

**Practical consequence today:** any real SDK reporting prompt-cache or extended-reasoning token usage (increasingly common — OpenAI o1/o3 reasoning tokens, Anthropic/Bedrock prompt caching) gets `$0` cache/reasoning cost credit from Rustrak's pricing calculation, because the lookup keys never match what's actually on the wire. This bug exists independent of whether v2 ingestion ships — it's wrong for any v2-sourced span regardless.

## Recommendation

1. **Add v2 container ingestion as a genuinely new path**, not a rewrite of the legacy one — both formats are real, both must keep working (Relay itself still routes bare `{"type":"span"}` non-container items to `legacy_spans` — [relay-server/src/processing/legacy_spans/mod.rs#L99](https://github.com/getsentry/relay/blob/f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f/relay-server/src/processing/legacy_spans/mod.rs#L99)). Dispatch on **content_type**, not just the item's `"type"` header string, since both formats share `"type":"span"`.
2. **Reuse, don't duplicate**, `services/gen_ai.rs`'s `is_ai_span`/`infer_operation_type`/cost calculation — only the *key names* looked up for cache/reasoning tokens need to vary by source format (or: fix the lookup to check both key spellings unconditionally, simplest and avoids threading a "which format" flag through the whole call chain — recommended, see Task 3).
3. Do **not** implement `normalize_context_utilization` — no consumer needs it yet.
4. Root-span-via-transaction-event (`contexts.trace` never becoming a `spans` row) is a real completeness gap but **not a blocker** — Rustrak's existing `agent_traces` aggregation already sums cost/tokens bottom-up from child spans, so the dashboard functions correctly without it. Track as a follow-up, not a task in this story.

## Acceptance Criteria

1. An envelope item with header `{"type":"span"}` and `content_type: "application/vnd.sentry.items.span.v2+json"` is recognized as a distinct kind from the existing legacy standalone-span item (same `"type"` string, different content type — dispatch must check both).
2. The v2 payload (`{"version":2,"items":[...]}`) is parsed as a batch — every entry in `items[]` produces its own row in the `spans` table (multiple spans per envelope item, unlike the legacy one-span-per-item format).
3. For each v2 span entry: `attributes["sentry.op"].value` (defaulting to `attributes["gen_ai.operation.name"].value`, then to a Rustrak-chosen fallback if both absent — mirroring `derive_op_for_v2_span`'s intent, exact fallback value is an implementation decision since Rustrak has no need for Relay's full op-inference-by-resource-type logic) → `op` column. `name` → `description`. `end_timestamp` → `timestamp`. All attribute values unwrapped (drop the `{value,type}` wrapper) into the `data` JSONB column, same shape as legacy spans' `data` today.
4. `extract_gen_ai_columns` (the shared gen_ai normalization entry point) is called on the unwrapped `data` for every v2 span, identically to how it's already called for legacy spans and transaction-embedded spans — no new/duplicated normalization logic.
5. The cache/reasoning token bug is fixed: cost calculation checks **both** the legacy (`gen_ai.usage.input_tokens.cached` etc.) and v2 (`gen_ai.usage.cache_read.input_tokens` etc.) key spellings when extracting `UsedTokens`, regardless of which format the span arrived through. Existing legacy-format tests continue passing unchanged.
6. A trace containing spans that arrived via v2 and spans that arrived via the legacy/transaction path (mixed origin, same `trace_id`) is queryable as one coherent trace through the existing `GET /api/projects/{id}/spans?trace_id=...` and `/agents/traces` endpoints — no format-specific leakage into the API surface.
7. `is_segment: true` on a v2 span is honored as a legitimate root/segment span on its own (not dependent on a co-arriving transaction event).
8. `cargo test` passes on both `sqlite` and `postgres`. New migration not expected (no schema change — same `spans` table, same 12 gen_ai columns from #180).
9. The `packages/test-sentry/demo/src/ai-agent{,-instrument}.ts` demo (already added) is extended into a checked-in regression fixture/test once the format is supported end-to-end — running it against a live Rustrak instance should populate the Agents page with real data, not a validation error.

## Tasks / Subtasks (TDD, vertical-sliced — proposed breakdown, refine at dev time)

- [ ] **Task 1 — Envelope dispatch on content-type** — extend `ingest/envelope.rs`'s item-kind recognition to distinguish `{"type":"span"}` + `content_type: application/vnd.sentry.items.span.v2+json` (new kind, e.g. `EnvelopeItemKind::SpanV2Batch(Vec<u8>)`) from the existing bare `{"type":"span"}` (stays `EnvelopeItemKind::Span`). Confirm the envelope parser already exposes item `content_type` (check `ingest/parser.rs` — item headers include arbitrary fields per Sentry's spec, `content_type` should already be captured even if unused today).
- [ ] **Task 2 — V2 batch parser + attribute unwrapping** — new module (e.g. `digest/processors/span_v2.rs` or extend `services/gen_ai.rs`'s surface): parse `{"version":2,"items":[...]}`, one `SpanV2Entry`-shaped struct per item (mirror the field table above), unwrap `attributes` into a flat `serde_json::Map`, derive `op`/`description`/`timestamp` per the mapping table. Pure-function unit tests first (no DB).
- [ ] **Task 3 — Fix cache/reasoning token key lookup** — `services/gen_ai.rs`'s `UsedTokens`-equivalent extraction checks both legacy and v2 key spellings (`.or_else` chain or a small lookup helper trying both). Regression test using the v2 key names (currently would silently read `None`/0 cost — RED first).
- [ ] **Task 4 — Wire batch processor into digest pipeline** — a `SpanV2Processor` (or extend `SpanProcessor`) that loops the batch, INSERTs one row per entry into `spans` using the same INSERT shape as the existing `SpanProcessor`/`TransactionProcessor::insert_span` (reuse `extract_gen_ai_columns`). Dual-backend (sqlite + postgres) integration tests, real envelope fixtures built from the captured wire format in this story (not synthetic guesses).
- [ ] **Task 5 — `main.rs`/route wiring** — register the new item kind in the digest dispatch (`Route`/`Processor` exhaustive match — the compiler will force every existing match site).
- [ ] **Task 6 — End-to-end regression** — run `packages/test-sentry/demo/src/ai-agent.ts` against a live local Rustrak instance (sqlite dev server is enough), confirm `GET /api/projects/{id}/agents/traces` returns the real trace with correct agent name/tokens/cost, not empty.

## Open questions for dev time (not blocking, flag if they turn out to matter)

- Exact fallback `op` value when both `sentry.op` and `gen_ai.operation.name` are absent on a v2 span — Relay's `derive_op_for_v2_span` has resource-type-specific inference (DB, HTTP, etc.) Rustrak may not need to replicate in full; a simple default (e.g. `"default"`, matching Relay's own basic-fixture behavior) is likely sufficient.
- Byte size limits for the v2 container payload (`max_span_size`/`max_container_size` equivalents) — BOND.md already flags these as unconfirmed/not in the current relay-repo sparse checkout (`relay-config` not checked out). Not a functional blocker; Rustrak's existing generic per-item size limits (1MB) already apply at the envelope-parser level regardless of item kind.
