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
