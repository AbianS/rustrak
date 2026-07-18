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
