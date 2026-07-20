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

## Span Protocol Facts (verified 2026-07-14, corrected 2026-07-16, SHA f42b1c8a1)

**Two live span schemas — but the feature flag governs Relay's server-side processor choice, NOT what SDKs send.** ~~For "what does a Sentry SDK send today," target legacy `Span`.~~ **This was wrong, disproven by real-SDK capture 2026-07-16** (`@sentry/node@10.65.0` + `ai`/Vercel AI SDK, `vercelAIIntegration()`): the client unconditionally emits `application/vnd.sentry.items.span.v2+json` (SpanV2Container, batched, typed attributes, no top-level `op`) for OTel-instrumented spans — legacy `Span` items still exist and Relay still accepts them (`legacy_spans` module), but current SDKs don't send them for this class of span. `projects:span-v2-experimental-processing` only controls which Relay pipeline *claims* an already-v2 item; it has no bearing on wire format. **Target BOTH schemas** — legacy for whatever still sends it, v2 for anything OTel-instrumented (all current AI/agent tracing). See `story-span-v2-protocol.md` for the full spec, `BOND.md` for the corrected gap entry.

**~~`SpanData` is a fixed ~80-field typed struct~~ — WRONG as of SHA 40bc3d240 (verified 2026-07-17).** Sentry gutted it between 2026-07-02 and 2026-07-17: `SpanData` is now a **pure generic bag** — `other: Object<Value>` plus `get`/`get_value`/`get_str`/`contains` accessors, ~500 lines deleted, and the entire `field = "sentry.*"` annotation family is gone from `relay-event-schema`. Attribute keys survive unchanged (they're just untyped now), so findings *about key names* held; findings *citing the struct annotations* lost their evidence. **Lesson: this area moves fast — always `git pull` before citing span schema internals.** A 2-week-old clone was already reasoning about a dead model.

**v2 carries as `sentry.*` attributes what legacy kept as top-level span fields.** Literal keys, all confirmed in `relay-spans/src/otel_to_sentry_v2.rs` fixtures (= the OTel→v2 path, which is what real `@sentry/node`+OTel SDKs use): `sentry.exclusive_time` (double), `sentry.platform`, `sentry.release`, `sentry.environment`, `sentry.segment.id`, `sentry.op`, `sentry.description`, `sentry.origin`, `sentry.profile_id`. Promotion happens at `relay-spans/src/v1_to_v2.rs:55-61`, where top-level fields take precedence over same-named `data` keys. **Relay never *computes* exclusive_time for v2** — `compute_span_exclusive_time` is v1-transaction-only, zero refs in `eap/` — so an absent attribute means no self time, never a value to derive.

**v2 attributes are FLAT — `data.{k}` → attribute `{k}`, wrapper deleted** (`v1_to_v2.rs:206`, fixture at `:319`). Relay's Kafka message is flat too (`SpanKafkaMessage` serde-flattens `SpanV2`, `store.rs:1618`), and *every* span is converted to v2 before storing. So v2-flat is the canonical shape — never nest a v2 attribute bag under a `data` key to "match" a legacy producer.

**v2 timestamp validation rejects, never clamps**: `(Some(start), Some(end)) if start <= end` else `DiscardReason::Timestamp` (`relay-server/src/processing/spans/process.rs:367`, six unit tests pin it). Both are REQUIRED — a missing timestamp is a discard, not a zero. `start == end` is valid. **Trap for Rust ports:** `#[serde(default)]` on an `f64` turns an absent timestamp into `0.0`, and `0.0 > 0.0` is false — the entry sails through a naive `start > end` guard. Use `Option<f64>`.

**v2 `is_segment` is pass-through, NOT derived** — unlike the legacy pipeline (which infers it from `segment_id == span_id` or an empty `parent_span_id`, `legacy_spans/normalize.rs:63`). Relay assumes v2 SDKs send correct values; `test_spansv2.py:457` confirms `is_segment: false` with no `parent_span_id` stays false. There is no `segment_id` field on v2 at all — segment identity lives only in the `sentry.segment.id` attribute, so deriving it from `is_segment` alone silently drops every child span's link to its root.

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

## Releases API Facts (verified 2026-07-18, SHA a32a33a5)

**"Finalize" is not a real Sentry concept — it's sentry-cli terminology for a plain field-set PUT.** There is no finalize endpoint, flag, or status enum anywhere in the monolith (zero grep hits for "finalize" in `releases/endpoints/`, `models/release.py`). `PUT .../releases/{version}/` is a generic partial-update; setting `dateReleased` (null→set) is the entire "finalization" — it just fires one `Activity(RELEASE)` row. When a Sentry CLI/tool workflow uses an action verb ("finalize", "deploy", "resolve in next release"), check whether the monolith actually models it as a distinct state or whether it's client-side vocabulary for setting a field — the two require very different implementations.

**Releases are org-scoped, not project-scoped, in real Sentry** (`unique_together = (organization, version)`, M2M to projects via `ReleaseProject`). Rustrak has no organization concept anywhere — the existing fix for this mismatch is already in the codebase: `routes/sourcemaps.rs`'s `org_details` handler accepts and echoes back any `org_slug` without validating it (sentry-cli only checks the org endpoint responds 200 before proceeding). The same synthetic-org pattern applies to any future org-scoped Sentry endpoint — don't build real multi-tenancy to satisfy a URL segment that's ignorable.

## Counter vs. Sequence — never let the same field serve both (verified 2026-07-18, SHA a32a33a5)

**Identity fields (unique, sequential, used in a constraint) and stat fields (approximate, display-only) must never be the same column — Sentry enforces this with different storage, not just different discipline.** `Group.short_id` (identity — Rustrak's `digest_order` equivalent) lives in a dedicated `sentry_projectcounter` table with a strictly increment-only API (`Counter.increment`, `models/counter.py:43-127` — raises `ValueError` on non-positive delta, atomic `INSERT ... ON CONFLICT DO UPDATE SET value = value + delta RETURNING value`). `Group.times_seen` (stat — Rustrak's `digested_event_count` equivalent) is written only additively or reset to `0` when a Group is recreated wholesale (reprocessing) — grepped clean of any decrement anywhere in `src/sentry/`, including `deletions/`/`tasks/deletion/`. Even where Sentry blurs the two during reprocessing, `short_id` is copied verbatim to the new row while `times_seen` gets reset with a comment admitting it's now approximate — deliberately different integrity guarantees on two fields that sound similar.

**Sentry also has no per-issue sequence number for individual events at all** — no equivalent of Rustrak's event-level `digest_order` exists anywhere in the monolith. Events are addressed by UUID `event_id` + `group_id` FK, ordered by `(timestamp, event_id)` via Snuba/ClickHouse — no dense mutable integer to desync. Retention deletes whole Groups, never "purge some events, keep the group with an adjusted counter." This is why Sentry structurally can't hit the bug class below: it isn't that they solved the race, it's that the shape of the problem doesn't exist in their schema.

**Rustrak bug this pattern explains (2026-07-18, unfixed):** `digest/processors/event.rs:120-124` derived a new event's `digest_order` (governs a `UNIQUE(issue_id, digest_order)` constraint) from `issues.digested_event_count` — meant as a running stat. `services/storage.rs:195-199` (retention cleanup) decremented that same field by the count of purged old events, correct for a stat, catastrophic for an identity source: the decremented counter fell below `digest_order` values still occupied by surviving (non-purged, recent) events, causing unique-constraint collision storms and silent event loss on every subsequent digest for that issue. The tell in production logs: a dense band of consecutive collisions (`digest_order` N through N+20) for one `issue_id`, all within ~1 second — that's a counter reset landing inside still-live data, not ordinary concurrency. **When auditing any Rustrak counter, ask: is this field ever used inside a `UNIQUE` or as a lookup key, AND is it ever decremented anywhere? Both true at once is the bug.**

**Review-bot "hardening" suggestions are the ones most likely to be invented requirements — verify before trusting (2026-07-18).** Two CodeRabbit findings on PR #186 sounded like reasonable defensive validation but were both wrong against source: (1) rejecting a span-v2 container when `version != 2` — real `ContainerMetadata.version` is `Option<u16>`, `none` is a documented-valid state, Relay's own test round-trips `version: 123` with zero rejection (`relay-event-schema/src/protocol/span_v2/container.rs`). (2) "preserve root rollup tokens when no children exist" for `agent_traces` — real Sentry's Traces table query unconditionally excludes agent-type spans from the token sum (`tracesTable.tsx:155`), no fallback; a root-only trace genuinely shows 0 in real Sentry too. Both got accepted as REAL in a pr-feedback pass that reasoned from "this sounds like it improves data integrity" without checking source — the instinct to harden ingestion is the trap. Lesson: a suggestion framed as "don't silently drop data" or "add defensive validation" needs the same source-check as any other claim, not less.
