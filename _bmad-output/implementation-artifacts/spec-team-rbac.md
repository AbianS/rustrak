---
title: 'Team Management & Project-Level RBAC'
type: 'feature'
created: '2026-06-06'
status: 'done'
baseline_commit: 'f748f8cce27cb6599a2503aec74b257778b05866'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/investigations/team-rbac-investigation.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Rustrak is single-tenant: `users.is_admin` is the only role and every authenticated user sees and
mutates every project (`routes/projects.rs` ignores *which* user). There is no way to invite teammates, give them
their own login, or limit them to certain projects and certain actions.

**Approach:** Add an instance-wide team (no organizations): a global `role` on the user, a `project_members`
join table with a per-project role (`viewer | editor | admin`), and an invite-only signup via a manually-shared
token link. Enforce access in the service layer so non-admins only see and act on projects they belong to, gated
by their per-project role. Attribute bearer tokens to a user so API access inherits that user's scope.

## Boundaries & Constraints

**Always:**
- Global admins bypass all project-level checks (full access to every project + team management).
- Non-admins (`member`) see ONLY projects they are a member of; capability gated by per-project role.
- Per-project capability ladder: `viewer` = read issues/events/project; `editor` = viewer + mutate issues
  (resolve/delete) + update project; `admin` = editor + delete project + manage that project's members.
- Write BOTH `migrations/sqlite/*` and `migrations/postgres/*`; never edit existing migrations; timestamp-prefix.
- Use `AppError` + service-layer pattern; thin routes; auth via extractors (no manual header parsing).
- Backend (Rust) is built **test-first (TDD)** via the `tdd` skill: for every unit of behavior write the failing
  test first (red), make it pass (green), then refactor. No backend production code without a preceding test.
- Invitation tokens are 40-char hex (reuse `auth::token::generate_token`), single-use, with `expires_at`.
- `/auth/register` becomes invite-only (rejects signup without a valid pending invitation token).
- Regenerate and commit `openapi.json` after API changes.
- Migrate existing data: `is_admin=true → role='admin'` else `'member'`; existing seeded admin keeps full access.

**Ask First:**
- Dropping the `is_admin` column vs keeping it as a derived/legacy field (default plan: drop after data migration).
- Whether legacy bearer tokens with `user_id = NULL` keep full (admin-equivalent) access or must be reissued.
- Any change to Sentry SDK ingestion auth (`SentryAuth`) — it is out of scope and must stay project-key based.

**Never:**
- Do NOT add organizations / multi-tenancy / `activeOrganizationId` — one instance = one team.
- Do NOT store project access as text[] arrays (use the join table; keep referential integrity + cascades).
- Do NOT send invitation emails in v1 (admin shares the link manually).
- Do NOT touch the Sentry ingestion path or per-project `sentry_key` auth.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin invites teammate | POST invite `{email, role}` as admin | Creates pending invitation; returns token + accept link | 403 if caller not admin; 409 if email already a user/pending |
| Accept invitation | POST accept `{token, password, ...}` for valid pending token | Creates user with invitation's global role; consumes token; logs in | 400 expired/used/unknown token; 400 email mismatch if enforced |
| Open self-register | POST `/auth/register` without token | Rejected — invite-only | 403 registration disabled |
| Member lists projects | GET `/api/projects` as member of P1 only | Returns only P1 (and any other membership) | N/A |
| Member hits non-member project | GET `/api/projects/{id}` for project they don't belong to | 404 (do not leak existence) | 404 NotFound |
| Viewer mutates issue | PATCH/DELETE issue in a project where role=`viewer` | Rejected | 403 insufficient project role |
| Project-admin manages members | POST `project_members {user_id, role}` as project `admin` or global admin | Adds/updates membership | 403 if caller lacks project admin/global admin |
| Token inherits scope | API call with bearer token owned by a member | Resolves token→user→same project scope as that user | 401 invalid token; 403 if user lacks access |
| Remove last project admin | DELETE membership that is the only `admin` of a project | Rejected (keep at least one project admin; global admins still cover it) | 409 cannot remove last admin |

</frozen-after-approval>

## Code Map

- `apps/server/migrations/{sqlite,postgres}/*` -- new migrations: users.role, project_members, invitations, auth_tokens.user_id
- `apps/server/src/models/user.rs` -- replace `is_admin` with `role` enum; serde
- `apps/server/src/models/project_member.rs` -- NEW model + per-project role enum
- `apps/server/src/models/invitation.rs` -- NEW model + status enum
- `apps/server/src/models/auth_token.rs` -- add `user_id`
- `apps/server/src/services/{users,project,auth_token}.rs` -- role-aware queries; membership filtering
- `apps/server/src/services/access.rs` -- NEW: capability resolver `can(user, project_id, action)`
- `apps/server/src/services/invitation.rs` + `project_member.rs` -- NEW services
- `apps/server/src/auth/extractors.rs` -- `ApiAuth` exposes the user; add project-access guard usage
- `apps/server/src/routes/{projects,issues,events,alerts,sourcemaps}.rs` -- enforce per-project access/role
- `apps/server/src/routes/{invitations,team}.rs` -- NEW endpoints; register in `routes/mod.rs`
- `apps/server/src/routes/auth.rs` -- gate `/register` to invite-only; add accept-invitation
- `apps/server/src/bootstrap.rs` -- first admin gets `role='admin'`
- `packages/client/src/resources/{users,invitations,members}.ts` + schemas -- NEW client resources
- `apps/webview-ui/src/actions/{team,invitations,members}.ts` -- NEW server actions
- `apps/webview-ui/src/app/(main)/settings/team/` + project members UI + invite-accept page

## Tasks & Acceptance

**Execution:**
- [x] `apps/server/migrations/{sqlite,postgres}/<ts>_team_rbac.up.sql` (+ `.down.sql`) -- add `users.role`, migrate from `is_admin`, drop `is_admin`; create `project_members(project_id, user_id, role, created_at, UNIQUE(project_id,user_id), FK ON DELETE CASCADE)`; create `invitations(token PK, email, role, status, expires_at, invited_by, created_at, accepted_at)`; add `auth_tokens.user_id` (nullable, FK)
- [x] `apps/server/src/models/{user,project_member,invitation,auth_token}.rs` -- models + enums (`UserRole`, `ProjectRole`, `InvitationStatus`)
- [x] `apps/server/src/services/access.rs` -- `resolve_project_role(user, project_id)` + `require(action)`; global admin bypass; list-filter helper
- [x] `apps/server/src/services/{invitation,project_member}.rs` -- create/accept/revoke invite; add/update/remove/list members; enforce "keep ≥1 project admin"
- [x] `apps/server/src/services/project.rs` -- list/get filtered by membership for non-admins
- [x] `apps/server/src/auth/extractors.rs` + `routes/{projects,issues,events,alerts,sourcemaps}.rs` -- thread the authed user; enforce capability per route; 404 on non-member project access
- [x] `apps/server/src/routes/{invitations,team}.rs` + `routes/mod.rs` -- endpoints for invites, team list/role, project members
- [x] `apps/server/src/routes/auth.rs` + `bootstrap.rs` -- invite-only register, accept endpoint, first-admin role
- [x] `apps/server/src/services/auth_token.rs` + `routes/tokens.rs` -- tokens scoped to creating user; resolve token→user in `BearerAuth`
- [x] `apps/server/tests/*` + inline `#[cfg(test)]` -- TDD: write failing tests BEFORE each behavior above (red→green→refactor per the `tdd` skill); cover every I/O Matrix row (testcontainers Postgres + sqlite). Access-control ladder (`services/access.rs`) gets unit tests first.
- [x] `packages/client/src/**` -- `users`/`invitations`/`members` resources + Zod schemas + `PaginatedResponse`; tests via MSW
- [x] `apps/webview-ui/src/**` -- `/settings/team` (list, invite, change global role, copy invite link), per-project members management, invite-accept page; server actions in `src/actions/`
- [x] regenerate `apps/server/openapi.json` (`cargo run --bin gen_openapi` / project flow) and commit

**Acceptance Criteria:**
- Given a fresh instance with one bootstrap admin, when the admin invites `b@x.com` as `member` and shares the link, then `b@x.com` can set a password, log in, and sees zero projects until added to one.
- Given member `b` added to project P1 as `viewer`, when `b` opens P1 they can read issues but any resolve/delete returns 403, and P2 is absent from their project list and returns 404 directly.
- Given member `b` promoted to project `admin` on P1, when `b` adds `c` to P1 as `editor`, then `c` can resolve issues in P1.
- Given a global admin, when they access any project or the team page, then all projects and all members are visible and mutable.
- Given a bearer token created by member `b`, when used against the API, then it can only reach `b`'s projects with `b`'s capabilities.
- Given `/auth/register` called without a valid pending invitation, then the request is rejected (invite-only).

## Design Notes

Capability check is centralized in `services/access.rs` so routes stay thin:

```rust
// effective role: global admin -> all; else look up project_members(project_id, user.id)
pub enum Action { ViewProject, MutateIssue, UpdateProject, DeleteProject, ManageMembers }
pub async fn require(pool, user: &User, project_id: i32, action: Action) -> AppResult<()>;
// returns Err(AppError::NotFound) when no membership (don't leak existence),
// Err(AppError::Forbidden) when membership role is below the action's ladder rung.
```

Ladder: `viewer < editor < admin`. Map each `Action` to a minimum project role; global `admin` short-circuits to Ok.
Non-member project access returns `NotFound` (404), not `Forbidden`, to avoid leaking which projects exist.

## Verification

**Commands:**
- `cd apps/server && cargo test` -- expected: all tests pass incl. new RBAC integration tests (sqlite + postgres)
- `cd apps/server && cargo clippy --all-targets -- -D warnings` -- expected: no warnings
- `cd apps/server && cargo run --features postgres` then `cargo run` -- expected: migrations apply clean on both backends
- `pnpm --filter @rustrak/client test` -- expected: client resource tests pass (MSW)
- `pnpm ci` -- expected: turbo test/build/lint/format:check green

## Suggested Review Order

**Access-control core (start here)**

- Entry point — the single choke point all enforcement flows through (admin bypass, 404 for non-member, 403 for insufficient role).
  [`access.rs:51`](../../apps/server/src/services/access.rs#L51)

- The capability ladder: each Action → minimum project role (`viewer<editor<admin`).
  [`access.rs:29`](../../apps/server/src/services/access.rs#L29)

- The principal resolver: session OR bearer-token→user; legacy NULL-user token = admin; rejects disabled users.
  [`extractors.rs:233`](../../apps/server/src/auth/extractors.rs#L233)

**Schema & models**

- Migration: project_members + invitations + auth_tokens.user_id; users.is_admin→role data migration.
  [`team_rbac.up.sql:9`](../../apps/server/migrations/sqlite/20260606000000_team_rbac.up.sql#L9)

**Services (business logic)**

- Membership upsert/remove with the "keep ≥1 project admin" guard.
  [`project_member.rs:71`](../../apps/server/src/services/project_member.rs#L71)

- Invitation create: role + email validation, dup/pending checks.
  [`invitation.rs:17`](../../apps/server/src/services/invitation.rs#L17)

- Invitation accept: email taken from invite (unspoofable), server-side password policy, pending-guarded consume.
  [`invitation.rs:111`](../../apps/server/src/services/invitation.rs#L111)

**Routes & endpoints**

- Registration is now invite-only (always 403); accept-invitation lives in auth::configure.
  [`auth.rs:106`](../../apps/server/src/routes/auth.rs#L106)

- Project list scoped to membership for non-admins; create auto-grants the creator project-admin.
  [`projects.rs:31`](../../apps/server/src/routes/projects.rs#L31)

- New project-members endpoints (gated by ManageMembers).
  [`members.rs:150`](../../apps/server/src/routes/members.rs#L150)

**Client & UI (peripherals)**

- Typed client resource mirroring the members API (validates every response).
  [`members.ts:12`](../../packages/client/src/resources/members.ts#L12)

- Admin-guarded team settings page (list, invite, change role, copy link).
  [`team/page.tsx:16`](../../apps/webview-ui/src/app/(main)/settings/team/page.tsx#L16)

- Public invite-accept page (outside the auth guard).
  [`invite/[token]/page.tsx:18`](../../apps/webview-ui/src/app/invite/[token]/page.tsx#L18)

**Tests**

- Integration coverage of every I/O-matrix scenario + review-patch edge cases.
  [`team_rbac_test.rs:161`](../../apps/server/tests/integration/team_rbac_test.rs#L161)
