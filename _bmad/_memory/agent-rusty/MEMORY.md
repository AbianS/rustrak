# Memory

_Curated long-term knowledge. Empty at birth — grows through sessions._

_This file is for distilled insights: protocol behaviors that surprised us, Rustrak implementation decisions, patterns in Relay's normalization logic, lessons learned. Not raw notes — those go in `sessions/YYYY-MM-DD.md`._

_Keep under 200 lines. Every token here loads every session — make each one count. See `references/memory-guidance.md` for full discipline._

---

## Source Map Protocol Facts (verified 2026-05-25)

**Relay does NOT process source maps.** It only forwards chunk-upload and artifact-bundle endpoints to the upstream backend. Quote from `relay-server/src/lib.rs`: *"sourcemap processing... of no concern to Relay."* For Rustrak, this means Rustrak IS the backend and must implement everything.

**sentry-cli v3 POLLS for state=ok.** The assemble endpoint is designed to be async — it returns `"created"` immediately, then sentry-cli polls until `"ok"`. The background worker is protocol-required, not overengineered.

**Two different "type" fields — do not confuse:**
- `event.debug_meta.images[n].type = "sourcemap"` (no underscore) — identifies a debug image in the event protocol
- `manifest.json files[path].type = "source_map"` (with underscore) — file type inside the artifact bundle ZIP

**chunk upload field name:** sentry-cli names each multipart field with the SHA1 of its content. The server MUST verify `computed_sha1 == field_name` and return 400 on mismatch — otherwise a corrupted upload causes an infinite "missing chunks" loop.

**ON CONFLICT clause for assembly_jobs:** The `SET` clause must include `chunks = EXCLUDED.chunks` — otherwise a re-assemble with a different chunk list silently uses stale chunks.

## Frontend IA Facts (verified 2026-07-03)

**"Release Health" is a dataset, not a destination, in Sentry's real frontend.** No page, tab, or button anywhere in `static/app/views/` is called "Release Health". It's embedded in: project dashboard score cards, the releases list (with a CTA to enable it), and a release's default "Overview" detail tab. When auditing whether Rustrak put a concept "in the right place," check first whether Sentry treats it as a navigable destination at all — often it doesn't, and the real fix is de-emphasizing a standalone UI element rather than relocating it.

**`/projects/:projectId/` is a dashboard in Sentry, never a redirect to issues** — and the issue stream itself is org-scoped (`/organizations/:orgId/issues/`), not nested under a project route. Two separate IA facts, easy to conflate.

## Span Protocol Facts (verified 2026-07-14, SHA f42b1c8a1)

**Two live span schemas, picked by feature flag not version.** Legacy `Span` (span.rs) is authoritative for standalone span ingestion by default; `SpanV2` (OTel-attribute-style, container wire format) only activates per-project via `projects:span-v2-experimental-processing`. For "what does a Sentry SDK send today," target legacy `Span`.

**`SpanData` is a fixed ~80-field typed struct (gen_ai_*/db_*/http_*/etc.), not a generic bag** — plus a catch-all `other: Object<Value>` for unknowns. PII scrubbing is resolved per-named-field via `relay_conventions`, defaulting to `Pii::True` for anything in `other`.

**`Span.duration` doesn't exist on the wire — always `timestamp - start_timestamp`, computed.** `description` has no schema-level max length (op/origin do, 128 chars); truncation is downstream in tag_extraction.rs, default 200 bytes (only confirmed via test scaffolding, canonical default lives in `relay-config`, outside current sparse checkout).

**`relay-config` and `relay-spans` crates are NOT in the sparse checkout** — use `git show <sha>:relay-spans/src/...` for read-only one-off reads of them rather than assuming they're absent from the repo entirely.

## AI/gen_ai Normalization Facts (verified 2026-07-17, SHA f42b1c8a1)

**Two AI-normalization impls that contradict each other — pick by caller, not by name.** `normalize/span/ai.rs` (legacy) serves `legacy_spans/normalize.rs:216` (standalone, DEFAULT) and `event.rs:337` (transaction-embedded). `eap/ai.rs` serves `processing/spans/process.rs:255` (SpanV2, opt-in flag only). **For Rustrak, legacy is authoritative on both paths.** They disagree on real behavior: legacy's `is_ai_span` ignores `gen_ai.operation.type` (eap's `is_ai_item` checks it); legacy's `set_total_tokens` preserves an existing total (eap overwrites); only legacy defaults `agent.name` from `function_id`. Citing "Relay does X" is meaningless here without naming which impl.

**`gen_ai.operation.type` is Sentry's DERIVED field, not SDK data — that's the whole rule.** SDKs send `operation.name` (OTel semconv); Relay computes `type` from it and overwrites unconditionally in both impls ("aggressively overwrites... to guarantee a consistent data set for the AI product module"). Hence the split: SDK-owned fields (`response.model`, `agent.name`, `total_tokens`) are only defaulted when absent; Sentry-owned `operation.type` is always recomputed. When auditing a gen_ai field, ask who owns it — that predicts the normalization policy. **But recompute only when there IS a source** (`operation.name` or AI `op`): a span carrying only `operation.type` has nothing to infer from and would be clobbered to the `ai_client` default. Relay legacy dodges this by not treating such spans as AI at all.

**Agent spans carry the aggregate usage of their children — never sum them alongside.** Sentry's Traces table filters agent runs out of token sums (`tracesTable.tsx:155`). Any "total tokens for this trace" query that includes `operation_type = 'agent'` double-counts. The trap: a test fixture whose agent span has no usage passes either way — the bug only appears with a realistic agent span.

**Standalone spans REQUIRE both timestamps; transaction spans do not.** `validate_standalone_span` (validation.rs:342) hard-rejects missing start/end. `validate_transaction_span` clamps to the transaction's own start/end instead. Same field, opposite policy — never generalize one path's validation to the other.

**"Does it crash?" is the wrong question for compat.** A nullable column that happily stores what Relay would reject is a compat bug with no stack trace. Review bots that flag missing validation are often right for reasons they can't articulate — verify against Relay, not against the panic.

**Never call an inherited divergence a "deliberate decision" without evidence.** Caught myself doing exactly this on `operation.type` (2026-07-17): labelled it Abian's product decision, then had to admit he'd never decided anything — the code just shipped that way and I'd documented my own guess in BOND.md as if it were his intent, making the justification circular. If no session log or human statement records a decision, it's an unexamined divergence. Say that instead.

**Dual-dialect SQL: aggregate SUMs over nullable numeric columns need an explicit `CAST(... AS DOUBLE PRECISION)`.** SQLite infers INTEGER when every summed arm is a `0` literal (all-NULL column, or a CASE with zero literals), and sqlx then fails to decode into `f64` at runtime. `breakdown_query` already had the CAST; `agent_traces` didn't and would 500 on any trace with no token usage.
