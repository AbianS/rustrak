---
title: 'Fix event digest_order collision'
type: 'bugfix'
created: '2026-07-19'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: '52c18148b0975531a1408af8d8bdfe25bde05763'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Production `23505` unique-violation storms on `events(issue_id, digest_order)`. Root cause: `digest/processors/event.rs:120-124` derives a new event's `digest_order` from `issues.digested_event_count`, but `services/storage.rs:195-199` (retention cleanup) decrements that same counter when purging old events. Since old (low-`digest_order`) events get purged while recent (high-`digest_order`) ones survive, the decremented counter falls into digest_order territory still occupied by surviving rows — every subsequent new event for that issue collides and is silently lost.

**Approach:** Remove `events.digest_order` entirely; order/paginate events within an issue by `(timestamp, id)` keyset instead — mirrors how Sentry itself orders events within a Group (`EventOrdering`, no dense per-group sequence to ever desync). `issues.digest_order` (the short-id counter) is untouched — hardening it was explored and dropped from this spec's scope; see Spec Change Log.

## Boundaries & Constraints

**Always:**
- Ship both dialects (postgres + sqlite migrations) in the same PR.
- Postgres schema changes to `events` use `CREATE INDEX CONCURRENTLY` / `DROP INDEX CONCURRENTLY`, each alone in its own migration file starting with `-- no-transaction` (sqlx-native directive — precedent: `apps/server/migrations/postgres/20260718000001_agent_perf_indexes_transactions.up.sql`). SQLite variants use plain `CREATE INDEX` (no CONCURRENTLY needed — SQLite serializes writes).
- Event ordering key is `(timestamp, id)` — `timestamp` is the SDK-reported event time (matches Sentry), not `ingested_at`.
- Deploy schema migration and the code that stops using `events.digest_order` in the same release.
- Do not remove `pg_advisory_xact_lock(project_id)` in `find_or_create_issue_and_grouping_with_lock` — it also serializes a separate grouping-key creation race, untouched by this work.
- `services/storage.rs` retention cleanup is NOT modified — its logic is already correct once nothing depends on `digested_event_count` for identity.
- `services/issue.rs`'s `SELECT MAX(digest_order) FROM issues` (issue short-id generation) is NOT touched — out of scope for this spec (see Spec Change Log).
- The down-migration for dropping `events.digest_order` must behave the same way on both dialects when data exists: refuse/fail rather than silently succeed. Postgres already fails safe (`ADD CONSTRAINT UNIQUE` aborts on a populated table with duplicate values per issue); SQLite must be made to fail equivalently, not silently re-add the column with digest_order collapsed to a placeholder.
- Update `apps/server/CLAUDE.md`'s schema/pagination docs and any other doc describing `events.digest_order`, the old `idx_events_issue_digest_order` index, or the "advisory lock + MAX(digest_order)" pattern for events, to reflect the new `(timestamp, id)` keyset.

**Ask First:**
- If `EXPLAIN ANALYZE` on the new keyset query does not show an index scan on the new composite index, halt before shipping — may need query restructuring rather than a config tweak.

**Never:**
- Do not touch the advisory lock or the grouping-key race — explicitly out of scope.
- Do not add backward-compat handling for old-format base64 `EventCursor` strings — a decode failure returning a clean 400 (client refetches page 1) is the accepted behavior.
- Do not change `EventResponse`/`EventDetailResponse`/`openapi.json`/`packages/client`/`apps/webview-ui` — `events.digest_order` was never serialized publicly (confirmed via grep); this is an internal-only change.
- Do not introduce any new counter/sequence table in this spec (that's the deferred Tier 2 work) — this spec's only identity mechanism is `(timestamp, id)`, which needs no counter at all.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Retention purge then new event (the original bug) | Issue with 4000 events; retention purges the oldest 3000; a new event digests for the same issue | Inserts successfully, sorts after the newest surviving event | N/A — this is the regression test |
| Client paginates mid-deploy with a pre-migration cursor | Old base64 `EventCursor` (old field shape) sent post-deploy | `EventCursor::decode` fails structurally | 400 Validation, client refetches page 1 |
| Burst of same-timestamp events | 50 events with identical `timestamp` | All list correctly across pages, no duplicates/skips; sub-order tie-broken by `id`, not necessarily arrival order | N/A — documented UX trade-off, matches Sentry's own behavior |
| Down-migration run on a populated `events` table (rollback) | An issue with >1 event, `digest_order` column being re-added | Fails/refuses on both dialects, does not silently collapse data | Migration error, matches Postgres's existing safe-fail behavior on SQLite too |

</frozen-after-approval>

## Code Map

- `apps/server/migrations/postgres/{ts}_drop_event_digest_order.up/down.sql` -- `ALTER TABLE events DROP COLUMN digest_order`, drop old index. Down-migration must fail on a populated table (see Boundaries), on both dialects.
- `apps/server/migrations/sqlite/{ts}_drop_event_digest_order.up/down.sql` -- sqlite equivalent; down-migration must not silently succeed with data loss (see Boundaries) — e.g. guard with a `SELECT RAISE(ABORT, ...)` trigger-style check or an explicit pre-check, whatever idiom the codebase already uses for conditional migration failure, or document why an equivalent guard isn't possible on this dialect and get explicit sign-off before merging if so.
- `apps/server/migrations/postgres/{ts}_add_events_issue_timestamp_index.up/down.sql` -- `CREATE INDEX CONCURRENTLY idx_events_issue_timestamp ON events(issue_id, timestamp DESC, id DESC)`, alone in its own file per the CONCURRENTLY constraint.
- `apps/server/migrations/sqlite/{ts}_add_events_issue_timestamp_index.up/down.sql` -- sqlite equivalent (plain `CREATE INDEX`).
- `apps/server/src/pagination/cursor.rs` -- rewrite `EventCursor` to `{order, last_timestamp: DateTime<Utc>, last_id: Uuid}`; the unused `TransactionCursor` (lines ~73-104, same file) is the exact design template, just never wired up anywhere — reuse its shape.
- `apps/server/src/services/event.rs` -- `list_paginated`: keyset on `(timestamp, id)`; `create()`: drop `digest_order` param.
- `apps/server/src/routes/events.rs` -- `next_cursor` construction uses `last.timestamp`/`last.id`.
- `apps/server/src/digest/processors/event.rs` -- remove the `digest_order` calc block (~lines 120-124). Do NOT touch the `SELECT MAX(digest_order) FROM issues` block (~lines 365-372) — that's the untouched issue short-id path, out of scope.
- `apps/server/src/models/event.rs` -- remove `digest_order` field from the `Event` struct.
- `apps/server/CLAUDE.md` -- update the Pagination, Database Schema (`events` table), and Concurrency Control sections to describe the `(timestamp, id)` keyset instead of `events.digest_order`; leave the `issues.digest_order` / advisory-lock documentation as-is (unchanged, still accurate).
- `docs/data-models-server.md` (if present and describing this schema) -- same sync as above, `events` table section only.

## Tasks & Acceptance

**Execution:**
- [x] `migrations/{postgres,sqlite}/{ts}_drop_event_digest_order.{up,down}.sql` -- add schema change, with a dialect-symmetric failing down-migration on populated tables -- removes the buggy identity source without a silent-data-loss rollback path
- [x] `migrations/{postgres,sqlite}/{ts}_add_events_issue_timestamp_index.{up,down}.sql` -- add the new composite index, `CONCURRENTLY` isolated on Postgres -- backs the new keyset query
- [x] `pagination/cursor.rs` -- rewrite `EventCursor` + its unit test (`test_event_cursor_encode_decode`), add a test asserting the old `{order, last_digest_order}` shape fails to decode -- new cursor shape, explicit old-shape rejection
- [x] `services/event.rs` -- rewrite `list_paginated`'s 4 query branches on `(timestamp, id)`; drop `digest_order` param from `create()` -- keyset pagination without the buggy counter
- [x] `routes/events.rs` -- update `next_cursor` construction -- wire the new cursor fields
- [x] `digest/processors/event.rs` -- remove per-event `digest_order` calc only -- event insert no longer depends on any counter; issue-creation path untouched
- [x] `models/event.rs` -- drop the `digest_order` field -- struct matches new schema
- [x] `apps/server/CLAUDE.md` (+ `docs/data-models-server.md` if it exists and covers this) -- sync schema/pagination docs to the new keyset -- no stale references to the removed column/index/pattern
- [x] New regression test (`tests/integration/digest_test.rs`, alongside the existing retention-cleanup coverage) -- reproduce the original bug end-to-end and confirm it's fixed

**Acceptance Criteria:**
- Given an issue whose old events were purged by retention cleanup and whose newer events survive, when a new event is digested for that issue, then it inserts without a unique-constraint error and sorts after the newest surviving event.
- Given the events-list endpoint under load, when the keyset query runs under `EXPLAIN ANALYZE`, then the plan shows an index scan on `idx_events_issue_timestamp`, not a sequential scan.
- Given the down-migration for `events.digest_order`, when run against a populated table on either dialect, then it fails/refuses rather than succeeding with silently collapsed data.
- Given the full test suite, when run under both `sqlite` (default) and `--features postgres` (testcontainers), then all tests pass and `cargo clippy --all-targets -D warnings` is clean on both feature sets.
- Given `apps/server/openapi.json`, `packages/client/`, `apps/webview-ui/`, `apps/server/CLAUDE.md`, when grepped for `digest_order` post-change, then only `issues.digest_order`-related references remain, and none of them describe the removed events-level mechanism.

### Review Findings

**Source:** 3-reviewer adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor), triaged 2026-07-20. Acceptance Auditor found zero spec violations. 7 findings dismissed as noise/false-positive/already-spec-compliant (not listed here).

- [x] [Review][Decision] Event ordering now trusts unclamped, client-controlled SDK `timestamp` — Removing the monotonic `digest_order` counter means the events-list "newest first" view is driven entirely by the SDK-reported `timestamp` (`apps/server/src/services/event.rs` `create()`/`list_paginated`), which can be backdated, clock-skewed, or replayed hours late by a buggy/malicious SDK. **Resolved 2026-07-20 (Abian): accept as-is** — matches the spec's stated Sentry-parity design (Sentry's own `EventOrdering` accepts the same trade-off, no clamping). No code change.

- [x] [Review][Patch] SQLite index-scan claim in doc comment is unverified [apps/server/src/services/event.rs:18-20] — **Fixed 2026-07-20:** softened the doc comment to only assert the confirmed Postgres index-scan behavior (`EXPLAIN ANALYZE`), and note SQLite's row-value comparison support is syntactic-only with its planner behavior unverified, instead of claiming both dialects plan the same way.
- [x] [Review][Patch] No automated test covers the ASC keyset branch of the retention-purge collision fix [apps/server/tests/integration/digest_test.rs:573 `test_new_event_after_retention_purge_does_not_collide`] — **Fixed 2026-07-20:** extended the regression test with an ASC/no-cursor page (limit 1) followed by an ASC/with-cursor page, asserting the newly digested event still sorts last and no event is skipped or duplicated. `cargo test test_new_event_after_retention_purge_does_not_collide` passes.

- [x] [Review][Defer] `EventCursor.order` is never validated against the `order` query param [apps/server/src/services/event.rs:32, apps/server/src/routes/events.rs:58-69] — deferred, pre-existing. If a client reuses a cursor issued for one `order` value with a different `order` param, the keyset boundary silently applies to the new direction (events can be skipped/duplicated). Same gap existed with the pre-diff `digest_order`-based `EventCursor` (it also had an unchecked `order` field) — not introduced by this diff.
- [x] [Review][Defer] Late-digesting event can be permanently missed within an in-progress pagination session [apps/server/src/services/event.rs:50-99] — deferred, pre-existing. If an event finishes async digest after a client has already paged past its `(timestamp, id)` position, it's omitted from that session until the client restarts from page 1. Inherent to keyset pagination generally (existed conceptually under the old digest_order counter too).
- [x] [Review][Defer] `CREATE INDEX CONCURRENTLY IF NOT EXISTS` can silently leave an INVALID index behind on a retried/interrupted migration [apps/server/migrations/postgres/20260719000001_add_events_issue_timestamp_index.up.sql] — deferred, pre-existing. If the concurrent build is interrupted, Postgres leaves the index `INVALID`; a retry sees the name already exists (`IF NOT EXISTS`) and skips creation, leaving it permanently unused with no error surfaced. Established codebase pattern (same as `20260718000000_agent_perf_indexes.up.sql` / `20260718000001_agent_perf_indexes_transactions.up.sql`), not introduced here — worth a follow-up migration health-check, not blocking.
- [x] [Review][Defer] `test_list_events_order_desc`/`test_list_events_order_asc` never run in CI — the file-wide `#[ignore = "Session cookies not preserved..."]` predates this diff, but the stated reason doesn't apply: these endpoints use Bearer-token auth (`ApiActor`), not session cookies [apps/server/tests/integration/events_api_test.rs:386,466] — deferred, pre-existing. `cargo test` runs with no `--include-ignored` anywhere in CI (`.github/workflows/ci.yml` → `pnpm run ci` → `cargo test`), so this diff's own API-level ordering verification never executes automatically. Ignore attribute applies file-wide (14 tests); same root cause already tracked as D-10 in `deferred-work.md` for a different test file.

## Spec Change Log

- **Triggering finding (bad_spec, review_loop_iteration 0→1):** Adversarial review (Blind Hunter + Edge Case Hunter, parallel review of the first implementation pass) found that the Tier 2 hardening — a `project_issue_counters` table replacing `issues`'s `SELECT MAX(digest_order)+1` scan — reintroduces the exact bug class this spec exists to fix, one table over: the counter is seeded once at migration time; any old-binary instance still live during a rolling/mixed-version deploy window continues using the scan-based mechanism, which it can't reconcile with the new counter table (it doesn't know the table exists). A new-code instance reading the frozen counter can then assign a `digest_order` an old-code instance already used moments earlier, colliding on `UNIQUE(project_id, digest_order)`.
- **What was amended:** Tier 2 removed from this spec's scope entirely — no `project_issue_counters` table, no counter-upsert code, no backfill, no Tier-2-specific tests. `issues.digest_order` generation is explicitly left untouched (still the pre-existing `MAX(digest_order)+1` scan under the advisory lock, which has no known active bug). Folded in three `patch`-tier fixes the same review surfaced for the Tier 1 work, now part of this spec's scope: (1) the down-migration for `events.digest_order` must fail symmetrically on both dialects when data exists, not silently succeed on SQLite while Postgres fails safe; (2) `apps/server/CLAUDE.md` (and `docs/data-models-server.md` if applicable) must be updated to match the new schema — the first implementation pass left them stale; (3) added an explicit cursor-decode-rejection test for the old shape.
- **Known-bad state avoided:** A second production incident, structurally identical to the one this spec fixes, on `issues.digest_order` instead of `events.digest_order`, triggered by any future rolling or migrate-ahead-of-deploy pipeline.
- **KEEP instructions (validated correct in the reverted implementation pass, re-derive identically):** The Tier 1 approach in full — the migration split between `DROP COLUMN` and the `CONCURRENTLY` index build (required, can't share a transaction), the `EventCursor` rewrite mirroring the existing-but-unused `TransactionCursor`'s `{order, last_X, last_id}` shape, the 4-branch `(timestamp, id)` row-wise keyset queries in `list_paginated` (confirmed via `EXPLAIN ANALYZE` against a real Postgres container with 250k events to use an index scan, not a seq scan, on all three query shapes: DESC no-cursor, DESC with cursor, ASC), and the `test_new_event_after_retention_purge_does_not_collide` regression test design (purge old events via the real `StorageService::execute_cleanup` path, then digest a new event for the same issue, assert no collision). None of this needs to change — only the Tier 2 work and the three folded-in patches are new.
- **Deferred:** Tier 2 (issue digest_order hardening) recorded in `deferred-work.md` as its own future spec, to be designed with rolling-deploy safety as a first-class constraint from the start (e.g. reconciling the counter against live `MAX(digest_order)` rather than a one-time backfill, or an explicit documented operational constraint — a decision for that spec, not this one). Also deferred: `issues.digest_order` reuse after an issue's highest-numbered sibling is deleted (pre-existing behavior, not a regression from this work, both the current scan and any future counter-based Tier 2 share this limitation unless deliberately designed against it).

## Design Notes

Row-wise keyset comparison: `WHERE issue_id = $1 AND (timestamp, id) < ($2, $3) ORDER BY timestamp DESC, id DESC` — Postgres plans row-constructor comparisons as an index range scan against a matching multicolumn btree index; confirmed in the reverted pass via `EXPLAIN ANALYZE` against a real Postgres container (250k events / 50 issues) — re-confirm again in this pass, don't skip the check just because it passed once.

Sentry precedent (context only, not to re-derive): per-event ordering within a Group is `(timestamp, id)`, no dense sequence at all (`EventOrdering`, `models/group.py`) — this spec ports that pattern into Rustrak's existing Postgres-only model. It does NOT adopt Sentry's separate nodestore/Snuba storage split (out of scope, contrary to Rustrak's lightweight single-Postgres design goal), and does NOT port Sentry's `Counter`/`short_id` pattern in this spec (that was Tier 2, deferred — see Spec Change Log).

## Verification

**Commands:**
- `cargo test` (sqlite, default features) -- expected: all pass
- `cargo test --features postgres` (testcontainers) -- expected: all pass
- `cargo clippy --all-targets -D warnings` (both feature sets) -- expected: clean
- `cargo fmt --check` -- expected: clean

**Manual checks (if no CLI):**
- Run `EXPLAIN ANALYZE` on the new events keyset query against a populated `events` table; confirm index scan usage on `idx_events_issue_timestamp`.
- Attempt the down-migration against a seeded/populated table on both dialects; confirm both fail rather than one silently succeeding.
