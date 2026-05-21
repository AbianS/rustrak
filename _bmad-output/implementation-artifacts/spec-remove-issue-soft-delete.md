---
title: 'Remove Soft Delete from Issues — Hard Delete'
type: 'refactor'
created: '2026-05-21'
status: 'done'
baseline_commit: '2b38e8294ce8d3d28aa7c3e79a91607192c69c1f'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `is_deleted BOOL` on the `issues` table is dead weight — the backend's `DELETE` endpoint already promises "permanent delete", but executes a soft delete under the hood, polluting 30+ SQL queries with `AND NOT is_deleted` and accumulating garbage rows.

**Approach:** Drop the `is_deleted` column via migration, replace `UPDATE SET is_deleted = TRUE` with `DELETE FROM issues WHERE id = $1`, and strip all `AND NOT is_deleted` predicates. Client and UI require zero changes — `is_deleted` was never in the API contract.

## Boundaries & Constraints

**Always:**
- Follow /tdd: update/write tests that assert hard-delete behavior BEFORE changing service logic.
- Events and groupings must cascade-delete automatically (FK `ON DELETE CASCADE` already in place — verify at migration time).
- `is_resolved` and `is_muted` fields stay as boolean columns — status enum migration is explicitly deferred.
- Migration must include both `.up.sql` and `.down.sql`.

**Ask First:**
- The three delete integration tests are marked `#[ignore = "Session cookies..."]` but use Bearer auth, not session cookies — confirm whether to unskip them before touching the implementation.

**Never:**
- Touch `packages/client` or `apps/webview-ui`.
- Migrate `is_resolved`/`is_muted` to a status enum.
- Add recovery/undelete paths.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Delete existing issue | `DELETE /api/projects/{p}/issues/{id}` (valid Bearer) | 204; issue row + child events + groupings removed from DB | — |
| Delete non-existent | Valid project, fake UUID | 404 `AppError::NotFound` | Propagated as 404 |
| Delete wrong project | Issue belongs to project A, request targets project B | 404 | Cross-project isolation preserved |
| List after delete | `GET /api/projects/{p}/issues?filter=all` after delete | Deleted issue absent from all filter results | — |

</frozen-after-approval>

## Code Map

- `apps/server/migrations/postgres/20260521000000_remove_issue_soft_delete.up.sql` -- new migration (to create)
- `apps/server/migrations/postgres/20260521000000_remove_issue_soft_delete.down.sql` -- rollback (to create)
- `apps/server/src/models/issue.rs:26` -- `pub is_deleted: bool` to remove
- `apps/server/src/services/issue.rs` -- `delete()` + all 30+ `AND NOT is_deleted` predicates
- `apps/server/src/routes/issues.rs:191` -- doc comment says "Soft-deletes"; update to "Hard-deletes"
- `apps/server/tests/integration/issues_api_test.rs:605-720` -- 3 delete tests, all `#[ignore]`
- `apps/server/CLAUDE.md` -- mentions `is_deleted = true` in issue delete description
- `apps/server/openapi.json` -- must regenerate after route doc update

## Tasks & Acceptance

**Execution (TDD order — tests before implementation):**
- [x] `apps/server/tests/integration/issues_api_test.rs` -- Kept `#[ignore]` (blanket for whole file); strengthened `test_delete_issue_success` with direct DB query asserting row gone
- [x] `apps/server/migrations/postgres/20260521000000_remove_issue_soft_delete.up.sql` -- Drop 3 partial indexes; recreate without `WHERE NOT is_deleted`; `ALTER TABLE issues DROP COLUMN is_deleted`
- [x] `apps/server/migrations/postgres/20260521000000_remove_issue_soft_delete.down.sql` -- Reverse migration
- [x] `apps/server/src/models/issue.rs` -- Removed `pub is_deleted: bool`
- [x] `apps/server/src/services/issue.rs` -- Hard delete + all `AND NOT is_deleted` stripped; `IssueFilter::All` simplified to `WHERE project_id = $1`
- [x] `apps/server/src/routes/issues.rs` -- Doc comment updated to "Hard-deletes"
- [x] `apps/server/CLAUDE.md` -- Schema docs and action description updated
- [x] `apps/server/` -- OpenAPI regenerated; operation summary now "Hard-deletes an issue and all associated events"

**Acceptance Criteria:**
- Given an existing issue with associated events and groupings, when `DELETE /api/projects/{p}/issues/{id}` is called, then the response is 204 and querying the DB directly shows zero rows in `issues`, `events`, and `groupings` for that issue ID.
- Given a deleted issue ID, when `GET /api/projects/{p}/issues/{id}` is called, then the response is 404.
- Given a page of issues, when one issue is deleted and `GET /api/projects/{p}/issues?filter=all` is called, then the deleted issue is absent and total_count decrements by 1.
- Given an issue belonging to project A, when `DELETE /api/projects/B/issues/{id}` is called, then the response is 404 and the issue row still exists in the DB.
- Given a non-existent UUID, when `DELETE /api/projects/{p}/issues/{fake_uuid}` is called, then the response is 404.

## Design Notes

**Index rebuild:** The three partial indexes used `WHERE NOT is_deleted` to exclude soft-deleted rows from scans. After removal they become unconditional — every issue row is now "live", so the predicate is simply dropped:

```sql
-- Before
CREATE INDEX idx_issues_project_last_seen ON issues(project_id, last_seen DESC) WHERE NOT is_deleted;

-- After
CREATE INDEX idx_issues_project_last_seen ON issues(project_id, last_seen DESC);
```

**Query simplification for `IssueFilter::All`:** After removal the `All` variant becomes `WHERE project_id = $1` with no extra predicate — currently `AND NOT is_deleted` was its only filter.

## Verification

**Commands:**
- `cd apps/server && cargo build` -- expected: zero compile errors (SQLx compile-time check validates migration ran)
- `cd apps/server && cargo clippy -- -D warnings` -- expected: no warnings
- `cd apps/server && cargo test -- issues` -- expected: relevant tests pass (or are intentionally `#[ignore]` with documented reason)
- `cd apps/server && cargo run --bin gen_openapi --features openapi` -- expected: `openapi.json` updated, no diff in endpoint shape

## Suggested Review Order

**Schema change (migration)**

- Entry point: migration drops is_deleted column, purges soft-deleted rows first
  [`20260521000000_remove_issue_soft_delete.up.sql:1`](../../apps/server/migrations/postgres/20260521000000_remove_issue_soft_delete.up.sql#L1)

- SQLite table-recreation workaround (no DROP COLUMN in older SQLite)
  [`sqlite/20260521000000_remove_issue_soft_delete.up.sql:1`](../../apps/server/migrations/sqlite/20260521000000_remove_issue_soft_delete.up.sql#L1)

**Core logic**

- Hard delete replaces UPDATE SET is_deleted — CASCADE handles children
  [`issue.rs:519`](../../apps/server/src/services/issue.rs#L519)

- All list queries simplified — AND NOT is_deleted gone from every branch
  [`issue.rs:33`](../../apps/server/src/services/issue.rs#L33)

- IssueFilter WHERE clauses: All now just `project_id = $1`
  [`issue.rs:324`](../../apps/server/src/services/issue.rs#L324)

- get_by_id no longer needs deleted-row guard
  [`issue.rs:362`](../../apps/server/src/services/issue.rs#L362)

**Model**

- is_deleted field removed; SQLx compile-time check enforces migration ran
  [`issue.rs:23`](../../apps/server/src/models/issue.rs#L23)

**Tests**

- Delete test: hard DB query asserting row gone + GET→404 after delete
  [`issues_api_test.rs:633`](../../apps/server/tests/integration/issues_api_test.rs#L633)

- Wrong-project test: asserts row still exists after rejected delete
  [`issues_api_test.rs:704`](../../apps/server/tests/integration/issues_api_test.rs#L704)

**Rollback**

- Down migration: lossy-rollback warning + partial index restore
  [`20260521000000_remove_issue_soft_delete.down.sql:1`](../../apps/server/migrations/postgres/20260521000000_remove_issue_soft_delete.down.sql#L1)

## Spec Change Log
