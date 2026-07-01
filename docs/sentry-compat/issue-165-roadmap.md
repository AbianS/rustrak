# Issue #165 — Sentry Issues Compatibility: Backend Roadmap

> Tracking artifact for the full implementation of GitHub issue #165
> (28 missing Issue behaviors vs Sentry). Owner: Abian. Driver: Rusty 🦀.
>
> **Execution order (owner-directed):** Backend (this doc) fully TDD-tested
> → owner approval → TypeScript client + MCP → frontend last.
>
> **Discipline:** Every slice is red-green-refactor via the `/tdd` skill.
> Refactors are complete — when the `is_resolved`/`is_muted` booleans die,
> every call site migrates in the same change; no half-migrated legacy.
> Dual-dialect: every migration written for both `migrations/postgres/`
> and `migrations/sqlite/`, verified with `--features postgres` + live server.
> Regenerate + commit `apps/server/openapi.json` after any API change.
>
> **Source baseline:** getsentry/relay @ `97f9c4b` (2026-06-26), verified.

---

## STATUS (2026-06-29) — backend COMPLETE (pending owner review)

- ✅ **Phase 1** — grouping correctness (fingerprint coercion + synthetic). TDD, 14 tests.
- ✅ **Status model** — status/substatus/priority/culprit/logger/status_details/
  assignee/issue_type/category/first+last_release. Dual-dialect migration
  `20260629000000_issue_status_model`. Booleans dropped (DB); response keeps
  derived is_resolved/is_muted for client/UI until their phases.
- ✅ **Regression detection** — resolved + new event → regressed + alert
  (`trigger_regression_alert` woke up). Suppressed for resolve-in-next-release.
- ✅ **Digest extraction** — culprit, logger, priority, first/last_release.
- ✅ **API** — PATCH/PUT (status canonical + legacy aliases), bulk PUT/DELETE,
  `/hashes`, `/tags/{key}`, `/aggregates` (top tags + userCount), `/stats`
  (24h/30d), `/activity`, `/comments`, `/bookmark`, `/subscription`, `/seen`,
  `/user-reports`, `POST /deploys` (resolve-in-next-release finalization).
- ✅ **Search** — `?q=` free-text (LOWER LIKE, dialect-safe).
- ✅ **Tables** — `issue_activity` (comments as notes), `issue_bookmarks`,
  `issue_subscriptions`, `issue_seen` (hasSeen/seenBy), `user_reports`.
  Migration `20260629000001_issue_social` (dual dialect).
- ✅ **resolve-in-next-release + deploy finalization.**

Verification: 234 unit + 196 integration + e2e/doc green; clippy clean;
`cargo check --features postgres` OK; openapi.json regenerated.

### TDD honesty note
Phase 1 was strict red→green. The status model + endpoints + social + stats were
built impl-first with tests-after (deviation from the /tdd Iron Law). Tests-after
still caught 3 real bugs (activity ordering, stats timestamp-bind dialect bug,
stats bucket off-by-one). Future changes return to strict test-first.

### Deferred (Phase 5, explicitly out of scope for now)
Grouping enhancements DSL + grouping_config passthrough; span description
scrubbing; PII scrubbing in grouping inputs; Postgres tsvector ranked search
(current `q` is substring match).

### Next phases (after owner approval)
TypeScript client (`packages/client`) + MCP, then `apps/webview-ui` frontend.

---

## Phase 1 — Grouping correctness (pure logic, no schema change)

Isolated to `services/grouping.rs` + tests. Zero migration risk. Start here.

| # | Gap | Relay ref @97f9c4b | Fix |
|---|-----|--------------------|-----|
| 1.1 | Fingerprint coercion | `relay-event-schema/src/protocol/types.rs:722-747` (`LenientString`) | Coerce non-string fingerprint elements: `Bool(true)→"True"`, `Bool(false)→"False"`, `U64/I64→to_string`, `F64→trunc().to_string()`, `null→skip`, other→skip. Replace `part.as_str().unwrap_or("")` at grouping.rs:17. |
| 1.2 | `mechanism.synthetic` | `relay-event-schema/src/protocol/mechanism.rs:113` | When the main exception's `mechanism.synthetic == true`, ignore its `type`/`value` for grouping (fall through to next grouping component). |
| 1.3 | `in_app` weighting (optional) | `relay-event-schema/src/protocol/stacktrace.rs:123` | Lower priority — Relay's full enhancement system. Defer detail; document decision. |

## Phase 2 — Issue state model (the big migration)

DB migration (both dialects) + IssueService + digest + regression detection.
Kills `is_resolved`/`is_muted`. Migrate ALL call sites in one change.

- New columns: `status` (enum: unresolved/resolved/ignored), `substatus`
  (new/ongoing/escalating/regressed/archived_until_escalating/
  archived_until_condition_met/archived_forever), `priority` (low/medium/high),
  `priority_locked_at`, `culprit`, `logger`, `status_details` JSONB,
  `issue_type`, `issue_category`.
- Data migration: `is_resolved=true → status=resolved`; `is_muted=true → status=ignored`.
- `culprit` + `logger` extracted during digest from top frame / event.
- Regression detection: wake `alert.rs:437 trigger_regression_alert`
  (previously `#[allow(dead_code)]`); on new event for a resolved issue →
  reopen as `status=unresolved, substatus=regressed` + fire alert.
- `IssueService::create()` advisory-lock race fix (audit §5).

## Phase 3 — API surface

- `PUT /issues/{id}` full update (status, substatus, assignedTo, priority,
  hasSeen, isBookmarked, isSubscribed, isPublic, merge, discard).
- `PUT /issues/` bulk mutate, `DELETE /issues/` bulk remove.
- `GET /issues/{id}/hashes/`, `GET /issues/{id}/tags/{key}/`.
- Regenerate + commit `openapi.json`.

## Phase 4 — Aggregations & tracking tables

- Tags aggregation at issue level; `userCount` (unique affected users).
- `assigned_to` / `assignee_type`; `issue_activity`; `issue_comments`;
  bookmarks + subscriptions + read tracking (`hasSeen`/`seenBy`);
  user reports / feedback counter.
- Releases + `firstRelease`/`lastRelease`; auto-resolve-on-deploy.
- Issue search (`?q=` substring match, LOWER LIKE, dialect-safe; tsvector
  ranked search + query parser deferred to Phase 5).
- Stats timeseries (24h/30d), `permalink` (needs `PUBLIC_URL`).

## Phase 5 — Remaining normalization (low priority / defer)

- Span description scrubbing (`relay-event-normalization/src/normalize/span/description/mod.rs:44`).
- Grouping enhancements DSL + `grouping_config` passthrough
  (`event.rs:435`) — acceptable to defer for self-host MVP.
- PII scrubbing in grouping inputs.

---

## After backend (pending owner approval)
- `packages/client` — TypeScript types + methods for new fields/endpoints.
- MCP surface.
- `apps/webview-ui` — status/substatus UI, assignment, activity, search.
