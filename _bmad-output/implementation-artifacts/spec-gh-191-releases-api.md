---
title: 'Sentry Releases API (create + finalize) — GH #191'
type: 'feature'
created: '2026-07-18'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'c18d5f71c6f5960ef54fa073a6808a20a7c9faa5'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `sentry-cli` and Sentry's JS bundler plugins (default in Next.js/SvelteKit/Nuxt/Remix builds) call `POST .../releases/` and `PUT .../releases/{version}/` on every build. Rustrak has no `releases` table, both 404. Separately, `IssueService::finalize_release` (wired to a custom `POST /deploys`) clears "resolved in next release" markers by string inequality instead of real chronology — there's no release entity with a creation date to compare against.

**Approach:** Add a `releases` table scoped `(project_id, version)`; implement Sentry-compatible create (`POST`) and partial-update/finalize (`PUT`); make release creation trigger date-based regression clearing (matches real Sentry's `post_save` → `clear_expired_resolutions`), replacing the string comparison.

## Boundaries & Constraints

**Always:**
- Identity `(project_id, version)` unique — no org/multi-project M2M (Rustrak has no org concept).
- Version validation = Sentry's `is_valid_version`: reject `None`/empty/`.`/`..`/`latest` (case-insensitive) and `\r\n\f\x0c\t/\\`; max 200 chars.
- `POST` idempotent: repeat create on same `(project_id, version)` → 2xx (201 new / 208 exists), never 409/400.
- `PUT` is generic partial update (`ref`, `url`, `dateReleased`); setting `dateReleased` IS "finalize" — no separate status flag.
- Auth: Bearer (`ApiActor`), like `sourcemaps.rs`'s CI endpoints — not `SentryAuth`.
- `org_slug` accepted+ignored, reusing `sourcemaps.rs::org_details`'s synthetic pattern.
- On `POST` new-row (not 208): run rewritten `finalize_release` — clear an issue's `in_next_release` marker when its `last_release` maps to a row with `date_created` earlier than the new release, same project.
- Existing string-based release reads (`session.rs`, `transaction.rs`, `event.rs`, `grouping.rs`, `span.rs`, `issues.first_release`/`last_release`) stay unchanged — matches Sentry's own denormalization.
- Dual-dialect migrations (`apps/server/migrations/{postgres,sqlite}/`); regenerate+commit `openapi.json`.

**Ask First:** Whether `POST /api/projects/{project_id}/deploys` stays as a redundant manual trigger or gets deprecated now that create does this automatically.

**Never:** No commits/authors/deploy-count/owner/`Activity` timeline — unconsumed today. Don't touch release-health or any `events`/`sessions` string read path.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output | Error Handling |
|---|---|---|---|
| Create new | `POST .../releases/` `{"version":"1.2.1"}`, no row | 201, `date_released` null | N/A |
| Create duplicate | Same `(project_id, version)` again | 208, no duplicate | N/A |
| Invalid version | `"../etc"` or `"latest"` | 400, no insert | Validated before DB write |
| Finalize | `PUT .../1.2.1/` `{"dateReleased":"..."}` | 200, `date_released` set | 404 if version not found |
| Regression clear | Issue `in_next_release` at older `last_release`; newer release created, same project | Marker cleared, no manual `/deploys` needed | N/A |
| Cross-project | New release in project X | Project Y issues untouched | N/A |

</frozen-after-approval>

## Code Map

- `apps/server/src/routes/releases.rs` -- add `create_release`/`finalize_release` (PUT) handlers, mount `/api/0/projects/{org_slug}/{project_slug}/releases/`
- `apps/server/src/routes/sourcemaps.rs::org_details` -- reuse pattern for `org_slug`
- `apps/server/src/models/release.rs` (new) -- `Release`, `CreateRelease`, `ReleaseResponse`, `is_valid_version()`
- `apps/server/src/services/release.rs` (new) -- `ReleaseService::create`/`::finalize`
- `apps/server/src/services/issue.rs` -- rewrite `finalize_release` to join `releases.date_created`
- `apps/server/src/routes/issues.rs` -- existing `create_deploy`, resolve fate per Ask First
- `apps/server/migrations/{postgres,sqlite}/` -- new `releases` table pair

## Tasks & Acceptance

**Execution:**
- [x] `apps/server/migrations/{postgres,sqlite}/<ts>_create_releases.{up,down}.sql` -- `releases(id, project_id FK, version, ref, url, date_created, date_released nullable, UNIQUE(project_id, version))`
- [x] `apps/server/src/models/release.rs` -- structs + `is_valid_version()` port
- [x] `apps/server/src/services/release.rs` -- `create()` (IntegrityError-safe upsert → `(Release, bool created)`), `finalize()`
- [x] `apps/server/src/services/issue.rs` -- rewrite `finalize_release(pool, project_id, new_release_id)` to compare `releases.date_created`, not strings
- [x] `apps/server/src/routes/releases.rs` -- `POST`/`PUT` handlers, Bearer auth, `org_slug` passthrough; wire create's new-row branch to rewritten `finalize_release`
- [x] `apps/server/openapi.json` -- regenerate (`cargo run --bin gen_openapi --features openapi`)
- [x] Unit-test the I/O matrix scenarios above

**Acceptance Criteria:**
- [x] Given no release exists, when `POST` with a valid version, then a row is created and 201 returned.
- [x] Given a release exists for `(project_id, version)`, when `POST` repeats, then 208 and no duplicate.
- [x] Given an issue resolved `in_next_release` against an older release, when a newer release is created in the same project, then the marker clears automatically.
- [x] Given an invalid version (`/` or `latest`), when `POST`, then 400 and no row.

## Spec Change Log

- **2026-07-18, review loop 1** — Blind Hunter + Edge Case Hunter adversarial review found: (1) a real bug — `date_created` relied on SQL-level `DEFAULT` while `finalize_release`'s comparison bound an explicit `DateTime<Utc>`, a text-format mismatch on SQLite (the default build target) that made chronological comparisons unreliable; fixed by binding `Utc::now()` explicitly on every insert, and confirmed by a red/green test (`test_create_release_does_not_clear_marker_for_release_newer_than_the_comparison`, verified to fail on the reverted code and pass on the fix); (2) the frozen spec's "Ask First" item on `/deploys`'s fate was answered unilaterally by the implementing agent instead of being escalated — corrected by checking real Sentry's own `ReleaseDeploysEndpoint.post` (404s when the release doesn't exist, [permalink](https://github.com/getsentry/sentry/blob/a32a33a5106ce9350ccb33b406695f53067c4a9f/src/sentry/releases/endpoints/release_deploys.py#L210-L217)), confirming the 404 behavior was already correct; owner then decided to **remove `/deploys` entirely** (server route + `IssueService`'s coupling to it, `@rustrak/client`'s `createDeploy`, `@rustrak/mcp`'s `record_deploy`, plus tests and the historical `issue-165-roadmap.md` mention) rather than keep a redundant manual trigger, since `POST .../releases/` now covers the same effect automatically and matches real Sentry (no separate Deploys-triggers-clearing concept exists there either — Sentry's real Deploy object is deploy-tracking metadata only, unconnected to regression clearing). This is a wider removal than the frozen spec's Boundaries described (which assumed `/deploys` would be kept in some form) — recorded here as the resolution of that Boundary's own "Ask First" item, not a violation of it. **KEEP**: `IssueService::finalize_release` itself, and its trigger from `create_release` (now on every call, not just the new-row branch — see below), are correct and unaffected by the `/deploys` removal. Also applied 4 lower-severity patch findings in place (no revert/re-derive, per owner's explicit choice to avoid the cost of a full loopback): `create_release` now runs `finalize_release` on every call including the idempotent 208 branch (self-healing a prior call that created the row but failed before clearing ran — `finalize_release`'s own `UPDATE ... WHERE` is naturally idempotent); `get_by_version`/`finalize` now trim the version param, matching `create`; `is_valid_version`'s length check now counts chars not bytes; stale docs fixed (`apps/server/CLAUDE.md` pending-list entry removed, `openapi.json`'s `/deploys` 404 doc became moot once the endpoint was deleted). PUT-finalize intentionally still does not trigger `finalize_release` — verified against real Sentry's `post_save` signal (`if not created: return`, [permalink](https://github.com/getsentry/sentry/blob/a32a33a5106ce9350ccb33b406695f53067c4a9f/src/sentry/receivers/releases.py#L54-L61)), which only fires on Release creation, never on update — both reviewers flagged this as a bug and both were wrong.

## Design Notes

Real Sentry ties regression-clearing to release **creation**, not a separate "deploy" action ([`post_save` signal](https://github.com/getsentry/sentry/blob/a32a33a5106ce9350ccb33b406695f53067c4a9f/src/sentry/receivers/releases.py#L54-L61) → `clear_expired_resolutions`, chronological on `Release.date_added`). Rustrak's `/deploys` approximates this with a string check that can't tell newer from older. This spec makes `POST /releases/` the trigger with a real `date_created` to compare against.

## Verification

**Commands:**
- `cd apps/server && cargo test` -- green on sqlite (default)
- `cd apps/server && cargo test --features postgres` -- green on Postgres
- `cd apps/server && cargo clippy --all-targets -- -D warnings` -- clean
- `cd apps/server && cargo run --bin gen_openapi --features openapi && git diff --stat openapi.json` -- shows new routes

## Suggested Review Order

**Date-consistency fix (the critical bug)**

- Every insert now binds `Utc::now()` explicitly instead of relying on the column's SQL `DEFAULT` — the root fix for a SQLite text-format mismatch that broke chronological comparisons.
  [`release.rs:17`](../../apps/server/src/services/release.rs#L17)

- Red/green proof: fails when the explicit bind is reverted, passes with it — a positive-only clearing test couldn't have caught this.
  [`releases_api_test.rs:537`](../../apps/server/tests/integration/releases_api_test.rs#L537)

**Regression-clearing correctness**

- Compares `releases.date_created` chronologically instead of the old `last_release <> $version` string check; runs on every `create_release` call (including the idempotent 208 branch) so a prior failure self-heals on retry.
  [`issue.rs:832`](../../apps/server/src/services/issue.rs#L832)

- Route wiring: `create_release` always calls `finalize_release`; `finalize_release` (PUT) deliberately does not — matches real Sentry's `post_save` firing only on creation, not update.
  [`releases.rs:128`](../../apps/server/src/routes/releases.rs#L128)
  [`releases.rs:180`](../../apps/server/src/routes/releases.rs#L180)

- Version validation ported from Sentry's `is_valid_version`, char-count (not byte-length) against the 200-char cap.
  [`release.rs:80`](../../apps/server/src/models/release.rs#L80)

**Schema**

- New `releases` table, `UNIQUE(project_id, version)`, dual-dialect.
  [`20260718000002_create_releases.up.sql:3`](../../apps/server/migrations/sqlite/20260718000002_create_releases.up.sql#L3)

**`/deploys` removal (scope decision, see Spec Change Log)**

- Server: handler, struct, and route mount deleted; OpenAPI registration cleaned up.
  [`issues.rs`](../../apps/server/src/routes/issues.rs)
  [`openapi.rs`](../../apps/server/src/openapi.rs)

- Client: `createDeploy` resource method, type, and schema removed.
  [`issues.ts`](../../packages/client/src/resources/issues.ts)

- MCP: `record_deploy` tool removed.
  [`issues.ts`](../../packages/mcp/src/tools/issues.ts)

**Peripherals**

- RBAC/team, digest, and duplicate/cross-project/negative-case test coverage.
  [`releases_api_test.rs`](../../apps/server/tests/integration/releases_api_test.rs)
  [`digest_test.rs`](../../apps/server/tests/integration/digest_test.rs)
  [`team_rbac_test.rs`](../../apps/server/tests/integration/team_rbac_test.rs)

- Docs: stale pending-list entry removed, historical roadmap note added.
  [`CLAUDE.md`](../../apps/server/CLAUDE.md)
  [`issue-165-roadmap.md`](../../docs/sentry-compat/issue-165-roadmap.md)
