---
title: 'AD-10 phase 3b: move every consumer onto Result, and land field errors in the forms'
type: 'refactor'
created: '2026-07-23'
status: 'done'
baseline_commit: '474c80621db59dcafb5c0a729f7170b11ab698a9'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-rustrak-2026-07-22/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/phase-3b-consumer-inventory.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** phase 3a converted `@rustrak/client` to return `Result` and deliberately left its consumers behind, so `packages/mcp` and `apps/webview-ui` do not compile. Four CI tasks have been red on purpose since then. Separately, the field-error wire contract landed with no consumer, so the data is on the wire and no form reads it.

**Approach:** convert every consumer in one pass, and while editing each form, wire it to `fields`. Doing these as two passes would mean touching the same files twice.

**This is the phase that makes the repo mergeable again.** It is done when `pnpm run ci` exits 0.

## Boundaries & Constraints

**Always:**
- Follow `phase-3b-consumer-inventory.md`. It classifies all 142 call sites and was produced from a full trace; do not re-derive it, but do verify a site before changing it.
- **`getCurrentUser` distinguishes three states**, per the inventory: authenticated, anonymous, unavailable. Only `anonymous` redirects to login. `network` and `server_error` must render an error surface instead, or a flaky connection becomes a login loop that logging in cannot fix.
- A form maps `fields` onto react-hook-form **only for names the form actually registers**. React-hook-form keeps an error on an unregistered name until `clearErrors()` is called by hand, so an unknown name would leave a permanent error with no visible input. Unknown names fall through to `root.serverError`.
- Where a UI field name differs from the API key, the mapping is explicit. The integration dialogs pack every credential into one `credentials` object, so their paths are dotted (`credentials.url`).
- Every action keeps its current failure policy unless the inventory says otherwise. An action that deliberately swallows into a fallback keeps doing so; the four such sites are named in the inventory.

**Ask First:**
- Any change to `packages/client` or `apps/server`. Their contract is settled; if a consumer needs something the contract does not offer, that is a finding to report, not a change to make.
- Restructuring `apps/webview-ui` into `features/`. That is AD-10 phase 6 and is deliberately not this.
- Adding a dependency.

**Never:**
- Do not reintroduce `try`/`catch` around a client call. The client no longer throws; a catch there can only hide a programming error.
- Do not use `unwrapOr` to make a page compile. It renders the same empty state for "no data" and "the server is down", which is the regression this whole conversion exists to prevent.
- Do not weaken or delete a test to go green.
- Do not add per-field errors to **login**. Saying "this email exists but the password is wrong" is user enumeration. It stays deliberately vague, and the comment saying so stays.

## I/O & Edge-Case Matrix

| Scenario | Behaviour |
|---|---|
| Session expired | `anonymous`, redirect to `/auth/login` |
| API unreachable or 5xx while checking auth | `unavailable`, render an error surface, **no redirect** |
| Server names a field the form registers | `setError(field)` with the app's own copy |
| Server names a field the form does not register | `setError('root.serverError')`, never the unknown name |
| Server names no field | form-level error plus toast, as today |
| `code` is `custom` | render the server's `message` verbatim |
| 5xx anywhere | the fixed generic message; any test asserting a 5xx body text must be updated |
| MCP tool receives a failure | `isError: true` content, never a throw |

</frozen-after-approval>

## Code Map

- `phase-3b-consumer-inventory.md` -- 315 lines, the authority. Sections: the 8 `getCurrentUser` sites, every `instanceof` check, the 64 MCP call sites, and the 78 webview sites split into pass-through (62), union-mapping (11), fallback-swallowing (4) and `.catch()` (1).
- `packages/mcp/src/errors.ts` -- `toMcpError` branches on `instanceof` across 4 classes; becomes a `kind` switch.
- `packages/mcp/src/tools/*.ts` -- 64 calls, each in a `try`/`catch` that becomes a `success` check.
- `apps/webview-ui/src/actions/auth.ts:63-76` -- the `getCurrentUser` source, currently collapsing every failure to `null`.
- `apps/webview-ui/src/app/(main)/layout.tsx:13` -- the root auth gate for the whole app. A wrong branch here **is** the login loop.
- `apps/webview-ui/src/app/(main)/projects/new/create-project-form.tsx:159-181` -- the app's only message string-matcher.
- `apps/webview-ui/src/app/(main)/projects/[id]/settings/general/general-settings-form.tsx` -- raw `useState`, no react-hook-form, so nothing to bind a field to.
- `apps/webview-ui/src/app/auth/login/login-form.tsx` -- stays vague on purpose.
- `apps/docs/content/sdks/client.mdx` -- the only live docs page on the throwing API. The 8 changelog hits are historical and must not be edited.

## Tasks & Acceptance

**Execution:**
- [x] `packages/mcp/src/errors.ts` -- `toMcpError` switches on `kind`. Then the 64 call sites across `src/tools/*.ts`, dropping their `try`/`catch`.
- [x] `apps/webview-ui/src/actions/auth.ts` -- give `getCurrentUser` the three-state return the inventory specifies, and stop collapsing every 401 into `invalid_credentials`, which is why `Account is disabled` never reaches the user.
- [x] The 8 `getCurrentUser` consumer sites -- redirect on `anonymous` only. Do `(main)/layout.tsx` first and confirm the app still gates correctly before the other seven.
- [x] The remaining 70 webview call sites, following the inventory's four groups.
- [x] One shared helper mapping `fields` onto a form, guarded against unregistered names.
- [x] `create-project-form.tsx` -- delete the string matcher, use the helper.
- [x] `general-settings-form.tsx` -- convert to react-hook-form with the create form's Zod rules, which it currently lacks, then use the helper.
- [x] `invite-form.tsx`, the three dialogs in `integrations-list.tsx`, `alerts-settings.tsx`, `team-members-list.tsx`, `members-settings.tsx` -- use the helper.
- [x] `login-form.tsx` -- behaviour unchanged; keep and sharpen the comment naming user enumeration.
- [x] `apps/docs/content/sdks/client.mdx` -- rewrite for the Result API.
- [x] Tests for the two behaviours that can regress silently: an auth failure that is **not** `unauthenticated` does not redirect, and a `fields` entry naming an unregistered field does not call `setError`.

**Acceptance Criteria:**
- Given `pnpm run ci`, then it exits 0. Every task green, for the first time since phase 3a.
- Given the API is unreachable, when a page that gates on auth renders, then the user is **not** sent to `/auth/login`.
- Given a taken project slug, when the create form submits, then the slug input is marked and no toast appears.
- Given a taken name while the slug was auto-derived, then the **name** input is marked, not the read-only slug input.
- Given `grep -rn "message.includes" apps/webview-ui/src`, then there are no hits.
- Given `grep -rn "instanceof" packages/mcp/src apps/webview-ui/src`, then no hit is against a client error class.
- Given `grep -rn "unwrapOr" apps/webview-ui/src`, then there are no hits.

## Design Notes

Order matters. `packages/mcp` is 64 calls in one shape and has its own suite, so it converts fast and proves the pattern. Then `actions/auth.ts` and the root layout, because the login loop is the one regression a user would actually notice. Then the bulk of the call sites, then the forms.

The inventory's four-group split is the useful axis for the 78 webview sites: 62 pass-throughs are near-mechanical, 11 already map to a union and mostly simplify, 4 swallow into a deliberate fallback and must keep doing so, and 1 uses `.catch()`.

`webview-ui`'s current test suite covers a pure helper and one presentational component, and touches no action. It will stay green through this entire change whether or not the conversion is correct. Treat that green as blindness, not as evidence, and lean on `check-types` and `build` instead.

## Verification

**Commands:**
- `pnpm --filter=@rustrak/mcp test`, `check-types`, `build` -- expected: exit 0 each.
- `pnpm --filter=webview-ui test`, `lint`, `format:check`, `check-types`, `build` -- expected: exit 0 each.
- `pnpm --filter=@rustrak/client test` -- expected: exit 0, unchanged.
- `cd apps/server && cargo test` -- expected: exit 0, unchanged.
- `pnpm run ci` -- expected: **exit 0**.

**Manual checks:**
- Stop the API, load a gated page, and confirm the page reports an outage rather than redirecting to login.
- Create a project with a taken slug and confirm the slug input goes red with the app's own copy.

### Review Findings

Three-layer adversarial review (Blind Hunter + Edge Case Hunter + Acceptance
Auditor) at `review_loop_iteration: 1`, 2026-07-27. All 7 acceptance criteria
pass and `pnpm run ci` exits 0; every finding below is behaviour the criteria
do not reach.

Three reviewer claims were checked and did not survive: the `packages/client`
removal is **not** a runtime break (no schema is re-exported from
`src/index.ts`, so none reaches `dist`); the `getEventNavigation` truncation is
**pre-existing**, verified byte-identical at the baseline commit; and the
`_names.mount` guard defect is **currently unreachable**, because the server
never names a field under `credentials` (complete `with_field` inventory:
`name`, `slug`, `role`, `token`, `email`, `alert_type`).

- [x] [Review][Decision] **RESOLVED — ratified as-is, no changeset.** Abian's call: they are deprecated aliases nobody imports, and the type-only break travels without a changelog note. `packages/client` changed under the Ask First boundary — 9 deprecated symbols deleted (`ChannelType`, `NotificationChannel`, `CreateNotificationChannel`, `UpdateNotificationChannel`, the three `*NotificationChannel*` schemas, `mockNotificationChannels`). Nothing in the repo imported any of them, so the removal was not needed to compile. Only the 4 type aliases reach the published `dist/index.d.ts`; the schemas are never re-exported and the mock is not published. Types-only break for a TS consumer of `@rustrak/client`, landed with no changeset in a phase scoped to consumers. Ratify or revert.
- [x] [Review][Decision] **RESOLVED — leave as is.** The route `error.tsx` boundary is accepted as the right answer for a transport failure; do not raise this again. Note the one case it does not cover, kept as a patch: `members-settings.tsx:90` is a `.then()` inside a `useEffect`, so it never reaches the boundary. Policy on `catch` around Server Action invocations — the diff deleted all 17 on the inventory's premise that they are dead once the client stops throwing. The client does stop throwing, but the action RPC itself still rejects (offline tab, Next 500, deployment-ID skew after a redeploy). `grep -rn catch src/app src/components` now returns zero handlers on any action call, so those failures escalate from "toast, stay on page" to the route `error.tsx` boundary. Decide whether that is the intended trade.
- [x] [Review][Decision] **RESOLVED — deferred to the ledger as D-34.** `logout()` discards its failure and returns `void` — on a failed server logout the local cookie is dropped anyway, so the browser looks signed out while the server session stays live. The comment argues this beats leaving the cookie, which is true, but the signature makes it impossible for a caller to tell the user. `header.tsx:29` is a bare `await logout()`. [apps/webview-ui/src/actions/auth.ts:69-83]
- [x] [Review][Decision] **RESOLVED — deferred to the ledger as D-35.** Partial bulk results are invisible — `bulkUpdateIssues`/`bulkDeleteIssues` changed from `Promise<void>` to `Result<{updated:number}>`/`Result<{deleted:number}>` in this diff, and no caller reads the count (`grep '\.updated\b|\.deleted\b'` over `src` returns nothing). Select 5, server applies 2, `success` is true, selection clears, 3 reappear unchanged with no message. Decide whether to surface it. [apps/webview-ui/src/actions/issues.ts:90-110]
- [x] [Review][Decision] **RESOLVED — all four ratified individually by Abian, 2026-07-27.** (a) The task line "behaviour unchanged" for `login-form.tsx` is obsolete; the change is an improvement the inventory suggested. (b) The refusal on `Account is disabled` stands; the two-step server fix stays in the ledger. (c) The spec's AC-7 and the inventory's `unwrapOr` prescription were unimplementable together and AC-7 won; the contradiction is recorded here so it does not reappear. (d) The inventory's 142-call-site count is now 10 lower by deliberate deletion, not by omission. Four auditor ratifications, one call — (a) `login-form.tsx` behaviour did change despite the task saying "behaviour unchanged", but only to split `network` off into its own copy, which the inventory suggested; the user-enumeration Never rule is honoured. (b) The `Account is disabled` half of the `auth.ts` task was refused, with the reason on record in code and in the ledger. (c) `server.ts` surfaces the `Result` instead of the inventory's `unwrapOr`, which the spec's own AC-7 forbade; the two documents were unimplementable together. (d) Dead exports removed from `alerts.ts`/`transactions.ts` — AD-5 phase-6 work pulled forward. Each is defensible; none was authorised.
- [x] [Review][Patch] `general-settings-form` never calls `handleSubmit`, so server errors neither clear nor expire [apps/webview-ui/src/app/(main)/projects/[id]/settings/general/general-settings-form.tsx:76-122,161-173]
- [x] [Review][Patch] Every form discards `error.message` on a failure that names no field, so an outage, a revoked role and an expired session all render one identical sentence [apps/webview-ui/src/lib/form-errors.ts:98]
- [x] [Review][Patch] `ServiceUnavailable` asserts an outage for kinds that are not outages, and its advice cannot work for them [apps/webview-ui/src/components/service-unavailable.tsx:31-33,64-65]
- [x] [Review][Patch] The `applyServerFieldErrors` guard does not mean what its comment claims — `_names.mount` is cumulative under `shouldUnregister: false`, so an unmounted field still counts as registered [apps/webview-ui/src/lib/form-errors.ts:117-131]
- [x] [Review][Patch] `rate_limited` loses `retryAfter` on the way to the user [apps/webview-ui/src/components/service-unavailable.tsx:62-63]
- [x] [Review][Patch] The login action's `default:` arm absorbs `rate_limited` and tells the user to retry immediately [apps/webview-ui/src/actions/auth.ts:36-56]
- [x] [Review][Patch] `listTeam().then()` has no rejection handler, so a failed action RPC is an unhandled promise rejection; the comment's claim that a remount retries is also false (deps are `[canManage]`) [apps/webview-ui/src/app/(main)/projects/[id]/settings/members/members-settings.tsx:87-99]
- [x] [Review][Patch] `turbo.json` adds the self-build edge repo-wide, so `cargo check` now waits on `cargo build --release`; narrow it to `webview-ui#check-types` [turbo.json:36]
- [x] [Review][Patch] `apps/docs/next-env.d.ts` is a generated file whose banner forbids editing, checked in with a value that flips between `next dev` and `next build` [apps/docs/next-env.d.ts:3]
- [x] [Review][Patch] `getEventNavigation`'s new doc comment claims to have removed a silent truncation that is still there [apps/webview-ui/src/actions/events.ts:60-73]
- [x] [Review][Patch] `toMcpError` renders 9 kinds as one identical string, so the model cannot tell a retryable failure from a deterministic one in front of two destructive tools; `isRetryable` is exported and unused [packages/mcp/src/errors.ts:39-40]
- [x] [Review][Patch] Ten `@throws <deleted class>` tags in the file every new action is copied from [apps/webview-ui/src/actions/projects.ts:19,33,34,48,49,64,65,66,80,81]
- [x] [Review][Patch] `client.mdx` tells the reader to check `success` on writes and then shows five calls that do not [apps/docs/content/sdks/client.mdx]
- [x] [Review][Patch] `login-form.tsx` hardcodes `'root.serverError'` instead of importing `SERVER_ERROR_PATH`, making the coupling to `FormRootError` three-way and unenforced [apps/webview-ui/src/app/auth/login/login-form.tsx:82]
- [x] [Review][Patch] `mcpJson` on a `Result<void>` emits `text: undefined`, which fails the MCP content schema at the transport boundary; no call site hits it today but it is the default helper [packages/mcp/src/errors.ts:61-68]
- [x] [Review][Patch] `getAllReleaseHealthRows` loops on a server-supplied `total_pages` with no cap, unlike its sibling's `MAX_NAV_PAGES` [apps/webview-ui/src/actions/sessions.ts:60-77]
- [x] [Review][Patch] Duplicate field names overwrite rather than accumulate, and the lost message never reaches the form-level slot [apps/webview-ui/src/lib/form-errors.ts:83-94]
- [x] [Review][Patch] A `CounterTiles` failure makes the "New issues" tile vanish from the grid rather than fail visibly [apps/webview-ui/src/app/(main)/projects/[id]/overview-tiles.tsx:112-131]
- [x] [Review][Patch] `getNewIssuesForRelease` is now awaited after `loadAll` resolves, adding a serial round-trip that the deliberate failure-isolation did not require [apps/webview-ui/src/app/(main)/projects/[id]/releases/[release]/page.tsx]
- [x] [Review][Patch] This spec's own Execution checklist is entirely unchecked with `status: in-progress`, so nothing distinguishes "done" from "skipped" without reading the code
- [x] [Review][Defer] `getEventNavigation` truncates silently at the 50-page cap, rendering "0 of N" and pointing "next" at the oldest event [apps/webview-ui/src/actions/events.ts:103,119-131] — deferred, pre-existing
- [x] [Review][Defer] The three integration dialogs' `credentials.*` field maps are dead code — the server never names a field under `credentials` [apps/webview-ui/src/app/(main)/settings/integrations/integrations-list.tsx:105-121] — deferred, pre-existing
- [x] [Review][Defer] `docs/architecture-client.md` and `.claude/skills/typescript-api-client/SKILL.md` still teach the deleted nine-class hierarchy [docs/architecture-client.md:168-192] — deferred, pre-existing

**Found while applying the patches, fixed in the same pass:** turbo's `build`
task captured `.next/dev/**` as an output. `next dev` writes that directory and
`next build` never does, and `tsconfig.json` type-checks `.next/dev/types/**`,
so a cached build restored one machine's dev artifacts and `check-types` failed
with route errors unrelated to any source file. Now excluded alongside
`.next/cache/**` in `turbo.json`. This is the same family as the reverted
`next-env.d.ts` finding: a generated artifact treated as durable output.
