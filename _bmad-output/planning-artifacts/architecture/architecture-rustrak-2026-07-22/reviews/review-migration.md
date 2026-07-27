# Migration Feasibility Review - Rustrak Frontend and Client Contract

**Lens:** migration feasibility
**Target:** `_bmad-output/planning-artifacts/architecture/architecture-rustrak-2026-07-22/ARCHITECTURE-SPINE.md`
**Code read:** `apps/webview-ui/`, `packages/client/`, `packages/mcp/`, plus `turbo.json`, `biome.json`, `.github/workflows/ci.yml`
**Date:** 2026-07-22

**Verdict:** the path is real, but the spine's single largest omission is that it assumes a working quality gate for `apps/webview-ui` that does not exist, and its own AD-9 is the thing that has to build it. The Result conversion is mechanically tractable with one staging trick the spine does not mention; without that trick it is a big-bang.

---

## 0. The gate the spine is standing on does not exist

Before any of the numbered answers, this has to be stated, because every "can CI stay green" question depends on it.

`pnpm ci` is `turbo run test build lint format:check`. What each task actually resolves to:

| task | apps/server | packages/client | packages/mcp | apps/webview-ui | apps/docs |
| --- | --- | --- | --- | --- | --- |
| `test` | `cargo test` | `vitest run` (417) | `vitest run` (118) | **absent** | absent |
| `build` | `cargo build --release` | `tsup` | `tsc` | `next build` | `next build` |
| `lint` | `cargo clippy` | **absent** | **absent** | **absent** | absent |
| `format:check` | `cargo fmt --check` | **absent** | **absent** | **absent** | absent |
| `check-types` | present, **not in `ci`** | present, **not in `ci`** | `typecheck`, **not in `ci`** | **absent** | absent |

Two consequences, both load-bearing for this migration:

1. **No script anywhere in the repo invokes Biome.** `grep -rn "biome" --include=package.json .` returns exactly one hit: the devDependency in the root `package.json`. There is no `lefthook`, no `.husky`, no pre-commit hook. `biome.json` sets `useFilenamingConvention` to `"level": "error"` with `strictCase: true` and `filenameCases: ["kebab-case","export"]` (biome.json:69-75), and that rule has never run in CI. The spine's Consistency Conventions row — *"kebab-case, already enforced repo-wide by Biome `useFilenamingConvention` at error level"* — is **false as a description of the enforcement**, only true as a description of the config. A migration that moves ~169 files relying on that sentence will move them unchecked.

2. **For `apps/webview-ui`, the only CI gate is `next build`.** It does typecheck (no `typescript.ignoreBuildErrors` in `next.config.ts`, `tsconfig.json` has `strict: true` and includes `**/*.ts(x)`), so type errors are caught. Nothing else is. `knip` exists (`knip.json` at the app root, `"knip"` script present) and is also not in `ci` — which is why 10 dead exported Server Actions are still shipping.

AD-9 says the new suite is *"run by `pnpm test` and therefore by `pnpm ci` with no CI file changes."* That is correct only because `webview-ui` has no `test` script today; adding one is a `package.json` change, not a workflow change, so the claim holds. But the spine should say plainly that **AD-9 is not adding a test suite to an app that has tests — it is creating the app's entire test capability from zero**, and that the first `pnpm test` in `webview-ui` will be the architecture suite and nothing else.

---

## 1. `@rustrak/client` conversion to Result

### Public surface

20 resource files under `packages/client/src/resources/` (excluding `base.ts` and `index.ts`), matching the spine's count. **86 public async methods**, counted as `^  async ` inside the resource classes:

| resource | methods | resource | methods |
| --- | --- | --- | --- |
| `issues.ts` | 18 | `sessions.ts` | 3 |
| `agents.ts` | 6 | `invitations.ts` | 3 |
| `alert-integrations.ts` | 6 | `members.ts` | 3 |
| `alert-rules.ts` | 6 | `team.ts` | 3 |
| `auth.ts` | 6 | `events.ts` | 2 |
| `storage.ts` | 6 | `stats.ts` | 2 |
| `projects.ts` | 5 | `health.ts` | 1 |
| `transactions.ts` | 5 | `logs.ts` | 1 |
| `sourcemaps.ts` | 4 | `releases.ts` | 1 |
| `tokens.ts` | 4 | `spans.ts` | 1 |

Every one of them is a signature change. `BaseResource.validate()` (`packages/client/src/resources/base.ts:22`) is called **111 times** across the 20 files and currently `throw`s `ValidationError`; it becomes the second thing that must return rather than throw.

### Tests

`vitest run` in `packages/client`: **25 files, 417 tests (416 passing, 1 skipped)**.

| group | files | tests | fate |
| --- | --- | --- | --- |
| `tests/integration/*` | 22 | **327** | all touch a resource method (325 `client.<r>.<m>(` call sites); every one needs `.data` narrowing |
| `tests/unit/errors.test.ts` | 1 | **22** | constructs the 9 error classes 22 times; deleted and rewritten against the `kind` union |
| `tests/unit/schemas.test.ts` | 1 | 25 | unaffected |
| `tests/unit/user-schemas.test.ts` | 1 | 42 | unaffected |

**~349 of 417 tests (84%) need rewriting.** 67 survive untouched. 88 `rejects` assertions across 16 files become `expect(r.success).toBe(false)` plus a `kind` check.

### What the MSW mock layer assumes about errors

`tests/mocks/handlers.ts` is **1943 lines**. Its assumptions are narrower than the spine implies, and this materially undercuts confidence in the new error contract:

- **51 error responses, all 4xx. Zero 5xx and zero 429 in the shared handler file.** Breakdown: 34× `404`, 9× `400`, 4× `409`, 3× `401`, 1× `403`.
- **All 50 error bodies use the flat `{ error: '...' }` shape. The nested `{ error: { type, message } }` shape — the one the real server sends for most handlers, and the one gh-204 is about — appears zero times.** The spine records this under Deferred ("every existing test mock uses the flat shape, which is why the mismatch was never caught"), which is accurate, but it understates the consequence: **AD-3's status-to-kind mapping and its 5xx redaction rule will be validated almost entirely against fixtures that do not resemble production.**
- The only 5xx/429 coverage is 9 inline per-test overrides inside the integration files: 6× `500`, 2× `503`, 1× `502`, 2× `429`. So `retryAfter` has exactly 2 fixtures and the redaction rule that AD-3 calls its main safety property has 9.
- Exactly one `HttpResponse.error()` for the network path.
- The 4× `409` fixtures currently fall into `transformHttpError`'s `default:` branch (`packages/client/src/utils/http.ts:47`) and return a bare `RustrakError`. The spine correctly identifies this; note that the tests currently *pass* against that behaviour, so those 4 handlers' consuming tests will change meaning under AD-3.

### What cannot cleanly return a Result

No streaming exists anywhere in the client — no `.text()`, `.blob()`, `.arrayBuffer()`, no `ReadableStream`. That risk is nil. Six real problems remain:

**(a) `RustrakError` is a name collision with a runtime value.** Today `RustrakError` is an exported **class** (`packages/client/src/errors/base.ts`) and is used as a value in:
- `packages/mcp/src/errors.ts` — `err instanceof RustrakError`
- `apps/webview-ui/src/actions/auth.ts:9`, `invitations.ts:4`, `members.ts:4`, `team.ts:4` — `err instanceof RustrakError && err.statusCode === 401`
- `apps/docs/content/sdks/client.mdx:109-117` — five documented `instanceof` branches

AD-3 reuses the identical name for a **type**. For any external consumer of the published package (`publishConfig.access: public`), `import { RustrakError } from '@rustrak/client'` as a value becomes a hard build/runtime failure — not a type error they can see coming — and it ships as a **`minor`** under the 0.x convention. The spine acknowledges "breaking change taken deliberately"; it does not acknowledge that the break is *silent at the import site of a name that still exists in the docs*. Recommend either a different union name or an explicit deprecation release.

**(b) 17 sites validate the caller's *input*, not the response.** Across 9 resources: `auth.ts:33,59,114`, `issues.ts:94,131,145,229,304`, `projects.ts:61,75`, `alert-integrations.ts:42,58`, `alert-rules.ts:45,62`, `invitations.ts:15`, `members.ts:30`, `tokens.ts:42`. These call `this.validate(input, schema)` and throw `ValidationError` when the *argument* is malformed. AD-3's union has `invalid_response` and nothing for a bad argument, and AD-1 reserves `throw` for programming errors. **The spine does not decide which of these two an invalid `email` string is**, and the answer is user-visible: today `login({email:'nope', ...})` throws `ValidationError`, which is a `RustrakError` with no `statusCode`, so `actions/auth.ts:37` falls through to `{ success: false, error: 'unknown' }` and the login form shows a generic message. Under "throw for programming errors" it becomes an uncaught throw inside a Server Action. This needs an explicit decision plus a 10th `kind` or an explicit carve-out.

**(c) 11 methods return `Promise<void>`**: `projects.delete`, `issues.delete`, `tokens.delete`, `alertRules.delete`, `alertIntegrations.delete`, `invitations.revoke`, `members.upsert`, `members.remove`, `team.updateRole`, `team.remove`, `sourceMaps.uploadChunks`. `Result<void, E>` is representable but AD-2's `{ success: true; data: T }` gives `data: undefined`, and the spine never states the convention (`Result<void>` vs a distinct `Ok()` with no payload). Minor, but 11 signatures and every consumer's narrowing depends on it.

**(d) `sourceMaps.uploadChunks` is a multi-request protocol with partial failure.** `packages/client/src/resources/sourcemaps.ts:39-57` loops `chunks.length / chunksPerRequest` POSTs. A single `Result<void, RustrakError>` cannot express "batches 1-3 uploaded, batch 4 failed", which is exactly what the caller needs, because `assembleBundle` returns `missingChunks` and the recovery path is to re-upload only those. It is recoverable in practice, but the spine's blanket rule flattens information the protocol depends on. It also contains the one legitimate `throw new Error('chunksPerRequest must be a positive integer')` (line 45) — a genuine programming error that AD-1 permits, worth calling out as the reference example.

**(e) `auth` reads response headers, not bodies.** `register`, `login`, `acceptInvitation` call `response.headers.getSetCookie()` (auth.ts:40, 66, 120) and `logout()` returns `string[]` built purely from headers with no body at all (auth.ts:82-85). These are not schema-validated and there is no `invalid_response` path for them — a missing `Set-Cookie` produces a successful `Result` carrying an empty array and a silently unauthenticated session. Not caused by this migration, but AD-3's "expected outcomes are: any HTTP status, transport failure, schema failure" is not exhaustive for these four methods.

**(f) Retry ownership is unstated.** `createKyInstance` retries `[408, 500, 502, 503, 504]` on **all** methods including `post`/`put`/`patch`/`delete` (utils/http.ts:69-73). The spine's structural seed puts `isRetryable` in `errors.ts`. Two retry authorities, no statement of which wins or whether `isRetryable` is advisory. Also note `429` is *not* in ky's `statusCodes` despite `packages/client/CLAUDE.md` claiming it is — the docs and the code already disagree.

Finally, a stack-table error: the spine lists **ky 1.14.3 `[ADOPTED]`**. `packages/client/package.json` pins **`"ky": "2.0.2"`**.

---

## 2. `packages/mcp` blast radius

- **64 `await client.<resource>.<method>(...)` call sites** across 14 tool files: `issues.ts` 21, `team.ts` 9, `agents.ts` 6, `storage.ts` 6, `tokens.ts` 4, `transactions.ts` 4, `alerts.ts` 3, `projects.ts` 3, `events.ts` 2, `stats.ts` 2, and 1 each in `health.ts`, `logs.ts`, `sessions.ts`, `spans.ts`.
- Each is wrapped in its own `try { ... } catch (err) { return toMcpError(err) }` — **64 try blocks**, all funnelling to one function.
- `packages/mcp/src/errors.ts` is 4 `instanceof` checks (`NotFoundError`, `RateLimitError`, `AuthenticationError`, `RustrakError`) plus a fallback. It becomes a `switch (r.error.kind)` over 10 arms.
- Tests: **16 files, 118 tests.** 74 `mockResolvedValue` calls must become `{ success: true, data: ... }`; 19 `mockRejectedValue` calls across 9 files must become `{ success: false, error: ... }`; `tests/errors.test.ts` constructs error classes throughout and is a full rewrite. The mock client is a hand-built `vi.fn()` bag (`tests/tools/projects.test.ts:11-18`), so there is no shared adapter — every file changes.

**Mostly mechanical, with one genuine design question the spine defers.** AD-3 redacts every 5xx message inside the client. `packages/mcp` is a **debugging tool for an AI agent**. After redaction, `get_issue` against a server with a broken SQL query reports `"API error: <fixed generic string>"` and the agent has nothing to work with. The spine's "Deferred: `packages/mcp` migration detail — its call-site changes are implementation work, not invariants" is right about the call sites and wrong about this: **whether a trusted local MCP process is a "consumer" that must be protected from server internals is an architectural question, not implementation.** It deserves a sentence either way.

Second, smaller: `toMcpError`'s output strings are asserted by tests (`expect(text).toMatch(/RUSTRAK_API_TOKEN/)`). Mapping 10 `kind`s onto messages is a small copy exercise, but it is not a codemod.

---

## 3. `apps/webview-ui` restructure

169 `.ts`/`.tsx` files under `src/`.

### The 18 action files

85 exported functions, every file opening with `'use server'`. Classified by who imports them (51 files import `@/actions`: 19 are `'use client'`, 32 are server):

| population | count |
| --- | --- |
| called only from Client Components | **33** |
| called only from Server Components / layouts | **40** |
| called from **both** | **1** (`listTeam`) |
| **no importer at all — dead** | **10** |

The spine's gh-204 figures (35 client / 46 server = 81) are close but stale, and it accounts for neither of the last two rows.

The 10 dead exports are `getTransactionSpans` (`actions/transactions.ts`) and nine in `actions/alerts.ts`: `createNotificationChannel`, `deleteNotificationChannel`, `getNotificationChannel`, `listNotificationChannels`, `updateNotificationChannel`, `testNotificationChannel`, `getAlertRule`, `getIntegration`, `listAlertHistory`. These are the deprecated notification-channel vocabulary the spine says to remove, so the direction is right — but each is a live `'use server'` export today, i.e. **10 unauthenticated-by-default POST endpoints published for functions nothing calls.** That belongs in AD-5's "Prevents" as a sharper statement than "46 endpoints exist today by accident."

**`listTeam` is the case AD-5 has no answer for.** It is called from `app/(main)/settings/team/page.tsx:46` (Server Component) and from `app/(main)/projects/[id]/settings/members/members-settings.tsx:90` (`'use client'`). AD-5 says placement follows the initiator, and *"a `'use server'` file may export only async functions, so re-exports are invalid and an action that reuses a read must declare its own async function."* So `features/team/` needs `listTeam` in `data.ts` **and** a near-identical `listTeam` in `actions.ts`, differing only by directive. The spine states the mechanism but never says this duplication is the intended outcome, or how the two are named so a reviewer can tell which one a caller got.

### The six deliberate degraded fallbacks AD-4 deletes

AD-4 says *"`data.ts` and `actions.ts` both return `Result` and neither contains a `try/catch`."* Six functions currently exist *because* of their catch, and each is a product decision that must be relocated to a call site by hand:

| function | file | current fallback |
| --- | --- | --- |
| `getSessionSummary` | `actions/sessions.ts:82` | zeroed `SessionSummary` constant |
| `getSessionTimeseries` | `actions/sessions.ts:106` | `[]` |
| `getNewIssuesForRelease` | `actions/releases.ts:16` | `[]` |
| `getServerVersion` | `actions/server.ts:6` | `null` |
| `getUpdateInfo` | `actions/version-check.ts:26` | `null` |
| `getCurrentUser` | `actions/auth.ts:60` | `null` on 401, `null` + `console.error` otherwise |

`getCurrentUser` is the dangerous one: **32 server-side files depend on "null means logged out"**, and it is the auth gate in `(main)/layout.tsx`. Converting it to `Result` and moving the null decision to callers means the logged-out path is re-derived 32 times, and a mistake renders an authenticated shell to an anonymous visitor. The compiler cannot catch that — narrowing is enforced, but *which branch you put the redirect in* is not.

Note also `actions/stats.ts` documents in a comment why it deliberately has **no** catch ("zeroed counters are indistinguishable from a genuinely quiet project"). That reasoning is exactly AD-4's, and it is already in the codebase. Cite it; it is the strongest existing evidence for the rule.

`getUpdateInfo` is separately unhoused: it calls `fetch('https://rustrak.github.io/rustrak/versions.json')` directly, not through the client. AD-3's closed union has no `kind` for a third-party feed, and machine-check rule (7) forbids a `success: false` object literal outside `@rustrak/client`. Either it gets a carve-out or it is the one function allowed to keep returning `null`.

### The 57 loose route components

Only **one** directory exceeds AD-6's six-file threshold:

| directory | loose components |
| --- | --- |
| `app/(main)/projects/[id]/issues/[issueId]/events/[eventId]` | **11** |
| `app/(main)/projects/[id]/agents` | 4 |
| `app/(main)/projects/[id]` | 4 |
| `app/(main)/settings/team/components` | 3 |
| `app/(main)/settings/storage` | 3 |
| `app/(main)/projects/[id]/settings` | 3 |
| `app/(main)/projects` | 3 |
| 20 other directories | 1-2 each |

So AD-6's `_components/` rule fires exactly once. That is a good sign for the rule and worth stating in the spine — it turns an intimidating "59 loose components" into "one folder to split."

Two AD-6 violations exist today: `app/(main)/settings/team/components/` is a non-`_`-prefixed folder under `app/` holding 3 components (rename to `_components/`), and `app/(main)/projects/[id]/issues/[issueId]/events/` is a real path segment with no `page.tsx` (legal, but the machine check for rule 8 must not treat "no page.tsx" as "not a route segment" or it will flag it).

Two filename pairs collide at different depths: `settings-nav.tsx` and `settings-mobile-nav.tsx` each exist under both `app/(main)/settings/` and `app/(main)/projects/[id]/settings/`. They are genuinely different components (`SettingsNav` vs `ProjectSettingsNav`, flat list vs `NavGroup[]`). Legal under AD-6, but any check assuming unique basenames breaks.

Counts to correct: **31** `page.tsx`, not 26. **2** `error.tsx` (`app/error.tsx`, `app/(main)/error.tsx`), no `global-error.tsx` — the spine is right that it is new. `router.refresh()` appears in **14** files, not 24; **24** is the `useTransition` count.

### Files whose target location the spine leaves ambiguous

| file | lines | importers | why the spine's rules do not resolve it | suggested resolution |
| --- | --- | --- | --- | --- |
| `src/lib/chart-format.ts` | 43 | 9, spanning `projects` overview, projects list, **5 of 6 `components/charts/*` primitives**, `issue-list-card`, `metric-delta` | Passes AD-7's admission test (pure, no mocks) so it *must* leave `lib/`. But it belongs to no single feature, and `components/charts/` is declared "feature-agnostic primitives" — moving it into a feature makes a primitive import from a feature. | Name a `src/components/charts/format.ts` exception in AD-7, or widen `lib/` to "cross-feature pure formatting". Do not leave it to the migrator. |
| `src/lib/session-health.ts` | 85 | 7: projects overview page + filter + tiles, releases list + detail, `components/charts/crash-free-trend` | Three concerns in one file: URL period parsing (`RELEASE_PERIODS`, `OVERVIEW_PERIODS`, `parseReleasePeriod`, `parseOverviewPeriod`, `overviewInterval`), presentation (`pct`, `crashFreeClass`, `crashFreeColor`), and the 99/95 threshold AD-7 names as duplicated. Spans `sessions`, `releases`, `projects`. | Three-way split; AD-7 should name it, since it is the file AD-7's own "Prevents" paragraph is about. |
| `src/lib/issue-status.ts` | 65 | 2: `issue-actions.tsx` (route) and `components/issue-indicators.tsx` (shared) | Pure, so AD-7 sends it to `features/issues/`. But it returns Tailwind `bg-*` class strings — presentation, not domain — and its shared consumer lives in `components/`, which the target tree reserves for feature-agnostic primitives. | Move both: `features/issues/issue-status.ts` + `features/issues/components/issue-indicators.tsx`. State that a "shared" component with one owning feature moves into that feature. |
| `src/hooks/use-mobile.ts` | 21 | 1: `components/ui/sidebar.tsx` | The target tree has `features/<module>/hooks/` and `components/{ui,charts,icons}/`. **There is no `src/hooks/` in the target tree and no home for a UI-primitive hook.** | `components/ui/use-mobile.ts`, and delete `src/hooks/`. Otherwise the spine must admit `src/hooks/`. |
| `src/lib/platforms.ts` | 517 | 4 | The structural seed says `content/ # platforms.ts, platform-snippets.ts (1887 lines of tables)`. It is **not** all tables: it also exports `languageLabel`, `platformLabel`, `categoryPlatforms`, `searchPlatforms` — all pure, all AD-7 "derived logic". | Split: `content/platforms.ts` (the `PLATFORMS` / `PLATFORM_CATEGORIES` tables) + `features/projects/platform-catalog.ts` (the 4 functions). |
| `src/lib/platform-snippets.ts` | 1370 | 1 | Same problem: exports `renderSnippet()` alongside `PLATFORM_SNIPPETS` and `PLATFORM_DOCS`. | `content/platform-snippets.ts` + one function into `features/projects/`. |
| `src/lib/rustrak.ts` | 155 | 17 | The target tree describes it as "`createClient`, sole SDK construction site". It also exports `applySetCookies` and `clearSessionCookies`, and contains a pure `parseSetCookie()` that passes AD-7's admission test and therefore should not be in `lib/`. | `lib/rustrak.ts` keeps `createClient`; `features/auth/session-cookies.ts` takes the rest. This also unblocks the Deferred "split session acquisition from client construction" prerequisite for Cache Components. |
| `src/lib/clipboard.ts` | 39 | 8, across 5 route areas | Fails AD-7's admission test (needs `navigator`), so it is glue and stays. But AD-7 enumerates `lib/`'s survivors as a closed list — "`utils.ts`, `rustrak.ts`" — which excludes it by name. | State `lib/` as a rule, not a two-item list. |
| `src/lib/constants.ts` | 5 | 3, incl. `app/auth/login/page.tsx` | Begins with the bare string literal **`'server only'`**, which is a no-op — the real poison pill is `import 'server-only'` and this file has never had one. It also holds `APP_VERSION` read from `package.json` (static data → `content/`?) and is imported by a page under `app/`. | Fold into `features/version/`. Flag the typo explicitly: a migrator "fixing" it to `import 'server-only'` may or may not break the build depending on whether any client component pulls it in. |
| `src/lib/version.ts` | 37 | 2 (`actions/version-check.ts`, `components/update-banner.tsx`) | Pure → `features/version/`. Its consumer `update-banner.tsx` is rendered from `(main)/layout.tsx` and lives in `components/`. | `features/version/compare.ts` + `features/version/components/update-banner.tsx`. |
| `src/lib/breadcrumbs.ts` | 23 | 1 | Clean move to `features/events/breadcrumbs.ts` — but note it will then sit beside a route file already named `breadcrumbs.tsx`. Cosmetic, flag it. | `features/events/breadcrumb-summary.ts`. |
| `src/components/trend-sparkline.tsx` | — | 3: projects list cells, issues list, `issue-list-card` | Used by two different features (`projects`, `issues`). Genuinely cross-feature, not a UI primitive, not a chart primitive by the `components/charts/` convention. | Needs a named home in the spine. `components/charts/` is the least-bad. |
| `src/components/issue-list-card.tsx`, `metric-delta.tsx`, `copy-as-dropdown.tsx` | — | 2 each | Same class: a feature component with 2+ consumers. AD-6 covers route-local components and the target tree covers primitives; **nothing covers this middle population.** | Add a rule: 2+ consumers within one feature → `features/<f>/components/`; 2+ consumers across features → `components/`. |
| `src/actions/server.ts` | 13 | 1 | One function, `getServerVersion`, mapping to the client's `health` resource. The spine's module set names `version`, not `health`. | Fold into `features/version/data.ts`. |
| `src/actions/version-check.ts` | 63 | 1 | Calls an external HTTPS feed directly, bypassing the client entirely. AD-3's closed union has no `kind`; rule (7) forbids a local `success: false` literal. | Explicit carve-out in AD-3, or allow this one function to keep returning `null`. |
| `app/(main)/settings/team/components/` | 3 files | — | Non-`_`-prefixed folder directly under `app/`, which AD-6 forbids in spirit though its literal wording only bans `_` folders at the bare `app/` root. | Rename to `_components/`. |

---

## 4. Sequencing

### The hard constraint

`turbo.json` sets `build.dependsOn: ["^build"]` and `test.dependsOn: ["^build"]`, and `apps/webview-ui` depends on `@rustrak/client` via `workspace:*` resolving to `dist/`. So `packages/client` and `apps/webview-ui` are in **one `turbo run build` graph inside a single `pnpm ci` invocation**. There is no commit in which the client returns `Result` and `webview-ui` still expects throws with CI green. **As stated, AD-1 through AD-5 land together or not at all.**

### The staging trick the spine does not mention

They do not have to land together, if the client first ships the *contract* additively and the *conversion* last:

```ts
// packages/client/src/result.ts  — additive, phase 1
export async function attempt<T>(p: Promise<T>): Promise<Result<T, RustrakError>>;
```

`attempt()` converts a throwing promise into a `Result` at the call site. That lets every consumer migrate to `Result` semantics while the 86 resource methods still throw. The final flip then reduces to *deleting the `attempt(` wrapper* — a textual, type-checked deletion rather than a semantic rewrite.

One detail this forces, and the spine needs it regardless: **while the client still throws, it must throw an `Error` subclass, not a plain object.** ky's `beforeError` hook must throw, React error boundaries and Next's `error.tsx` require `Error & { digest }`, and a thrown plain object loses the stack. So phase 1 introduces `class RustrakApiError extends Error { readonly failure: RustrakError }` — the plain union carried *inside* an Error — and `attempt()` reads `.failure`. In the final phase the throw becomes `Err(failure)` and the wrapper class is deleted. Without this, phase 1 breaks every error boundary in the app.

### Recommended phases, each ending green

| phase | scope | ends green because | risk |
| --- | --- | --- | --- |
| **0a. Build the gate** | Add `check-types` (`tsc --noEmit`), `lint` (`biome check`) and `format:check` (`biome format --check`) scripts to `packages/client`, `packages/mcp`, `apps/webview-ui`. Add `check-types` to the root `ci` script. | Expect this PR to be **red on first run**: Biome has never linted 169 webview-ui files, and `useFilenamingConvention` is at error level. Budget a full pass. | Highest-value, lowest-architecture. Do it first or every later phase is unverified. |
| **0b. Prune dead code** | Delete the 10 unreferenced Server Actions. Wire `knip` into `ci`. | Pure deletion; `next build` proves it. | None. Removes 10 accidental public endpoints immediately. |
| **1. Client contract, additive** | `src/result.ts` (`Result`, `Ok`, `Err`, `unwrap`, `unwrapOr`, `mapResult`), `src/errors.ts` (the 10-arm union + `isRetryable`), `toRustrakError()`, `attempt()`, `RustrakApiError extends Error` carrying `.failure`. Add the missing `409`/`422` cases. Add **5xx redaction**. Add nested-`{error:{type,message}}` parsing and the MSW fixtures for it. | 86 method signatures unchanged; the 327 integration tests still pass. Only tests asserting a 5xx `.message` change. | The 5xx redaction is user-visible the moment it lands, including in MCP. Land it knowingly. |
| **2. Retire the error classes** | Delete the 9 error classes; update the 6 files that use them as values (`mcp/errors.ts`, 4 webview-ui actions, `docs/content/sdks/client.mdx`). Decide the `RustrakError` naming collision here. | 6 files, all in-repo. `check-types` from 0a proves it. | Breaking for external consumers, shipped as `minor`. Needs an explicit changelog callout. |
| **3. MCP to `attempt()`** | 64 call sites → `attempt(...)` + `switch (r.error.kind)`. 118 tests updated (74 `mockResolvedValue`, 19 `mockRejectedValue`, full `errors.test.ts` rewrite). | `packages/mcp` has real tests. This is the one consumer that can prove the contract. | Mechanical, apart from the redaction/debuggability decision. |
| **4. webview-ui structure, still throwing** | Create `features/<module>/`. Move `actions/*.ts` → `features/*/{data,actions}.ts` per the 33/40/1 split. Add `import 'server-only'` to the 18 `data.ts`. Duplicate `listTeam`. Move the 11 `lib/` files per the table above. Rename `team/components` → `_components`. Split `events/[eventId]`'s 11 components into `_components/`. Add `global-error.tsx`. | Largest diff, but pure motion + directive change. `tsc` + `next build` catch it. The `server-only` pill turns a leak into a compile error, which is exactly the gate you want here. | **The riskiest phase.** No behavioural tests exist. Resolve every table row in §3 *before* starting or a migrating agent will invent 15 conventions. |
| **5. webview-ui to `Result`** | Wrap `data.ts`/`actions.ts` bodies in `attempt()`. Change return types. Update the ~51 consumer files to narrow or `unwrap()`. Relocate the 6 fallbacks. Delete the 6 bespoke result types and 41 ad-hoc `success:` literals. | Discriminated-union narrowing makes every unhandled site a compile error, so `tsc` is a real gate here. | The 6 relocated fallbacks and `getCurrentUser`'s 32 dependants are **not** compiler-verifiable. Manual QA required. |
| **6. The flip** | Move `attempt()` inside `BaseResource`. 86 signatures change. Delete `RustrakApiError`. Delete every `attempt(` wrapper across mcp + webview-ui. Rewrite the 327 integration tests + 22 error unit tests. One `minor` changeset, lockstep. | The deletion is textual and type-checked end to end. | The one unavoidable big-bang, but by now it carries no semantic risk — only the client's own 349 test rewrites. |
| **7. AD-9** | Architecture suite. Rules 1, 3, 4, 5, 8 can be written after phase 4; rules 2, 6, 7, 9 only after phase 6. | `pnpm test` now exists in webview-ui from phase 0a. | Writing rule 2 (return-type assignability via `ts-morph`) before phase 6 means it asserts against a population of zero — exactly the vacuous-pass failure AD-9 warns about. Sequence it explicitly. |

**Answer to the direct question:** yes, incrementally, with green CI at every phase — *but only via the `attempt()` staging path*. Read literally, the spine describes a state change with no intermediate, and phases 1-6 collapse into one commit touching `packages/client` (86 methods + 349 tests), `packages/mcp` (64 sites + 118 tests) and `apps/webview-ui` (~120 files) simultaneously, with `next build` as the only verification on the largest third of it. That commit is not reviewable.

---

## 5. What the spine does not say that a migrating agent will need

Ordered by how much damage the omission causes.

1. **There is no test gate for `apps/webview-ui` and no Biome anywhere.** See §0. An agent reading "already enforced repo-wide by Biome" will assume renames are checked. They are not. This must be corrected in the spine text, not just fixed in a phase.

2. **`attempt()` — or whatever the staging seam is called — needs to exist in the spine.** Without it there is no incremental path. And with it, the spine must also say that the client keeps throwing an `Error` **subclass** carrying the plain union until the final flip, because ky's `beforeError` and React's error boundaries both require a real `Error`. This single paragraph is the difference between a 7-PR migration and one unreviewable commit.

3. **The `RustrakError` name is currently a runtime value.** Reusing it for a type is a silent break for external consumers, shipped as `minor`, on a name that stays in the published docs. Decide and document.

4. **17 input-validation sites have no `kind`.** Decide whether a caller passing a malformed argument is a programming error (throw) or an expected outcome (a 10th `kind`). Name the affected methods. The login form's behaviour changes either way.

5. **`Result<void>`.** 11 methods. State the convention.

6. **The six degraded fallbacks are behaviour, not code.** List them by name with their intended new call-site behaviour. `getCurrentUser`'s null contract has 32 server-side dependants and gates authentication; it deserves its own paragraph.

7. **Every table row in §3.** `chart-format.ts`, `session-health.ts`, `use-mobile.ts`, the `platforms.ts` split, the `rustrak.ts` split, and the "feature component with 2+ consumers" population. AD-7's admission test is a good test and it does not answer any of these six, because they all fail on *which* feature, not on *whether* they are derived logic.

8. **`listTeam` proves AD-5 requires duplication.** State that duplication is intended, and give a naming convention so a reviewer can tell the `data.ts` copy from the `actions.ts` copy.

9. **The MSW fixture realignment is a prerequisite, not a follow-up.** The spine has it under Deferred. But AD-3's status-to-kind map is validated by a fixture set with **zero 5xx, zero 429, and zero nested error bodies**. Realigning `handlers.ts` (adding nested-shape and 5xx fixtures) has to happen in phase 1, before the mapping it validates is trusted.

10. **AD-9 rule ordering.** Rule 2 (return-type assignability) cannot be written before phase 6 without passing vacuously. Rule 8 must not treat a segment folder with no `page.tsx` as a violation — `app/(main)/projects/[id]/issues/[issueId]/events/` is exactly that and is legal. Rule 6 must except the 4 webview-ui files that currently import client *values*, until phase 2 removes them.

11. **`src/lib/constants.ts` opens with the string `'server only'`** — a no-op that looks like a directive. Whoever touches `lib/` will find it. Say what it should become.

12. **Corrections to counts**, so an agent's floor assertions in AD-9 do not fail on day one: 31 pages (not 26), 57 loose route components (not 59), `router.refresh()` in 14 files (not 24 — 24 is `useTransition`), 85 action exports of which 10 are dead, ky 2.0.2 (not 1.14.3).

---

## 6. Risk of a half-migrated state

`apps/webview-ui` has no tests and no test script. `next build` is the only automated verification, and it verifies types and that the app compiles — nothing about behaviour.

**Where a stop is safe:** at the boundary of phases 0a, 0b, 1, 2, 3 and 6. Phases 0-2 are additive or in-repo-only; phase 3 is confined to `packages/mcp`, which has 118 real tests; phase 6 is atomic by construction. At each of these, the app is shippable and observably unchanged, with one exception: **once phase 1 lands, every 5xx message shown to a user or an MCP agent is generic.** That is a permanent, intended, and silently-shipped behaviour change; it should be in the release notes.

**Where a stop is dangerous:**

- **Mid-phase 4.** `features/` half-populated, some reads on `'use server'` and some on `import 'server-only'`, `lib/` half-emptied, `_components/` half-created. The build stays green throughout — this is pure file motion — so *nothing signals that the migration is unfinished except the directory listing*. The app ships and works. The failure mode is not breakage, it is **a codebase with two conventions and no way to tell which one a given file follows**, which is precisely the state AD-6 and AD-7 exist to end. A half-done phase 4 is strictly worse than not starting it.

- **Mid-phase 5.** The worst state. Narrowing is compiler-enforced, so `tsc` catches unhandled results — but it cannot catch a *wrong* branch. The specific hazards:
  - `getCurrentUser`'s relocated null-handling, in any of 32 files. Getting a branch backwards renders the authenticated shell to an anonymous visitor. No test exists to catch it.
  - The 5 other relocated fallbacks. A missed one turns a degraded panel into a whole-page `error.tsx`, or worse, a `Result` narrowed to a zeroed `SessionSummary` at a site that should have surfaced. `actions/stats.ts`'s own comment names the danger: a flat line at zero *"reads as 'nothing is breaking' — the most dangerous thing this page could say while wrong."*
  - AD-4 gives each of ~31 pages a per-call-site choice between `unwrap()` and degradation. Half-migrated, that choice has been made for some pages and not others, and there is no artifact recording which.
  - Compounding: `(main)/error.tsx` wires its retry button to `reset()`, which the spine's own Deferred section notes **cannot recover from Server Component errors** — so the boundary that phase 5 makes newly load-bearing has a retry button that does not work. If phase 5 stops halfway, users hitting the newly-reachable boundary get a dead-end page.

**Recommendation:** phases 4 and 5 must each be executed to completion within a single working session or branch, and each needs a **manual smoke checklist** written before the work starts — one line per route that fetches, naming the expected behaviour when its data source fails. That checklist is the only regression net that will exist. Adding component tests is a bigger investment than this migration and correctly deferred; a 31-line manual checklist is not.
