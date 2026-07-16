# Story: AI Agent Monitoring (`gen_ai.*` spans + dedicated Agents page)

Status: ready-for-dev

<!-- Standalone story (no epic/PRD numbering — implementation-artifacts uses flat spec-*.md/story-*.md files, no sprint-status.yaml in this project). -->
<!-- Full-scope story per explicit owner decision: backend + frontend in one story, not split into phases, despite the size/review-risk tradeoff being called out and accepted. -->

> **Implementation workflow — backend: TDD mandatory, strict red→green→refactor per task, vertical-sliced.** `apps/webview-ui` has **no test framework configured today** (verified: no `vitest`/`jest`/`playwright`/`testing-library` in `apps/webview-ui/package.json`, no `test` script). Frontend tasks (7–10) proceed **without automated tests** — this is a deliberate, explicitly-flagged exception, not a silent skip. Setting up frontend test infra is a separate scoping decision, out of this story.

## Story

As an operator running Rustrak for services instrumented with AI/LLM SDKs (OpenAI, Anthropic, LangChain, LangGraph, Vercel AI SDK, etc.),
I want a dedicated Agents monitoring page showing agent runs, estimated cost, token usage, and tool calls,
so that I can observe AI agent behavior and spend without needing Sentry SaaS — this is GitHub issue #180.

## Context

Sentry's real "AI Agent Monitoring" is not a new envelope item or storage system — it's a product layer entirely on top of the span pipeline, using OTel GenAI semantic-convention span attributes (`gen_ai.*`), with Relay doing real enrichment/normalization (model defaulting, operation-type inference, cost calculation) before storage. This story ports that to Rustrak now that spans exist as first-class data (GH #143 item 1 / story-span-ingestion.md, merged PR #184 — `spans` table shared by standalone spans and transaction-embedded spans, `SpanProcessor`, `TransactionProcessor::insert_span`, `SpanService`, `GET /api/projects/{id}/spans`).

**DynamicSamplingContext (DSC) is NOT a dependency of this story** — investigated and closed out this session (see BOND.md). DSC is a SaaS multi-tenant sampling/billing concern; Rustrak drops nothing and needs none of it. Do not add DSC parsing as part of this work.

## Acceptance Criteria

**Backend**

1. A span is recognized as an "AI span" (triggers gen_ai normalization) if its `data` payload has `gen_ai.operation.type` OR `gen_ai.operation.name` present, OR its `op` starts with `"gen_ai."` or `"ai."` — mirrors Relay's `is_ai_item()`. Non-AI spans are completely unaffected: no gen_ai columns populated, no normalization applied, zero behavior change from today.
2. `gen_ai.operation.type` is inferred when absent from `gen_ai.operation.name` (preferred) or the span's `op`, using Relay's exact `infer_ai_operation_type` mapping (see Dev Notes §Normalization algorithm) — defaulting to `"ai_client"` when the span is recognized as AI but nothing else matches.
3. `gen_ai.response.model` defaults from `gen_ai.request.model` when absent (only if the latter is present).
4. `gen_ai.agent.name` defaults from `gen_ai.function_id` when absent (Vercel AI SDK compat — Vercel's SDK sends `function_id` instead of the standard attribute).
5. `gen_ai.usage.total_tokens` is computed as `input + output` when absent, only if at least one of `gen_ai.usage.input_tokens`/`gen_ai.usage.output_tokens` is present.
6. This normalization is a **single shared function**, called identically from both `SpanProcessor::process` (standalone spans) and `TransactionProcessor::insert_span` (transaction-embedded spans) — not duplicated. A transaction-embedded LLM-call child span must be normalized exactly the same way as a standalone one.
7. Denormalized columns exist on `spans` for the fields the dashboard widgets filter/aggregate on: `gen_ai_operation_type`, `gen_ai_agent_name`, `gen_ai_request_model`, `gen_ai_response_model`, `gen_ai_tool_name`, `gen_ai_conversation_id`, `gen_ai_usage_input_tokens`, `gen_ai_usage_output_tokens`, `gen_ai_usage_total_tokens`, `gen_ai_cost_input_tokens`, `gen_ai_cost_output_tokens`, `gen_ai_cost_total_tokens`. All nullable — populated only for recognized AI spans. The full raw payload (all ~80 possible `gen_ai.*` attributes, including request/response message bodies) stays in the existing `data` JSONB column verbatim, unchanged from today's storage.
8. A self-maintained model pricing table (checked into the repo, documented update path — see Dev Notes §Pricing table) maps model id → cost-per-token (input/output/cached/cache-write/reasoning). When `gen_ai.response.model` is in the table AND at least one usage token field is present, `gen_ai.cost.*` fields are computed using Relay's exact formula (Dev Notes §Cost formula). Unknown model or zero tokens → no cost written, not an error.
9. `GET /api/projects/{id}/spans` gains an `operation_type` query filter (`SpanFilters.operation_type`), same `($n IS NULL OR col = $m)` guard pattern as the existing `op`/`status`/`trace_id` filters.
10. New service methods (and routes, if the shape doesn't fit the existing list endpoint) power all 7 dashboard widgets — see Dev Notes §Widget-to-query mapping for exact requirements per widget.
11. `cargo test` passes on both `sqlite` (default) and `postgres` feature flags. New migration pair in both `apps/server/migrations/postgres/` and `apps/server/migrations/sqlite/`.
12. `apps/server/openapi.json` regenerated and committed for any new/changed routes.

**Frontend**

13. `@rustrak/client` has a `SpansResource` covering the current `spans` table shape (including `platform`/`release`/`environment`/`tags`/`data` and the new `gen_ai_*` fields) — the existing `spanSchema` in `packages/client/src/schemas/transaction.ts` is the OLD transaction-embedded-only shape and does not cover this.
14. A dedicated page at `/projects/[id]/agents` renders the 7 widgets (Agent Runs over time, Estimated Cost over time, Duration avg+p95, LLM Calls by Model, Tokens Used by Model, Tool Calls by Tool, Traces table) using `recharts` (already a dependency) and existing UI conventions (`Card`, CSS-var colors) — no new chart library, no new color palette.
15. A detail/drill-down view for a single agent run/trace shows a span waterfall adapted from the existing `performance/[txnId]/span-waterfall.tsx`, with `gen_ai.*`-aware coloring and attribute display (model, tokens, cost) instead of the generic op-based version.
16. "Agents" is added to `project-sidebar.tsx`'s nav, positioned after "Performance".
17. Data-fetching follows the existing Server Component → Server Action → `@rustrak/client` pattern — no client-side fetching.

## Tasks / Subtasks

### Backend (implement first — frontend depends on these endpoints existing)

- [x] **Task 1 — DB schema** (AC: #7, #11) — `migrations/{postgres,sqlite}/20260714000001_gen_ai_span_fields.{up,down}.sql`. 12 nullable columns + 3 indexes, plain `ADD COLUMN` (no table recreate). Verified applying cleanly on both dialects via existing `TestDb` tests.
- [x] **Task 2 — Shared gen_ai normalization module** (AC: #1, #2, #3, #4, #5, #6) — `services/gen_ai.rs`: `is_ai_span`, `infer_operation_type` (exact port, all match arms), `normalize_gen_ai_attributes`. 24 pure unit tests (`tests/unit/gen_ai_test.rs`), all green.
- [x] **Task 3 — Wire normalization + denormalized columns into both producers** (AC: #6, #7) — `extract_gen_ai_columns` (in `services/gen_ai.rs`) is the single shared entry point called from both `SpanProcessor::process` and `TransactionProcessor::insert_span` (the latter's signature changed to take an owned `serde_json::Value` instead of `&Value` to allow in-place mutation for normalization). 3 DB-level tests per producer confirming identical behavior, all green on both dialects.
- [x] **Task 4 — Model pricing table + cost calculation** (AC: #8) — `services/gen_ai_pricing.rs`: static `PRICING_TABLE` (15 models: OpenAI/Anthropic/Google families), exact/longest-prefix lookup, `calculate_cost`/`calculate_cost_with_rates` (exact port of Relay's formula, rates split out for direct formula testing). 10 unit tests, all green.
- [x] **Task 5 — Query/aggregation service methods** (AC: #9, #10) — `SpanFilters.operation_type` added; `SpanService` extended with `agent_runs_timeseries`, `estimated_cost_timeseries`, `agent_duration_timeseries` (avg+p95, reuses `transaction::percentile_cont` — promoted to `pub(crate)`), `llm_calls_by_model`, `tokens_by_model`, `tool_calls_by_tool`, `agent_traces` (+ `representative_span` two-step follow-up, mirroring `TransactionService::stats`). Dual-backend time-bucketing mirrors `services/session.rs` exactly (`pg_span_time_filter`/`sqlite_span_time_filter`, `AssertSqlSafe`). 9 tests, all green on both dialects.
- [x] **Task 6 — Routes + OpenAPI** (AC: #10, #12) — new `routes/agents.rs` under `/api/projects/{id}/agents/{runs,cost,duration,models/calls,models/tokens,tools,traces}`, registered in `main.rs` + `openapi.rs`, spec regenerated (717 lines added). 8 HTTP-level tests, all green on both dialects.

**Backend fully verified**: full `cargo test` suite green on both `sqlite` (302 unit + 279 integration, 0 failed) and `postgres` (full regression, 0 failed). `cargo fmt --check` / `cargo clippy` clean throughout.

### Frontend

- [ ] **Task 7 — `@rustrak/client` `SpansResource`** (AC: #13)
  - [ ] `packages/client/src/schemas/spans.ts` — full `spans` table shape including the 12 new `gen_ai_*` fields (all optional/nullable in the Zod schema)
  - [ ] `packages/client/src/resources/spans.ts` — `SpansResource extends BaseResource`, `list()` using `this.validate(data, offsetPaginatedResponseSchema(spanSchema))` (mirror `TransactionsResource.list`), plus whatever methods the new aggregation endpoints from Task 6 need
  - [ ] Register on `RustrakClient` in `client.ts`

- [ ] **Task 8 — Agents page** (AC: #14, #17)
  - [ ] `apps/webview-ui/src/app/(main)/projects/[id]/agents/page.tsx` — Server Component, fetches via new Server Actions in `src/actions/agents.ts` (`'use server'` → `createClient()` → `client.spans.*`/`client.agents.*`)
  - [ ] KPI tiles for Agent Runs / Estimated Cost using `Card size="sm"` + `CardHeader/CardTitle`/`CardContent`, pattern from `overview-score-cards.tsx`
  - [ ] Bar charts (Agent Runs over time, LLM Calls by Model, Tokens by Model, Tool Calls by Tool) and line chart (Duration avg/p95) via `recharts`, styling pattern from `event-chart.tsx` (`ResponsiveContainer`, hidden axis lines, `ChartTooltip`, `isAnimationActive={false}`), colors from `--chart-1`..`--chart-5` CSS vars for multi-series, `--primary` for single-series
  - [ ] Traces table: hand-rolled flex-div list + `useRouter()`/`useTransition()` pagination, pattern from `transaction-stats-table.tsx`/`transactions-list.tsx` — NOT the shadcn `<Table>` primitive

- [ ] **Task 9 — Agent-run detail/waterfall** (AC: #15)
  - [ ] `apps/webview-ui/src/app/(main)/projects/[id]/agents/[traceId]/page.tsx` (or similar — decide the identity key: trace_id vs a synthetic "run id"; trace_id is simplest and consistent with how the backend already groups)
  - [ ] Adapt `performance/[txnId]/span-waterfall.tsx` directly — reuse `buildTree`/DFS-flatten/collapse-state logic verbatim, replace `opColor()` with a `gen_ai.operation.type`-aware palette (agent/tool/ai_client/handoff each a distinct `--chart-N` color), replace/extend `SpanDetail`'s field list to surface `gen_ai.*` attributes (model, token usage, cost) from the span's `data` JSONB

- [ ] **Task 10 — Nav entry** (AC: #16)
  - [ ] `project-sidebar.tsx`: add `{ href: '/projects/${projectId}/agents', label: 'Agents', icon: Bot }` (or `Sparkles`) to `navItems`, positioned after Performance

## Dev Notes

### Normalization algorithm (Relay's `normalize_ai()`, exact port target)

Source: `relay-event-normalization/src/normalize/span/ai.rs`, relay-repo SHA `f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f`.

`is_ai_item()`: AI span if `gen_ai.operation.type` present, OR `gen_ai.operation.name` present, OR span `op` starts with `"gen_ai."` or `"ai."`.

`infer_ai_operation_type(op_name)` — full match unless noted as prefix:
| Match | → operation_type |
|---|---|
| `ai.run.generateText`, `ai.run.generateObject`, `gen_ai.invoke_agent`, `ai.pipeline.generate_text`, `ai.pipeline.generate_object`, `ai.pipeline.stream_text`, `ai.pipeline.stream_object`, `gen_ai.create_agent`, `invoke_agent`, `create_agent` | `agent` |
| `gen_ai.execute_tool`, `execute_tool` | `tool` |
| `gen_ai.handoff`, `handoff` | `handoff` |
| `ai.processor`, `processor_run` | `other` |
| prefix `ai.streamText.doStream` | `ai_client` |
| prefix `ai.streamText` (else) | `agent` |
| prefix `ai.generateText.doGenerate` | `ai_client` |
| prefix `ai.generateText` (else) | `agent` |
| prefix `ai.generateObject.doGenerate` | `ai_client` |
| prefix `ai.generateObject` (else) | `agent` |
| prefix `ai.toolCall` | `tool` |
| no match | `None` → caller defaults to `"ai_client"` (`DEFAULT_AI_OPERATION`) |

Orchestration order (`normalize_ai`): `normalize_model` (response.model ← request.model) → `normalize_ai_type` (operation.type inferred, default `ai_client`) → `normalize_total_tokens` (sum if missing) → [tokens-per-second, context-utilization — both explicitly out of scope, see Non-goals] → cost calculation last (needs the now-resolved response.model).

Separately (`enrich_ai_span_data`, same file): default `gen_ai.agent.name` from `gen_ai.function_id` when missing.

### Cost formula (Relay's `calculate_costs`, exact port target)

Source: `relay-event-normalization/src/normalize/span/ai.rs`, same SHA.

Inputs: `UsedTokens { input_tokens, input_cached_tokens, input_cache_write_tokens, output_tokens, output_reasoning_tokens }` (all `f64`, extracted from `gen_ai.usage.*`), `ModelCostV2 { input_per_token, output_per_token, output_reasoning_per_token, input_cached_per_token, input_cache_write_per_token }` (from the pricing table, per model).

```
raw_input_tokens  = input_tokens - input_cached_tokens - input_cache_write_tokens
raw_output_tokens = output_tokens - output_reasoning_tokens

cost.input  = raw_input_tokens * input_per_token
            + input_cached_tokens * input_cached_per_token
            + input_cache_write_tokens * input_cache_write_per_token

reasoning_rate = output_reasoning_per_token if > 0.0 else output_per_token   # fallback
cost.output = raw_output_tokens * output_per_token
            + output_reasoning_tokens * reasoning_rate
```

Returns `None` (no cost fields written) if `input_tokens == 0.0 && output_tokens == 0.0`. Negative costs ARE possible if token counts are internally inconsistent (e.g. cached > input) — Relay's own test `test_calculate_cost_negative` documents this as accepted, not an error to guard against.

### Pricing table

Rustrak cannot pull Sentry's live SaaS pricing config — needs its own static, checked-in table. Recommended source: an existing open dataset (e.g. LiteLLM's public `model_prices_and_context_window.json`) rather than hand-typing rates — cite the source and sync date in a code comment so future updates are a known, repeatable process, not a guess. Cover the models reachable by the `AgentIntegration` list from the original #180 issue body (openai, anthropic, google_genai at minimum — gpt-4/gpt-4o/o1, claude-3/3.5, gemini families). Context-window size (`gen_ai.context.window_size`) is optional per-model data, not required for v1 (see Non-goals).

### Widget-to-query mapping (Sentry's exact widget spec, `dashboards/utils/prebuiltConfigs/ai/aiAgentsOverview.ts`)

| Widget | Filter | Aggregation |
|---|---|---|
| Agent Runs (bar, time series) | `gen_ai_operation_type = 'agent'` | `count(*)` per time bucket |
| Estimated Cost (bar, time series) | `gen_ai_operation_type = 'ai_client'` | `sum(gen_ai_cost_total_tokens)` per time bucket — note the field name says "tokens" but it's actually a dollar cost total, matching Sentry's own (slightly misleading) naming |
| Duration avg+p95 (line, time series) | `gen_ai_operation_type IN ('agent', 'ai_client')` | `avg(duration_ms)`, `p95(duration_ms)` per time bucket — reuse `TransactionService`'s Rust-side `percentile_cont` (dual-backend portable, SQLite has no native `percentile_cont`) |
| LLM Calls by Model | `gen_ai_operation_type = 'ai_client'` | `GROUP BY gen_ai_response_model`, `count(*)`, top 3 |
| Tokens Used by Model | `gen_ai_operation_type = 'ai_client'` | `GROUP BY gen_ai_response_model`, `sum(gen_ai_usage_total_tokens)`, top 3 |
| Tool Calls by Tool | `gen_ai_operation_type = 'tool'` | `GROUP BY gen_ai_tool_name`, `count(*)`, top 3 |
| Traces table | any span with `gen_ai_operation_type IS NOT NULL` | per `trace_id`: duration, tokens, cost, tool usage — paginated |

### Existing precedents to mirror (all cited with file paths, do not reinvent)

- `apps/server/src/services/session.rs` — dual-backend time-bucketing (`pg_bucket_time_filter`/`sqlite_bucket_time_filter`, `floor(extract(epoch...))` vs `strftime`), `SessionTimeseriesPoint` response shape (`models/session.rs:136-141`). This is THE pattern for the 2 time-series widgets — do not design new bucketing SQL from scratch.
- `apps/server/src/services/transaction.rs` — `TransactionService::stats`/`stats_for_group`/`group_durations`, Rust-side `percentile_cont` (linear interpolation, dual-backend portable since SQLite lacks the native function), group-then-aggregate two-step pattern for the Traces widget.
- `apps/server/src/services/span.rs` (`SpanFilters`, `list_offset`) — filter-guard pattern to extend for `operation_type`.
- `apps/server/src/services/grouping.rs` — precedent for a pure-logic module (no DB) used by a processor, same shape Task 2's normalization module should take.
- `apps/webview-ui/src/components/event-chart.tsx` — recharts bar-chart styling convention (hidden axes, CSS-var colors, custom tooltip, `isAnimationActive={false}`).
- `apps/webview-ui/src/app/(main)/projects/[id]/overview-score-cards.tsx` — KPI tile pattern.
- `apps/webview-ui/src/app/(main)/projects/[id]/performance/[txnId]/span-waterfall.tsx` — full waterfall implementation to adapt, not rebuild.
- `apps/webview-ui/src/app/(main)/projects/[id]/performance/` (whole directory) — routing shape precedent (`page.tsx` list, `[id]/page.tsx` detail, `summary/page.tsx` query-param view).
- `packages/client/src/resources/transactions.ts` + `CLAUDE.md`'s "Adding a New Resource" recipe — for the new `SpansResource`.

### Explicitly out of scope for this story

- Replicating Sentry's generic prebuilt-dashboard/widget framework — confirmed no such framework exists in webview-ui and none should be built; the Agents page is hard-coded.
- Live pricing data from Sentry's SaaS infra — not accessible self-hosted; Rustrak ships its own static table (Task 4).
- Conversation-level UI (`gen_ai.conversation.id` grouping into a "Conversations" view).
- `DynamicSamplingContext` — confirmed irrelevant this session, not a dependency anywhere in this story.
- `gen_ai.context.window_size`/`gen_ai.context.utilization` (context window utilization) — lower priority, no dashboard widget needs it; add only if time allows once everything else lands.
- Per-field PII scrubbing of the full `gen_ai.*` attribute set (request/response message bodies, ~80 possible fields) — stays opaque JSONB in `data`, per the span-ingestion story's already-accepted tradeoff. A coarser data-collection opt-out (redact/drop message bodies entirely) is a plausible future story, not this one.
- Frontend automated tests — no test framework exists in `apps/webview-ui` today (verified). Setting one up is a separate, explicit future decision.

### Project Structure Notes

- Backend new files: `apps/server/src/services/gen_ai.rs` (normalization), pricing data file (Task 4), migration pair, possibly `apps/server/src/routes/agents.rs` if aggregation endpoints don't fit `routes/spans.rs`
- Backend modified files: `apps/server/src/digest/processors/span.rs`, `apps/server/src/digest/processors/transaction.rs`, `apps/server/src/services/span.rs`, `apps/server/src/routes/spans.rs`, `apps/server/src/main.rs`, `apps/server/src/openapi.rs`, `apps/server/openapi.json`
- Frontend new files: `packages/client/src/schemas/spans.ts`, `packages/client/src/resources/spans.ts`, `apps/webview-ui/src/actions/agents.ts`, `apps/webview-ui/src/app/(main)/projects/[id]/agents/**`
- Frontend modified files: `packages/client/src/client.ts`, `apps/webview-ui/src/app/(main)/projects/[id]/project-sidebar.tsx`
- Dual-backend discipline non-negotiable for every backend change: `sqlite` default, `postgres` opt-in feature flag, `#[cfg(feature = "postgres")]` splits only where dialect truly differs (as `session.rs` already demonstrates for bucketing).

### References

- [Source: apps/server/src/digest/processors/span.rs, apps/server/src/digest/processors/transaction.rs] — the two producers Task 2/3's normalization must hook into identically
- [Source: apps/server/src/services/session.rs#L1-50] — time-bucketing pattern for Task 5's time-series widgets
- [Source: apps/server/src/services/transaction.rs#stats] — group-aggregation + percentile pattern for Task 5
- [Sentry monolith, SHA a32a33a5106ce9350ccb33b406695f53067c4a9f] `static/app/views/insights/types.tsx#L100-126` (gen_ai.* field list), `static/app/views/dashboards/utils/prebuiltConfigs/ai/aiAgentsOverview.ts` (exact 7-widget spec)
- [Relay, SHA f42b1c8a15bba8cb96d1dfd3bd2b3158c7817c5f] `relay-event-normalization/src/normalize/span/ai.rs` (normalize_ai, infer_ai_operation_type, calculate_costs — full algorithm)
- GitHub: implements #180, built on #143/PR #184 (story-span-ingestion.md)

## Dev Agent Record

### Agent Model Used

_(populated at dev time)_

### Debug Log References

### Completion Notes List

### File List
