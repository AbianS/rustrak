---
title: 'AD-10 phase 3b: consumer inventory for the @rustrak/client Result conversion'
type: 'inventory'
created: '2026-07-23'
produced_by: 'spec-ad10-p3a-client-result.md'
baseline_commit: 'b13da5871d64af2555b04871bfb73e4dcf0848ae'
---

# Phase 3b consumer inventory

Phase 3a converted `@rustrak/client` so every public resource method returns
`Result<T, RustrakError>` instead of throwing. **Nothing in `packages/mcp` or
`apps/webview-ui` was touched.** This file is the complete list of what that
breaks and what each site has to become.

`apps/docs` is unaffected: it has no dependency on `@rustrak/client`
(`docs:build` is green after 3a).

## The shape change, in one place

```ts
// before
const project = await client.projects.get(1);   // throws NotFoundError, ...

// after
const result = await client.projects.get(1);    // never throws for an expected failure
if (!result.success) { /* result.error.kind is one of 13 literals */ }
const project = result.data;
```

| Before | After |
|---|---|
| `throw new NotFoundError(msg)` | `{success: false, error: {kind: 'not_found', status: 404, message}}` |
| `err instanceof NotFoundError` | `error.kind === 'not_found'` |
| `err instanceof AuthenticationError` | `error.kind === 'unauthenticated'` |
| `err instanceof AuthorizationError` | `error.kind === 'forbidden'` |
| `err instanceof BadRequestError` | `error.kind === 'validation'` (server 400) |
| `err instanceof ValidationError` | `error.kind === 'invalid_response'` (our schema) **or** `'invalid_request'` (caller input) |
| `err instanceof RateLimitError` | `error.kind === 'rate_limited'`, `error.retryAfter?: number` |
| `err instanceof ServerError` | `error.kind === 'server_error'` |
| `err instanceof NetworkError` | `error.kind === 'network'` |
| `err instanceof RustrakError` (base) | no equivalent; every failure has a `kind`, so the catch-all is `default:` |
| `err.statusCode` | `error.status` (absent on `invalid_request` / `network` / `invalid_response`) |
| `err.retryable` | `isRetryable(error)` |
| `err.getValidationDetails()` | **gone**; Zod issues are no longer carried |
| `ServerError.message` (server text) | **gone**; always `SERVER_ERROR_MESSAGE` |

Removed exports that 3b must stop importing: `RustrakError` (as a class),
`NetworkError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`,
`BadRequestError`, `RateLimitError`, `ServerError`, `ValidationError`.

New exports available: `Result`, `Ok`, `Err`, `unwrap`, `unwrapOr`,
`mapResult`, `RustrakError` (type), `RustrakErrorKind`, `isRetryable`,
`SERVER_ERROR_MESSAGE`.

## Two behaviour changes that are not mechanical

1. **`getCurrentUser` no longer resolves to a user; it can fail with
   `unauthenticated`.** See the dedicated section below. This is the one item
   in this file that can produce a user-visible regression (a login loop) if
   converted mechanically.
2. **5xx messages are redacted inside the client.** Every consumer that renders
   `err.message` on a 500 will now render the fixed
   `SERVER_ERROR_MESSAGE` string. That is intended, but the affected toasts
   (webview) and tool outputs (MCP) will read differently, and any test
   asserting a 5xx message body must be updated.

---

## The 8 `getCurrentUser` sites (read this first)

`apps/webview-ui/src/actions/auth.ts:63-76` currently swallows the 401 and
returns `null`, and also returns `null` on **any** other error after a
`console.error`. Eight files branch on that `null` to send the visitor to
login.

With the new client, `client.auth.getCurrentUser()` returns
`{success: false, error: {kind: 'unauthenticated', ...}}` for "no session", and
`{kind: 'network'}` / `{kind: 'server_error'}` for a real outage. **A
mechanical conversion that keeps returning `null` for every failure reproduces
today's bug**: a user with a flaky connection gets bounced to `/auth/login`
repeatedly, and logging in does not help because the next request fails the
same way.

**Recommended shape for the action** (3b decides the exact type):

```ts
export type CurrentUser =
  | { state: 'authenticated'; user: User }
  | { state: 'anonymous' }                       // kind === 'unauthenticated'
  | { state: 'unavailable'; error: RustrakError }; // network | server_error | anything else
```

`anonymous` redirects to login. `unavailable` renders an error surface and does
**not** redirect.

| # | File | Line | Current behaviour | Must become |
|---|---|---|---|---|
| 1 | `apps/webview-ui/src/actions/auth.ts` | 63-76 | the source: `try` -> `client.auth.getCurrentUser()`, `catch` returns `null` for 401 and `null` for everything else | branch on `result.error.kind`; distinguish `unauthenticated` from every other kind; stop collapsing to `null` |
| 2 | `apps/webview-ui/src/app/page.tsx` | 5 | `const user = await getCurrentUser()` then redirects on falsy | redirect only on `anonymous`; render an error state on `unavailable` |
| 3 | `apps/webview-ui/src/app/(main)/layout.tsx` | 13 | same; this is the root gate for the whole authenticated app, so a wrong branch here is the login loop | redirect only on `anonymous` |
| 4 | `apps/webview-ui/src/app/(main)/settings/layout.tsx` | 16 | same, nested under (3) | redirect only on `anonymous` |
| 5 | `apps/webview-ui/src/app/(main)/settings/storage/page.tsx` | 254 | same, plus an `is_admin` gate | redirect only on `anonymous`; keep the admin gate on the `authenticated` arm |
| 6 | `apps/webview-ui/src/app/(main)/settings/team/page.tsx` | 17 | same, plus an `is_admin` gate | as above |
| 7 | `apps/webview-ui/src/app/(main)/settings/account/page.tsx` | 19 | same | redirect only on `anonymous` |
| 8 | `apps/webview-ui/src/app/(main)/projects/[id]/settings/members/page.tsx` | 29 | `Promise.all([...getCurrentUser(), ...])`; a `null` here silently degrades the page | redirect only on `anonymous`; the `Promise.all` must not treat `unavailable` as "not logged in" |

---

## Every `instanceof` check against a client error class

### `packages/mcp` (4, all in one file)

| File | Line | Check | Becomes |
|---|---|---|---|
| `packages/mcp/src/errors.ts` | 18 | `err instanceof NotFoundError` | `error.kind === 'not_found'` |
| `packages/mcp/src/errors.ts` | 24 | `err instanceof RateLimitError` (reads `err.retryAfter`) | `error.kind === 'rate_limited'` (reads `error.retryAfter`) |
| `packages/mcp/src/errors.ts` | 28 | `err instanceof AuthenticationError` | `error.kind === 'unauthenticated'` |
| `packages/mcp/src/errors.ts` | 31 | `err instanceof RustrakError` (base-class catch-all) | `default:` over the union; nothing is left uncovered because the union is closed |

`toMcpError(err: unknown)` becomes `toMcpError(error: RustrakError)`. The final
`Unexpected error: ${String(err)}` arm has no successor for expected failures
(the union is total), but should be kept for a genuinely thrown programming
error if the tool wrappers keep a `try`.

### `apps/webview-ui` (10 against `RustrakError`, 17 against `Error`)

Against the client class, all of which must go:

| File | Line | Check | Becomes |
|---|---|---|---|
| `apps/webview-ui/src/actions/auth.ts` | 38 | `err instanceof RustrakError && err.statusCode === 401` (login) | `error.kind === 'unauthenticated'` |
| `apps/webview-ui/src/actions/auth.ts` | 69 | same, in `getCurrentUser` | `error.kind === 'unauthenticated'` (see the 8-site table) |
| `apps/webview-ui/src/actions/auth.ts` | 99-102 | `statusCode === 404 \|\| 400 \|\| 410` (invitation invalid) | `kind === 'not_found' \|\| 'validation' \|\| 'gone'` |
| `apps/webview-ui/src/actions/auth.ts` | 133 | `err instanceof RustrakError` -> `err.message` | `default:` over the union -> `error.message` |
| `apps/webview-ui/src/actions/invitations.ts` | 42, 63 | `err instanceof RustrakError` -> `err.message` | `!result.success` -> `result.error.message` |
| `apps/webview-ui/src/actions/team.ts` | 40, 64 | same | same |
| `apps/webview-ui/src/actions/members.ts` | 43, 66 | same | same |

The 17 `err instanceof Error ? err.message : '...'` checks in client components
are a **separate** concern: they guard against the action rejecting. Once the
actions return a `Result` (or their existing `{success, error}` shape) those
`catch` blocks stop firing for expected failures, and the components must read
the returned failure instead. They are not client-error `instanceof` checks, but
they are dead code afterwards if left as-is:

`settings/integrations/integrations-list.tsx` (221, 244, 646, 896, 1246),
`settings/tokens/tokens-list.tsx` (86, 109, 131),
`projects/projects-list.tsx` (147),
`projects/new/create-project-form.tsx` (161),
`projects/[id]/settings/general/general-settings-form.tsx` (52, 72, 88, 102),
`projects/[id]/settings/alerts/alerts-settings.tsx` (227, 243, 645).

---

## `packages/mcp/src` call sites (64)

**Uniform pattern.** Every one of the 64 sites is inside a
`server.registerTool(..., async (args) => { try { ... } catch (err) { return
toMcpError(err); } })`. There is no per-site variation, which makes this the
cheaper half of 3b.

**What each becomes.** Two options, and 3b should pick one and apply it
everywhere:

- *(recommended)* keep `toMcpError` but retype it to
  `toMcpError(error: RustrakError)`, and replace each body with
  `const result = await client.X.Y(...); if (!result.success) return
  toMcpError(result.error); return { content: [...JSON.stringify(result.data)...] };`
  The outer `try/catch` can stay as a thin guard for genuine programming errors
  (the client still throws those on purpose).
- introduce one `handle<T>(result, render)` helper in `src/errors.ts` and call
  it at all 64 sites, which removes the `try` entirely.

Note the 9 sites that call a `void` method and today rely on the absence of a
throw: they must now check `result.success` explicitly, because a `Result<void>`
failure is a value and is trivially ignorable.

| File | Sites | Lines | Void-returning sites needing an explicit check |
|---|---|---|---|
| `packages/mcp/src/tools/issues.ts` | 21 | 33, 59, 80, 103, 126, 150, 178, 209, 237, 263, 284, 307, 333, 355, 381, 403, 427, 455, 480, 501, 529 | 150 (`issues.delete`) |
| `packages/mcp/src/tools/team.ts` | 9 | 30, 54, 76, 102, 121, 143, 166, 191, 222 | 54 (`team.updateRole`), 76 (`team.remove`), 143 (`invitations.revoke`), 191 (`members.upsert`), 222 (`members.remove`) |
| `packages/mcp/src/tools/storage.ts` | 6 | 19, 38, 90, 161, 186, 218 | none |
| `packages/mcp/src/tools/agents.ts` | 6 | 50, 72, 94, 116, 138, 175 | none |
| `packages/mcp/src/tools/tokens.ts` | 4 | 19, 40, 64, 86 | 86 (`tokens.delete`) |
| `packages/mcp/src/tools/transactions.ts` | 4 | 59, 89, 126, 151 | none |
| `packages/mcp/src/tools/projects.ts` | 3 | 27, 47, 71 | none |
| `packages/mcp/src/tools/alerts.ts` | 3 | 19, 40, 60 | none |
| `packages/mcp/src/tools/stats.ts` | 2 | 34, 65 | none |
| `packages/mcp/src/tools/events.ts` | 2 | 27, 53 | none |
| `packages/mcp/src/tools/logs.ts` | 1 | 42 | none |
| `packages/mcp/src/tools/health.ts` | 1 | 17 | none |
| `packages/mcp/src/tools/spans.ts` | 1 | 54 | none |
| `packages/mcp/src/tools/sessions.ts` | 1 | 35 | none |

**MCP tests.** `pnpm --filter=@rustrak/mcp test` fails with 23 failures across 8
files today. The failures are all of the form `expected "Right-hand side of
'instanceof' is not an object" to contain "Unexpected error"`: the tests import
the deleted error classes, get `undefined`, and `instanceof undefined` throws a
`TypeError` at runtime. Those tests must be rewritten alongside the source, not
merely re-pointed.

---

## `apps/webview-ui/src` call sites (78)

All 78 live in `src/actions/*.ts`. There are two more in a JSDoc example in
`src/lib/rustrak.ts` (19, 98) which must be updated so the module's own
documentation does not teach the old API; they are not counted above.

Four distinct current behaviours, and each needs a different treatment.

### A. Pass-through: no error handling at all (62 sites)

The action calls the client and returns its value. A throw propagates to the
React Server Component, which is exactly the gh-204 failure: the exception dies
at the RSC boundary and the user sees a generic digest.

**Must become:** either return the `Result` verbatim (preferred, since a
`Result` *is* serializable and this is the whole point of AD-1), or unwrap it
locally with an explicit failure branch. Returning it verbatim changes each
action's signature from `Promise<T>` to `Promise<Result<T, RustrakError>>`,
which forces every calling page/component to handle failure. That churn is the
deliverable, not a side effect.

| File | Sites | Lines |
|---|---|---|
| `apps/webview-ui/src/actions/issues.ts` | 13 | 29, 44, 61, 79, 93, 107, 121, 137, 151, 167, 183, 199, 213 |
| `apps/webview-ui/src/actions/alerts.ts` | 12 | 22, 27, 34, 42, 47, 55, 95, 103, 111, 120, 128, 136 |
| `apps/webview-ui/src/actions/agents.ts` | 7 | 22, 30, 38, 46, 54, 62, 70 |
| `apps/webview-ui/src/actions/storage.ts` | 6 | 15, 21, 29, 37, 43, 49 |
| `apps/webview-ui/src/actions/projects.ts` | 5 | 23, 36, 49, 67, 79 |
| `apps/webview-ui/src/actions/transactions.ts` | 4 | 18, 26, 34, 42 (the 5th site, 45-53, is category D) |
| `apps/webview-ui/src/actions/tokens.ts` | 4 | 18, 32, 42, 53 |
| `apps/webview-ui/src/actions/events.ts` | 3 | 20, 48, 82 |
| `apps/webview-ui/src/actions/stats.ts` | 2 | 23, 41 |
| `apps/webview-ui/src/actions/sessions.ts` | 2 | 26 (`getReleaseHealth`), 56 (`getAllReleaseHealthRows`) |
| `apps/webview-ui/src/actions/logs.ts` | 1 | 15 |
| `apps/webview-ui/src/actions/team.ts` | 1 | 18 (`listTeam`) |
| `apps/webview-ui/src/actions/members.ts` | 1 | 21 (`listProjectMembers`) |
| `apps/webview-ui/src/actions/invitations.ts` | 1 | 22 (`listInvitations`) |

Three of those pass-through sites also read fields off the resolved value in the
same expression, so they need the unwrap inserted rather than a simple return:

- `actions/events.ts:48` -> `response.items[0] ?? null` (`getLastEvent`)
- `actions/events.ts:82` -> loop over `response.items` / `response.has_more` /
  `response.next_cursor` in `getEventNavigation`; a failure mid-pagination
  currently throws out of the `do/while` and must now break the loop
- `actions/sessions.ts:56` -> loop over `response.items` / `response.total_pages`
  in `getAllReleaseHealthRows`, same problem

`actions/events.ts:20` (`getEventDetail`) is a plain pass-through.

### B. try/catch mapping to a `{success, error}` union (11 sites)

These already have the target shape. The work is replacing the `instanceof`
test with a `kind` test and dropping the `try`.

| File | Lines | Current | Must become |
|---|---|---|---|
| `apps/webview-ui/src/actions/auth.ts` | 30 (`login`) | catch -> `statusCode === 401` -> `'invalid_credentials'`, else `'unknown'` | `kind === 'unauthenticated'` -> `'invalid_credentials'`; consider separating `network` from `'unknown'` so the form can say "cannot reach the server" |
| `apps/webview-ui/src/actions/auth.ts` | 95 (`getInvitation`) | catch -> `statusCode` in {404, 400, 410} -> `'invalid'` | `kind` in {`not_found`, `validation`, `gone`} -> `'invalid'` |
| `apps/webview-ui/src/actions/auth.ts` | 126 (`acceptInvitation`) | catch -> `err.message` | `result.error.message` |
| `apps/webview-ui/src/actions/invitations.ts` | 39, 60 | catch -> `err.message` | `result.error.message` |
| `apps/webview-ui/src/actions/team.ts` | 37, 61 | catch -> `err.message` | `result.error.message` |
| `apps/webview-ui/src/actions/members.ts` | 40, 63 | catch -> `err.message` | `result.error.message` |
| `apps/webview-ui/src/actions/auth.ts` | 51 (`logout`) | no catch; reads `result.cookies` | unwrap before `clearSessionCookies`; a failed logout must not silently skip clearing the cookie |

### C. try/catch swallowing into a fallback value (4 client sites)

These hide the failure today. Converting them mechanically keeps the failure
hidden, which is worse now that it is representable.

| File | Line | Current fallback | Must become |
|---|---|---|---|
| `apps/webview-ui/src/actions/releases.ts` | 21 | `console.error` then `[]` | decide deliberately: an empty release is `success: true` with `[]`, a failure is not. Prefer surfacing the `Result` |
| `apps/webview-ui/src/actions/sessions.ts` | 93 (`getSessionSummary`) | `console.error` then `EMPTY_SESSION_SUMMARY` | as above; a zeroed summary and a failed fetch currently render identically |
| `apps/webview-ui/src/actions/sessions.ts` | 116 (`getSessionTimeseries`) | `console.error` then `[]` | as above |
| `apps/webview-ui/src/actions/server.ts` | 9 (`getServerVersion`) | `catch {}` then `null` | `null` is defensible here (version is decorative); make it `unwrapOr(result, null)` so the swallow is explicit |
| `apps/webview-ui/src/actions/version-check.ts` | 29-61 | `catch {}` then `null` | **not a client call** (it fetches a release feed with `fetch`); listed only so 3b does not chase it |

### D. `.catch(() => fallback)` (1 site)

| File | Line | Current | Must become |
|---|---|---|---|
| `apps/webview-ui/src/actions/transactions.ts` | 45-53 (`getTransactionStatForGroup`) | `.catch(() => null)` with the comment "a group with no transactions returns 404" | `result.success ? result.data : result.error.kind === 'not_found' ? null : <surface it>`. The current form also swallows `network` and `server_error` as "no metrics" |

### webview tests and build

`webview-ui#check-types` and `webview-ui#build` both fail after 3a.
`webview-ui#test` **passes**, forced and uncached: the vitest suite covers
components and hooks and does not exercise the Server Actions that call the
client, so it is blind to this break. Do not read that green as coverage; 3b
should add action-level tests for the branches this inventory names, above all
the `getCurrentUser` three-way split.

---

## Verification baseline from 3a

`pnpm run ci` (with `--continue`, so the whole graph runs) fails on exactly:

- `@rustrak/mcp#test`
- `@rustrak/mcp#check-types`
- `webview-ui#check-types`
- `webview-ui#build`

`@rustrak/mcp#build` also fails on a cold cache (tsup does not typecheck, so it
only fails when it actually rebuilds).

Everything else is green: `@rustrak/client` (test, build, check-types),
`@rustrak/server` (test, build, lint, check-types, format:check), `docs#build`,
`@rustrak/test-sentry`, `@rustrak/benchmarks`, and both `lint` /
`format:check` tasks. 3b is done when that list is empty.
