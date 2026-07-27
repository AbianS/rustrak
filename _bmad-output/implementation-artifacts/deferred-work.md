# Deferred Work

Append-only log of deferred findings surfaced during reviews.

---

## 2026-05-21 — from spec-dsn-public-url review

**Source:** 3-reviewer adversarial review (blind hunter + edge case hunter + acceptance auditor)

### D-1: HOST=0.0.0.0 fallback produces unroutable DSN (medium)
When `PUBLIC_URL` is unset and `HOST=0.0.0.0` (default), the fallback DSN is `http://0.0.0.0:8080/...` — unreachable from outside the host. Consider logging a warning at startup when `HOST=0.0.0.0` and `PUBLIC_URL` is unset, or substituting `localhost` in the fallback for display purposes. Pre-existing behavior; out of scope for the fix.

### D-2: PUBLIC_URL without scheme silently produces wrong DSN (medium)
If a user sets `PUBLIC_URL=api.example.com` (forgetting the scheme), no error is raised. The `dsn()` method defaults to `http://` scheme. Consider validating at startup with `url::Url::parse` and surfacing a clear error. Deferred to avoid adding `url` crate dependency to core config.

### D-3: Sub-path PUBLIC_URL produces malformed DSN (medium)
`PUBLIC_URL=https://example.com/rustrak` causes `dsn()` to produce `https://key@example.com/rustrak/2` — Sentry SDKs parse `/rustrak` as the project ID. Sub-path deployments are not supported by the Sentry DSN format. Should be documented explicitly.

### D-4: Case-sensitive scheme detection in dsn() (low)
`Project::dsn()` uses `base_url.starts_with("https")` — `HTTPS://api.example.com` would silently produce an `http://` DSN. Consider normalizing to lowercase at Config load time alongside the whitespace/trailing-slash cleanup.

### D-5: No end-to-end test for PUBLIC_URL → Config → build_base_url → dsn() pipeline (low)
Unit tests cover each function in isolation. No integration/e2e test verifies that a `PUBLIC_URL` env var round-trips to the `dsn` field in a real API response. Add an integration test to `tests/integration/projects_api_test.rs` when the integration test suite supports env var injection.

---

## 2026-05-21 — from spec-alert-two-tier-integrations split

### D-11: Alert two-tier — Client package update (medium)
After the backend spec (`spec-alert-two-tier-integrations.md`) is merged, update `packages/client`:
- Add `alertIntegrationSchema`, `routingOverrideSchema`, `alertRuleChannelInputSchema` to `schemas/alert.ts`
- Update inferred types in `types/alert.ts`
- Rename `alert-channels.ts` → `alert-integrations.ts` (`AlertIntegrationsResource`)
- Update `alert-rules.ts` to use `channels: AlertRuleChannelInput[]` instead of `channel_ids`
- Update `resources/index.ts` export

### D-12: Alert two-tier — Frontend (medium)
After D-11 is done, update the Next.js UI:
- Rename `apps/webview-ui/src/actions/alerts.ts` integration actions
- Rename `settings/alerts/` → `settings/integrations/` — credentials-only form, no routing fields
- Update `settings-nav.tsx`: href `/settings/integrations`, label "Integrations"
- Update `projects/[id]/project-alerts-dialog.tsx`: integration picker + per-provider routing override fields (Slack bot_token → channel input required; Slack webhook → none; Email → recipients textarea; Webhook → optional URL + extra_headers)

---

## 2026-05-21 — from spec-alert-two-tier-integrations review (loop 1)

### D-13: AlertRuleResponse missing routing_override (low)
GET alert rule response exposes only `integration_ids: Vec<i32>`, losing per-rule routing_override data. Clients can't populate an edit form without a separate query. Address in D-12 (frontend) — the response shape should include `channels: [{integration_id, routing_override}]`.
Source: `apps/server/src/models/alert.rs` — `AlertRuleResponse.integration_ids`

### D-14: validate_channels_routing TOCTOU on is_enabled (low)
`validate_channels_routing` checks `is_enabled` before DB insert, but the check and insert are not in the same transaction. An integration disabled between the two calls creates a rule linked to a disabled integration. Pre-existing pattern in codebase; very low probability race. Fix when adding transactions to rule creation.

---

## 2026-05-21 — from spec-remove-issue-soft-delete review

**Source:** 3-reviewer adversarial review

### D-6: digest_order reuse after hard delete (high)
`IssueService::create()` derives digest_order as `MAX(digest_order) + 1`. Hard-deleting an issue removes the row, so if the deleted issue had the highest digest_order the next issue reuses that integer, producing a duplicate short_id (e.g. `PROJECT-5`). External references (Slack alerts, links, bookmarks) pointing to the old short_id silently resolve to a different issue. Fix: add a `last_digest_order` column to the `projects` table and bump it monotonically on issue creation (never recompute from MAX after hard delete is possible). Source: services/issue.rs:385

### D-7: delete_issue handler skips ProjectService::get_by_id (medium)
`routes/issues.rs:delete_issue` calls `IssueService::get_by_id` then checks `issue.project_id != project_id`, but never calls `ProjectService::get_by_id` first. All other mutating handlers (get_issue, update_issue) verify the project exists first. Pre-existing issue; low security risk because the FK ensures issue.project_id always points to a real project, but consistency with the rest of the handlers is desirable. Source: routes/issues.rs:174

### D-8: alert_history.issue_id uses ON DELETE SET NULL (low)
`alert_history` has `issue_id UUID REFERENCES issues(id) ON DELETE SET NULL`. When an issue is hard-deleted, alert_history rows survive with issue_id=NULL. Decide explicitly: CASCADE (delete history with the issue) or keep SET NULL with documented handling. Source: migrations/postgres/20260121000000_create_alerting.up.sql

### D-9: project event counters not decremented on issue delete (low)
`projects.stored_event_count` and `projects.digested_event_count` are never decremented when an issue is deleted, even though all its events are cascade-deleted. For rate-limiting accuracy, subtract the issue's event counts from the project on hard delete. Source: services/issue.rs:delete()

### D-10: Integration test suite entirely #[ignore] — delete tests use Bearer auth (low)
All tests in `tests/integration/issues_api_test.rs` are marked `#[ignore = "Session cookies..."]` but the delete tests only use Bearer token auth, which the actix test framework fully supports. Investigate whether these tests can be unskipped selectively. Source: tests/integration/issues_api_test.rs:609

---

## 2026-05-21 — from spec-alert-two-tier-integrations review (loop 2)

**Source:** 3-reviewer adversarial review (loop 2→3 SCL-2 loopback)

### D-15: Header injection via routing_override.extra_headers (medium)
`WebhookRoutingOverride.extra_headers` is merged directly into the outgoing HTTP request with no sanitization. An attacker who can set routing_override (e.g. via a compromised API token) could inject arbitrary headers including `Authorization`, `X-Forwarded-For`, or override `Content-Type`. Fix: validate header names against an allowlist or deny-list (reject `Authorization`, `Cookie`, hop-by-hop headers) at rule-create time in `validate_routing_override`. Source: `apps/server/src/services/notification/webhook.rs`

### D-16: SMTP password + webhook secret exposed in GET /api/integrations (medium)
`AlertIntegration.credentials` is returned as-is via `channel_to_safe_json` (only Slack bot token is redacted). SMTP `smtp_password` and webhook `secret` are plaintext in the response. Fix: add redaction for `smtp_password` → `"****"` and `secret` → `"****"` in `channel_to_safe_json`, similar to the existing `redact_slack_bot_token` pattern. Source: `apps/server/src/routes/alerts.rs:channel_to_safe_json`

### D-17: Per-recipient SMTP connection, no dedup or cap on recipients (low)
Email dispatcher opens one SMTP connection per dispatch call and sends to all recipients in `routing_override.recipients`. No deduplication of recipients and no cap on list length. A large recipients list will cause the SMTP connection to stay open longer and could trigger rate limits on the SMTP server. Fix: dedup recipients before SMTP RCPT TO, add a configurable cap (e.g. max 50 recipients per send). Source: `apps/server/src/services/notification/email.rs`

### D-18: Retry counter hardcoded to 1 in dispatch_to_channel (low)
`dispatch_to_channel` always sets `attempt_count = 1` regardless of actual retry history. The exponential backoff is calculated based on `attempt_count = 1`, so the delay never grows on subsequent retries. Fix: read the current `attempt_count` from `alert_history` before updating, or pass it as a parameter. Source: `apps/server/src/services/alert.rs:dispatch_to_channel` ~line 693

## Team RBAC review — deferred findings (2026-06-06)

Surfaced by the adversarial review of `spec-team-rbac.md`. Not blocking; not this story's core problem.

- **create_project is non-atomic for non-admin creators.** `ProjectService::create` then `ProjectMemberService::upsert(...Admin)` run as two statements (`apps/server/src/routes/projects.rs` create_project). If the grant fails after creation, the project is orphaned (invisible to its creator, governable only by a global admin). Fix: wrap create + self-admin grant in a single transaction (needs executor plumbing through the services). Low probability (DB blip), Medium impact.
- **Email is case-sensitive everywhere** (login, invite, accept). `Foo@x.com` and `foo@x.com` are distinct. Pre-existing behavior, not introduced here. Fix: normalize email to lowercase on user + invitation create/lookup; add a partial unique index on pending invitations per email.
- **Legacy (user-less) bearer tokens are unauditable.** Tokens with `user_id = NULL` grant full instance access (by design), but `AuthTokenResponse` doesn't surface owner/legacy status, so an operator can't tell a full-access token from a scoped one. Fix: expose `user_id`/owner (or a "legacy" flag) in the admin token list; consider a migration to attribute/revoke legacy tokens.
- **Source-map chunk upload is authenticated but not project-scoped.** `chunk_upload`/`chunk_upload_capability` (`apps/server/src/routes/sourcemaps.rs`) are org-level endpoints with no `project_id`, so they require auth only (matching the prior `BearerAuth` behavior — NOT a regression). Chunks are content-addressed; the `assemble` step is project-gated. Revisit if per-project gating of raw chunk staging becomes a requirement.
- **`list_offset_for_ids` does not clamp `page`/`per_page`.** Consistent with the existing `list_offset`, which relies on the query-param layer. If `ListProjectsQuery` ever allows `page=0`, the non-admin path would hit a negative OFFSET. Fix: clamp `page >= 1` in both paths for defense in depth.

---

## 2026-06-10 — from spec-gh-115-session-tracking review

**Source:** 3-reviewer adversarial review (blind hunter + edge case hunter + acceptance auditor)

### D-19: `flush()` non-atomic — data loss on partial DB failure (medium)
`SessionAggregator::flush()` drains in-memory state via `std::mem::take` before any DB writes. If `upsert_count` or `upsert_user` fails mid-loop (network blip, DB restart), those rows are permanently dropped with only an error log — no retry queue, no dead-letter store. Fix: retain failed rows in a secondary map and re-merge them into state on the next flush cycle. Source: `apps/server/src/workers/session_aggregator.rs:flush`

### D-20: `apply_cardinality_cap` is O(n) per ingested session (low)
On every call to `ingest_session` / `ingest_aggregates`, `apply_cardinality_cap` builds a `HashSet<&str>` by iterating all keys in `state.counts` while holding the async mutex. For projects with many in-flight buckets this is O(buckets). Fix: maintain a per-project `HashMap<i32, HashSet<String>>` release counter incremented on insert; O(1) check. Source: `apps/server/src/workers/session_aggregator.rs:apply_cardinality_cap`

### D-21: `period_hours()` silently returns 24 on malformed or zero period (low)
`StatsQuery::period_hours()` falls back to 24 for any unparseable or zero input (e.g. `period=foo`, `period=0d`). The caller receives the same response as for a valid `24h` request with no indication of the error. Fix: validate and return HTTP 400 for non-positive or unrecognized period formats. Source: `apps/server/src/routes/sessions.rs:period_hours`

### D-22: Postgres `session_users` JOIN window granularity mismatch (low)
The Postgres stats query filters `session_counts` by `bucket >= NOW() - interval` (precise) but `session_users` by `day >= (NOW() - interval)::date` (day-truncated). User counts can span a slightly wider window than session counts, producing a small asymmetry in crash-free-users rate near day boundaries. Pre-existing by design (day-bucketed users); document explicitly in the query comment. Source: `apps/server/src/services/session.rs` Postgres branch.

---

## 2026-07-14 — from story-span-ingestion.md (Task 8 decision)

**Source:** owner decision during standalone-span-ingestion implementation, not a review.

### D-23: Standalone spans have no rate-limit protection — should eventually match Sentry's per-DataCategory model (medium)
`SpanProcessor` never calls `RateLimitService` — standalone spans are fully exempt from quota, same as `TransactionProcessor`/`LogsProcessor` today. Deliberate for this story: Rustrak's quota system is a single shared counter (`MAX_EVENTS_PER_MINUTE`/`_HOUR`, driven by `events` table COUNT), not per-category like Relay's (`DataCategory::Span` hard-reject vs `DataCategory::SpanIndexed` soft-downgrade, fully isolated from `DataCategory::Error`). Making spans share the existing counter risks starving legitimate error-event quota once span volume dominates (every HTTP call/DB query/agent tool-call becomes a span) — a noisy-neighbor regression, not a safe default.

**What "do it like Sentry" means concretely:** a separate quota track for spans (own config vars, e.g. `MAX_SPANS_PER_MINUTE`/`_HOUR`; own `quota_exceeded_until`/`next_quota_check` state, either new columns on `projects`/`installation` or a small per-category quota table; own COUNT query against `spans` instead of `events`) so span volume can never rate-limit errors and vice versa. Until that lands, an unbounded/misbehaving span-emitting SDK has no ingestion-side protection against flooding the `spans` table/disk — only the existing per-item 1MB size cap applies.

Source: `apps/server/src/digest/processors/span.rs`, `apps/server/src/services/rate_limit.rs`

---

## 2026-07-17 — from PR #186 review verification (span v2 protocol)

**Source:** Greptile bot flagged the shape divergence on PR #186; verdict and direction re-derived from Relay source (SHA `40bc3d240`) during `/analyze-pr-feedback`. The bot's proposed fix pointed the wrong way and was rejected — this entry records the real, deferred version.

### D-24: `spans.data` JSONB shape diverges between v2 and legacy producers (low)
`SpanV2Processor` stores the unwrapped attribute bag directly (`data` = `{gen_ai.*, sentry.*, ...}`, gen_ai at `$.gen_ai.*`). Every other producer — `SpanProcessor`, `TransactionProcessor::insert_span`, `insert_root_span` — stores the whole parent object (span JSON or `contexts.trace`), putting gen_ai at `$.data.gen_ai.*`. Any raw JSONB query assuming one shape silently returns NULL for the other.

**Not urgent:** nothing reads a JSONB path out of `spans.data` today. The list/detail queries (`services/span.rs:65`, `:354`) don't select the column at all; the only other use is `length(CAST(s.data AS TEXT))` for storage stats (`services/storage.rs:363`). The dedicated `gen_ai_*` columns are unaffected, so dashboards and aggregations are correct either way. The exposure is future ad-hoc SQL or a JSONB projection.

**Fix direction — flatten the legacy producers toward v2, NOT the reverse.** v2-flat is the canonical shape, and this is the one thing to get right if anyone revisits it. Relay's v1→v2 conversion hoists `data.{k}` to attribute `{k}` and deletes the `data` wrapper ([`relay-spans/src/v1_to_v2.rs#L206`](https://github.com/getsentry/relay/blob/40bc3d24099117d47179b4ca21dda403c7e628d9/relay-spans/src/v1_to_v2.rs#L206), fixture at [`#L319`](https://github.com/getsentry/relay/blob/40bc3d24099117d47179b4ca21dda403c7e628d9/relay-spans/src/v1_to_v2.rs#L319)); its own Kafka message is flat too (`SpanKafkaMessage` serde-flattens `SpanV2`, [`store.rs#L1618`](https://github.com/getsentry/relay/blob/40bc3d24099117d47179b4ca21dda403c7e628d9/relay-server/src/services/store.rs#L1618)). Relay converts **every** span to v2 before storing, so flat is what everything lands in. Nesting the v2 bag under `data` to match the legacy producers would invent a wrapper the protocol explicitly removes.

**What the work would be:** legacy producers store `data["data"]` (the attribute bag) as the `data` column instead of the whole span object, promoting any needed top-level fields to their existing columns first. Needs a backfill decision for existing rows — an unmigrated table would then hold both shapes, which is strictly worse than today's consistent-per-producer split. That migration cost is the main reason this is deferred, not the code change.

Source: `apps/server/src/digest/processors/span_v2.rs`, `span.rs`, `transaction.rs`

---

## 2026-07-19 — from spec-event-digest-order-collision.md review (bad_spec loopback)

**Source:** 2-reviewer adversarial review (Blind Hunter + Edge Case Hunter, parallel review of the first implementation pass), triaged during the `/bmad-quick-dev` step-04 review loop.

### D-25: `issues.digest_order` generation still uses a `MAX(digest_order)+1` scan — hardening it needs rolling-deploy safety designed in from the start (medium)
The original spec bundled a Tier 2 hardening alongside the `events.digest_order` bug fix: replace `issues`'s `SELECT MAX(digest_order) FROM issues WHERE project_id = $1` scan (in `digest/processors/event.rs` and the test-only `IssueService::create` in `services/issue.rs`) with a dedicated `project_issue_counters` table, upsert-based, mirroring Sentry's `Group.short_id`/`Counter` pattern. It was implemented, then pulled from scope after review found a real defect: the counter table is seeded once at migration time from a live `MAX()` scan, and any old-binary server instance still processing events during a rolling/mixed-version deploy window keeps using the old scan-based mechanism — which has no way to know the new counter table exists, so it never updates it. A new-code instance reading the (now-stale) counter can then assign a `digest_order` an old-code instance already committed moments earlier, colliding on `UNIQUE(project_id, digest_order)` — structurally the same bug class the parent spec exists to fix, just relocated one table over.

**Not urgent — no active bug today.** The current scan-based approach for `issues.digest_order` has no known collision bug (unlike the fixed `events.digest_order` mechanism); the advisory lock (`pg_advisory_xact_lock(project_id)`) correctly serializes it under normal operation. This is a hardening/cleanliness improvement, not a fix.

**What "do it right" requires, for whoever picks this up:** rolling-deploy safety as a first-class design constraint from the start, not an afterthought — options surfaced during review: (a) make the counter upsert self-reconciling against live `MAX(digest_order)` on every call (`GREATEST(counter_value, live_max) + 1`), which closes the gap fully but reintroduces part of the scan cost Tier 2 was meant to eliminate; or (b) accept and clearly document an operational constraint that this migration cannot be applied ahead of / concurrently with old binaries still processing events (no rolling multi-replica overlap, no migrate-then-deploy-later pipelines) — reasonable given Rustrak's typical single/few-instance self-hosted deployment model, but a real constraint to remember and document prominently (CLAUDE.md deployment section + migration file comment) if chosen.

Source: `apps/server/src/digest/processors/event.rs` (~lines 365-372), `apps/server/src/services/issue.rs` (~lines 641-648)

### D-26: `digest_order`/short-id reuse after an issue's highest-numbered sibling is deleted (low)
Both the current `MAX(digest_order)+1` scan and any future counter-based replacement (D-25) derive the "next" value from currently-existing rows only. If a project's numerically-highest issue is hard-deleted, the next new issue can be assigned a `digest_order` (and therefore short-id, e.g. `PROJECT-42`) that a previously-deleted issue already used and a user may have bookmarked/linked to. Pre-existing behavior, not a regression from any recent work — Sentry's own `Group.short_id` avoids this because its `Counter` model is genuinely append-only and never reads live table state to determine the next value. Fixing this in Rustrak would require the same non-scan-based, non-derived counter design as D-25, so the two are natural to solve together if either is picked up.

Source: `apps/server/src/digest/processors/event.rs`, `apps/server/src/services/issue.rs`

---

## 2026-07-20 — from code review of spec-event-digest-order-collision

**Source:** 3-reviewer adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Acceptance Auditor found zero spec violations; all 4 items below are pre-existing, not introduced by this diff.

### D-27: `EventCursor.order` not validated against the `order` query param (low)
If a client reuses a cursor issued for one `order` value with a different `order` query param, the `(timestamp, id)` keyset boundary silently applies to the new direction — events can be skipped or duplicated. The pre-diff `digest_order`-based `EventCursor` had the same unchecked `order` field, so this predates the fix. Source: `apps/server/src/services/event.rs:32`, `apps/server/src/routes/events.rs:58-69`.

### D-28: Late-digesting event can be permanently missed within an in-progress pagination session (low)
If an event finishes async digest after a client has already paged past its `(timestamp, id)` position, it's omitted from that session until the client restarts from page 1. Inherent to keyset pagination generally; conceptually existed under the old digest_order counter too. Source: `apps/server/src/services/event.rs:50-99`.

### D-29: `CREATE INDEX CONCURRENTLY IF NOT EXISTS` can silently leave an INVALID index on a retried/interrupted migration (medium)
If the concurrent build is interrupted, Postgres leaves the index `INVALID`; a retry sees the index name already exists (`IF NOT EXISTS`) and skips creation, leaving it permanently unused with no error surfaced anywhere. Established codebase pattern (same as `20260718000000_agent_perf_indexes.up.sql` / `20260718000001_agent_perf_indexes_transactions.up.sql`), not introduced by this diff. Fix direction: a migration health-check (e.g. query `pg_index.indisvalid` post-deploy) across all `CONCURRENTLY`-built indexes. Source: `apps/server/migrations/postgres/20260719000001_add_events_issue_timestamp_index.up.sql`.

### D-30: `test_list_events_order_desc`/`test_list_events_order_asc` never run in CI — stated `#[ignore]` reason doesn't apply (medium)
The file-wide `#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]` predates this diff, but these endpoints use Bearer-token auth (`ApiActor`), not session cookies — the stated reason is factually wrong for this file. `cargo test` runs with no `--include-ignored` anywhere in CI (`.github/workflows/ci.yml` → `pnpm run ci` → `cargo test`), so this diff's own API-level ordering-behavior verification never executes automatically. Same root cause as D-10 (`tests/integration/issues_api_test.rs`), now confirmed in a second file — worth investigating as a shared fix (verify Bearer-only tests actually pass under the actix test harness, then drop `#[ignore]` from the Bearer-authed subset across both files). Source: `apps/server/tests/integration/events_api_test.rs:386,466`.

- source_spec: `_bmad-output/implementation-artifacts/spec-ad10-p2-client-error-fixtures.md`
  summary: packages/client never type-checks its own tests, so the AppErrorType union that guards the error fixtures is unenforced in CI.
  evidence: `packages/client/tsconfig.json` has `"exclude": [..., "tests"]`, so `check-types` (`tsc --noEmit`) skips every test file. Proven by renaming the union member `'NotFound'` to `'NotFownd'`, which invalidates 34 call sites: both `tsc --noEmit` and `vitest run` still exited 0. A `tsconfig.test.json` that includes `tests/**/*` does catch it (108 errors with the typo), but enabling it surfaces 74 PRE-EXISTING errors across 10 test files first: 44 TS2532 and 17 TS18048 from `noUncheckedIndexedAccess`, plus 13 TS6133 unused declarations. That cleanup is a focused job of its own, so it was measured and recorded rather than folded into the fixture work. The same gap very likely exists in `packages/mcp`; check before fixing.

- source_spec: `_bmad-output/implementation-artifacts/spec-ad10-p3a-client-result.md`
  summary: AD-10 phase 3b, update every @rustrak/client consumer to the Result API: packages/mcp, apps/webview-ui and apps/docs/content/sdks/client.mdx.
  evidence: Abian split the Result conversion so the SDK lands first. 3a leaves the repo not compiling on purpose. Measured surface: 61 client calls across packages/mcp/src (toMcpError branches on instanceof across 4 classes, every tool handler has a try/catch), 67 calls across 18 files in apps/webview-ui/src/actions with 15 try blocks, and one live docs page (the 8 changelog hits are historical and must not be edited). The 8 files reading getCurrentUser need particular care: `unauthenticated` must send the user to login while `network` and `server_error` must not, or a flaky connection produces a login loop. 3a produces phase-3b-consumer-inventory.md as its input.

- source_spec: `_bmad-output/implementation-artifacts/spec-ad10-p3a-client-result.md`
  summary: packages/client's retry policy is internally incoherent: ky retries non-idempotent writes, and `isRetryable` contradicts ky on two of the three statuses that matter.
  evidence: PRE-EXISTING, verified present at commit b13da58, and deliberately left alone by the AD-10 Result conversion because changing retry semantics is a spec of its own. Three findings, one root cause. (1) `createKyInstance` sets `retry.methods: ['get','post','put','patch','delete']`. ky 2.0.2's default is `['get','put','head','delete','options','trace']` (`node_modules/ky/distribution/utils/normalize.js:3`), so `post` and `patch` are additions this client made: a 504 arriving after the server already committed a write silently re-issues the request, so `projects.create`, `tokens.create` and `invitations.create` can each produce duplicate rows on one call. `retry.statusCodes` includes 504. (2) `isRetryable` returns true for `server_error`, but by the time a caller sees one, ky has already exhausted `maxRetries` (default 2) on 500/502/503/504, so a caller following the docstring and retrying performs 3x(1+N) requests against a server that is already failing. (3) 408 is in `retry.statusCodes` so ky retries it, yet `transformHttpError` maps it to `client_error`, for which `isRetryable` returns false: the client retries a status it then tells the caller is permanent. Fix direction: decide once whether retry is ky's job or the caller's, then make `isRetryable` describe the leftover budget rather than the transient-ness of the status; if writes stay retryable they need an idempotency key, which the server does not accept today. Source: `packages/client/src/utils/http.ts` (`createKyInstance`, `transformHttpError`), `packages/client/src/errors.ts` (`isRetryable`).

- source_spec: none
  summary: Editing an existing Slack bot-token integration and leaving the token blank fails with a serde error on the ordinary edit path.
  evidence: The client deliberately permits a blank token when editing (`integrations-list.tsx:151-154`, `if (data.is_edit && tokenEmpty) return;`) and then sends `credentials = { method: 'bot_token' }` with no `token` (`:869-872`). But `SlackBotTokenConfig.token` is a required String (`apps/server/src/models/alert.rs:249-250`) and `update_channel` replaces the whole credentials JSON with no merge (`services/alert.rs:110-113`). The user gets `Validation error: Invalid Slack config: missing field token`. Found while inventorying forms for the field-error design. Fix is either a credentials merge on update or preserving the existing token client-side.

- source_spec: none
  summary: The issue comment form has no error handling; a failed submit is an unhandled rejection and the textarea is cleared anyway.
  evidence: `apps/webview-ui/src/app/(main)/projects/[id]/issues/[issueId]/issue-activity.tsx:78-82` awaits `addIssueComment(...)` with no try/catch and no result check, so the user's comment is lost with no message shown. Found while inventorying forms.

- source_spec: none
  summary: The project general-settings form validates less than the create form, so two inputs for the same field enforce different contracts.
  evidence: F10 (`general-settings-form.tsx:118-147`) has no max length on name and no slug regex, while the create form caps name at 100 and enforces `/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/`. The server caps name at 255 (`services/project.rs:266`) and rejects unslugifiable input (`:281`), so a 300-character rename on the settings page reaches the server and toasts. Related: F10 uses raw useState with no react-hook-form instance, so it has no field registry to bind a server-supplied field name to.

- source_spec: `_bmad-output/implementation-artifacts/spec-field-errors-wire.md`
  summary: The consuming half of field-level errors, to be folded into AD-10 phase 3b rather than done separately, since 3b rewrites every one of these files anyway.
  evidence: The wire spec puts `fields: [{field, code, message?}]` on the server response and exposes it on the client union. The UI half was deliberately split out because apps/webview-ui does not compile until 3b, and doing it separately means editing the same forms twice. What 3b must do: (1) one shared helper mapping `fields` onto a form, calling setError(field) only when the form actually has that field and otherwise accumulating into root.serverError, because react-hook-form keeps an error on an unregistered name until clearErrors() is called by hand and would leave a permanent error with no visible input; (2) delete the string matcher at create-project-form.tsx:159-181, which is the only one in the app and is already dead in production; (3) convert general-settings-form.tsx to react-hook-form, since it uses raw useState and has no field registry to bind to, and while there give it the create form's Zod rules, which it currently lacks; (4) use the helper in invite-form.tsx, the three dialogs in integrations-list.tsx, alerts-settings.tsx, team-members-list.tsx and members-settings.tsx; (5) leave login-form.tsx vague on purpose and add a comment naming user enumeration, so nobody "fixes" it later; (6) stop actions/auth.ts collapsing every 401 into invalid_credentials, which is why "Account is disabled" never reaches the user. Note the integration dialogs pack every typed credential into one opaque `credentials` object, so their field paths are dotted (`credentials.url`).

- source_spec: `_bmad-output/implementation-artifacts/spec-field-errors-wire.md`
  summary: `POST /api/projects` is reachable by any authenticated user, so the `name`/`slug` `already_exists` codes let a caller with zero projects enumerate every project name and slug on the instance.
  evidence: PRE-EXISTING and deliberately left alone: the prose message already leaked it (`Project with slug 'x' already exists`, `services/project.rs:214`), so the structured `(slug, already_exists)` / `(name, already_exists)` annotations add no information a caller could not already read. What they do add is scriptability, and that is the reason to record it: a 409 with a stable machine-readable code is a clean oracle a loop can drive at a wordlist, where the prose was merely a string somebody had to match. Uniqueness on `projects.name` and `projects.slug` is instance-wide (`migrations/postgres/20260119000001_add_projects_name_unique.up.sql` adds `projects_name_key UNIQUE (name)`; slug is unique in the initial schema), and `routes/projects.rs` create requires only `ApiActor`, not membership or admin. This contradicts the invariant stated at `apps/server/src/services/access.rs:50` — "Non-member → Err(NotFound) (don't leak existence)" — which every read path honours and the create path does not. Same class as the global-stats-visibility concern (every `/api/stats/*` aggregate must honour the membership allowlist): an aggregate or a uniqueness check that is scoped instance-wide while reads are scoped per-membership. Three options, none picked here because all three change either the auth model or the uniqueness scope, both of which were explicitly out of scope for the field-error work: (1) scope uniqueness per owner, i.e. `UNIQUE (owner_id, name)` / `UNIQUE (owner_id, slug)`, which removes the oracle entirely but is a migration plus a change to slug derivation and to every URL that resolves a project by slug; (2) gate `POST /api/projects` behind instance admin, which removes the oracle for ordinary users but changes who can self-serve a project; (3) accept it and document it, on the grounds that a self-hosted instance's project names are not a secret from its own authenticated users — in which case `access.rs:50` should say so, because as written it promises something the create path does not deliver.

- source_spec: `_bmad-output/implementation-artifacts/spec-ad10-p3b-consumers.md`
  summary: A disabled account cannot be told apart from bad credentials by any consumer, and making it distinguishable requires reordering the login checks first, because today it would be an account-existence oracle.
  evidence: `apps/server/src/routes/auth.rs` checks `if !user.is_active` and returns `Unauthorized("Account is disabled")` BEFORE calling `verify_password`. So a caller who can distinguish that message learns an email exists and is disabled without knowing the password. Both outcomes are the same `AppError::Unauthorized` variant differing only in prose, so a consumer could only tell them apart by matching the message, which phase 3b's acceptance criteria forbid. Phase 3b's task list asked for this message to reach the user; the implementing agent correctly refused and reported it instead. The fix has two parts and they must land in this order: (1) move the `is_active` check to AFTER password verification, so only someone who already proved they own the account learns it is disabled, and (2) only then give it a distinguishable signal, most naturally a FieldError code on the existing field-error contract. Part 1 alone is a small security improvement worth doing regardless of part 2. Both are `apps/server` changes and were out of scope for a consumer-conversion phase.

---

## Deferred from: code review of spec-ad10-p3b-consumers (2026-07-27)

### D-31: `getEventNavigation` truncates silently at the 50-page cap, and the truncated window corrupts the navigation arithmetic (medium)
The `do/while` exits on `pageCount === MAX_NAV_PAGES` with `cursor` still set and returns `Ok(...)` with `totalCount = events.length`, giving the caller no signal that the window is partial. Worse, the event the user is actually looking at is usually outside that window: `issues/[issueId]/page.tsx` redirects to the *newest* event via `getLastEvent({order:'desc'})` while this walks ascending, so past ~1000 events `findIndex` returns `-1`. That renders `currentIndex + 1` as **"0 of 1000"**, and because `-1 < totalCount - 1` holds, `nextEventId` becomes `events[0]` — the *oldest* event in the issue. "Next" jumps the user to the far end of the timeline.

PRE-EXISTING and verified byte-identical at baseline `474c806`: the cap, the `currentIndex + 1` display and the `nextEventId` expression are unchanged by the AD-10 conversion, which only added the `Result` plumbing. Recorded rather than fixed because the real fix is a different navigation design (ask the server for neighbours, or paginate from the current event outward) rather than a larger cap, which only moves the threshold. Note that phase 3b's own new doc comment on this function asserts the truncation was removed; correcting that comment is a separate review patch.

Source: `apps/webview-ui/src/actions/events.ts:60-73,103,119-131`

### D-32: the integration dialogs' `credentials.*` field maps are dead code — the server never names a field under `credentials` (low)
`integrations-list.tsx:105-121` defines dotted `ServerFieldMap`s (`credentials.url`, `credentials.webhook_url`, `credentials.smtp_host`, …) so that a nested credential path can be mapped back onto the flat input the dialog renders. The frozen spec required this mapping, and it is correctly built — but no server code path emits it. The complete `with_field` inventory across `apps/server/src` is `name`, `slug`, `role`, `token`, `email`, `alert_type` (plus an `x` in a test fixture); `services/alert.rs` names only `name` (92, 138) and `alert_type` (285), never a credential.

Consequence today: harmless but unexercised, so nothing would catch it drifting. Consequence if the server later does annotate a credential field: the mapping is what makes the guard reachable at an input that Radix `TabsContent` unmounts (Slack's `webhook_url` / `token` live in opposite tabs), which is the scenario the `_names.mount` patch exists to close. Either give the server a reason to name these fields, or drop the maps until it does.

Source: `apps/webview-ui/src/app/(main)/settings/integrations/integrations-list.tsx:105-121`, `apps/server/src/services/alert.rs:92,138,285`

### D-33: two docs still teach the deleted nine-class error hierarchy (low)
`apps/docs/content/sdks/client.mdx` and `packages/client/README.md` were both rewritten for the `Result` API, but two other documents still teach `instanceof NotFoundError` branching against classes that no longer exist: `docs/architecture-client.md:168-192` and `.claude/skills/typescript-api-client/SKILL.md:183-284`. The skill file is the more expensive of the two, because it is loaded as guidance when an agent works on API-client code and will actively teach the removed API to the next implementer. Outside phase 3b's Code Map, which named `client.mdx` as the only live docs page.

Source: `docs/architecture-client.md:168-192`, `.claude/skills/typescript-api-client/SKILL.md:183-284`

### D-34: a failed `logout()` leaves the server session live while the browser looks signed out (medium)
`logout()` calls the API, and on failure drops the local session cookie anyway and returns. Its signature is `Promise<void>`, so no caller can distinguish the two outcomes; `header.tsx:29` is a bare `await logout()`. The user sees the login page and reasonably believes they are signed out, but the server-side session is still valid and its cookie value may survive elsewhere (another tab, a session-restore, a shared machine).

The in-code comment argues that clearing the local cookie regardless beats leaving the user holding a live cookie, which is correct as far as it goes. The third option — clear the cookie *and* tell the user the sign-out did not reach the server, so they can act — was not taken and the `void` return makes it unavailable. Fix direction: return `Result<void, RustrakError>` and have the header surface a warning on failure. Deliberately deferred by Abian at code review on 2026-07-27; recorded because the security-relevant half (the live server session) is invisible today.

Source: `apps/webview-ui/src/actions/auth.ts:69-83`, `apps/webview-ui/src/app/(main)/header.tsx:29`

### D-35: bulk issue operations report a count nobody reads, so a partial application looks like a complete one (medium)
AD-10 phase 3b changed `bulkUpdateIssues` and `bulkDeleteIssues` from `Promise<void>` to `Result<{updated: number}>` / `Result<{deleted: number}>`, but `grep '\.updated\b|\.deleted\b'` over `apps/webview-ui/src` returns nothing: both call sites in `issues-list.tsx` branch on `result.success` only. Select five issues where the server applies two (per-issue permission, or a concurrent delete), and `success` is true, the selection clears, `router.refresh()` runs, and three issues reappear unchanged with no message — indistinguishable from a rendering lag.

The data to fix it is already on the wire and already in the type; what is missing is comparing the returned count against the selection size and saying so. Deliberately deferred by Abian at code review on 2026-07-27.

Source: `apps/webview-ui/src/actions/issues.ts:90-110`, `apps/webview-ui/src/app/(main)/projects/[id]/issues/issues-list.tsx:122-141,157-176`
