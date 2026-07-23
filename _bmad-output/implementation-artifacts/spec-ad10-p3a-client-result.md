---
title: 'AD-10 phase 3a: convert @rustrak/client to return Result instead of throwing'
type: 'refactor'
created: '2026-07-22'
status: 'done'
baseline_commit: 'b13da5871d64af2555b04871bfb73e4dcf0848ae'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-rustrak-2026-07-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** `@rustrak/client` signals failure by throwing, so every consumer discovers at runtime which of nine error classes a method can raise. Nothing in the type system says a call can fail, guarded and unguarded call sites look identical, and an exception cannot survive the React server/client boundary, which is the root of gh-204. This is AD-1 through AD-3 of the spine.

**Approach:** Every public resource method returns `Result<T, RustrakError>`. `Result` is a plain discriminated union mirroring Zod's `safeParse`; `RustrakError` becomes one closed union keyed on `kind`, replacing the nine classes. 5xx redaction moves inside the client so every consumer is protected. A breaking change to a published package, taken deliberately pre-1.0.

**Scope is `packages/client` only.** Abian chose to split the conversion: consumers (`packages/mcp`, `apps/webview-ui`, `apps/docs`) are phase 3b. **The repo therefore does not compile at the end of this spec, on purpose.** Do not merge this alone.

## Boundaries & Constraints

**Always:**
- `Result<T, E>` is `{ readonly success: true; readonly data: T } | { readonly success: false; readonly error: E }`. Discriminant `success`, payload `data`, mirroring `safeParse`.
- `Result` and everything inside it is a plain object. No class instances, no methods, no non-`Object` prototypes. Operations are standalone functions: `Ok`, `Err`, `unwrap`, `unwrapOr`, `mapResult`.
- The error union mirrors `apps/server/src/error.rs` variant by variant. `status` is `number`, never a literal, and a catch-all makes an unanticipated status representable.
- 5xx is redacted at construction inside the client: `server_error` never carries a server-supplied message. `network` carries no `cause` (it embeds the resolved host and port) and `invalid_response` carries no Zod issues (they embed response data).
- **`getCurrentUser` returns `success: false` with `kind: 'unauthenticated'` when there is no session** (Abian's explicit call, over the alternative of `data: null`). It is the literal reading of the server's 401. See Design Notes for the consequence this creates for 3b.
- An empty collection is `success: true` with an empty array. Absence of results is not failure.
- Phase 2's contract test keeps passing and keeps failing when `error.rs` wording changes.

**Ask First:**
- Any change to `apps/server`. If a variant seems missing, report it rather than adding one server-side.
- Dropping or renaming any public export other than the nine error classes being replaced.
- Adding a `Result` helper beyond the five named above.

**Never:**
- Do not touch `packages/mcp`, `apps/webview-ui` or `apps/docs`. Their breakage is expected and is 3b's work.
- Do not throw from a resource method for an expected outcome. `throw` is reserved for programming errors.
- Do not weaken, skip or delete a test to make the suite pass.
- Do not add an `ActionResult` type or a Server Action wrapper. One `Result` crosses every boundary.

## I/O & Edge-Case Matrix

| Scenario | Returns | Notes |
|---|---|---|
| 2xx, schema validates | `{success: true, data}` | |
| Nothing to return | `{success: true, data: undefined}` | `Result<void, E>`, never a bare boolean |
| Empty collection | `{success: true, data: []}` | |
| No session on `getCurrentUser` | `{success: false, error: {kind: 'unauthenticated'}}` | Explicit decision, not the `null` alternative |
| Any 4xx | `{success: false, error}` with the server's message verbatim | |
| Any 5xx | `{success: false, error}` with a fixed generic message | Server body discarded inside the client |
| Transport failure | `{success: false, error: {kind: 'network'}}` | No `cause` |
| Response fails its schema | `{success: false, error: {kind: 'invalid_response'}}` | No Zod issues |
| Caller input fails a pre-flight check | `{success: false, error: {kind: 'invalid_request'}}` | Never reaches the network, no status |
| Programming error (bad baseUrl, bug) | throws | The one remaining throw |

</frozen-after-approval>

## Code Map

- `src/resources/*.ts` -- 20 resources, 86 public methods, all `Promise<T>` today. `issues.ts` has 18, the largest.
- `src/resources/base.ts` -- `BaseResource.validate` throws `ValidationError`; becomes the `invalid_response` path.
- `src/utils/http.ts` -- `transformHttpError` maps status to class; becomes status to `kind`, and is where 5xx redaction lands.
- `src/errors/http.ts`, `src/errors/base.ts` -- the nine classes being replaced.
- `src/index.ts` -- exports those nine; must export `Result`, the union and the helpers instead.
- `tests/mocks/handlers.ts` -- phase 2's fixtures plus `APP_ERROR_PREFIXES` and `APP_ERROR_STATUS`. Not changed by this work.
- `tests/unit/app-error-contract.test.ts` -- the coupling to `error.rs`. Must keep passing.
- `tests/integration/*.test.ts` -- 22 files, 337 tests, all written against throwing.
- `tests/unit/errors.test.ts` -- constructs the nine classes directly; is rewritten against the union.

## Tasks & Acceptance

**Execution:**
- [x] `src/result.ts` -- new: the type plus `Ok`, `Err`, `unwrap`, `unwrapOr`, `mapResult` as standalone functions.
- [x] `src/errors.ts` -- new: the `RustrakError` union keyed on `kind` mirroring `error.rs`, plus `isRetryable`. Delete `src/errors/`.
- [x] `src/utils/http.ts` -- map status to `kind` exhaustively; redact 5xx; drop `cause` and Zod issues.
- [x] `src/resources/base.ts`, then the 20 resources **one at a time with their tests in the same step** -- a resource converted without its tests leaves the suite red for no reason and makes the diff unreviewable.
- [x] `src/index.ts` -- export `Result`, the union and the helpers; remove the nine classes.
- [x] `tests/unit/errors.test.ts` -- rewrite against the union, preserving what each assertion meant.
- [x] New test: a `Result` carrying an error survives `structuredClone` intact -- that is exactly what crossing the RSC boundary requires, and a class instance fails it.
- [x] `README.md` -- rewrite the error-handling section; it ships to npm.
- [x] Produce `_bmad-output/implementation-artifacts/phase-3b-consumer-inventory.md` -- every consumer call site this breaks, grouped by file, with the current error handling at each. This is the input to 3b and the only artifact that makes the split safe.
- [x] Prove the suite can fail: temporarily make every method report success regardless, run the suite, report how many tests fail, revert.

**Acceptance Criteria:**
- Given any resource method, when inspected, then its return type is `Promise<Result<T, RustrakError>>` and it contains no `throw` for an expected outcome.
- Given a 5xx, when a consumer reads `error.message`, then it is the fixed generic string and contains nothing from the server body.
- Given `pnpm --filter=@rustrak/client test`, `check-types` and `build`, then each exits 0.
- Given phase 2's contract test, then it still passes and still fails when `error.rs` wording changes.
- Given `pnpm run ci`, then it fails **only** on `@rustrak/mcp` and `webview-ui`, and the failures are enumerated in the consumer inventory. Any other failing task is a defect in this spec's work.

## Design Notes

Order is load-bearing: `result.ts` and `errors.ts` first because everything depends on them, then `utils/http.ts` where every error is born, then resources one at a time with their tests.

`ValidationError` was the most misleading name in the old hierarchy: it meant "our own response schema failed to parse", not "the user's input was rejected". It becomes `invalid_response`, while `invalid_request` covers a caller's input failing a pre-flight check.

**The `unauthenticated` decision has a cost that 3b must pay.** Today `getCurrentUser` returns `null` for "no session", and 8 files in `apps/webview-ui` branch on that to redirect to login. With `success: false`, those sites must distinguish `kind: 'unauthenticated'` (send to login) from `network` or `server_error` (a real failure). Conflating them sends a user with a flaky connection to the login page repeatedly. The consumer inventory must call out every one of those 8 sites specifically.

The `structuredClone` test is small and load-bearing. React's Flight serializer rejects anything whose prototype is not `Object.prototype`, which is why the class-based result libraries were rejected in the spine. A cheap assertion stops a future refactor quietly reintroducing a class.

## Verification

**Commands:**
- `pnpm --filter=@rustrak/client test` -- expected: exit 0.
- `pnpm --filter=@rustrak/client check-types` -- expected: exit 0.
- `pnpm --filter=@rustrak/client build` -- expected: exit 0, ESM + CJS + DTS.
- `pnpm run ci` -- expected: fails, and only on `@rustrak/mcp` and `webview-ui`. Record which tasks failed and confirm the list matches the inventory.

**Manual checks:**
- No `throw` remains in `src/resources/`.
- `src/errors/` no longer exists and nothing imports from it.

## Suggested Review Order

**The boundary, and whether a bug can hide in it**

- One rethrow for the whole package: only the internal carrier becomes an `Err`, everything else still crashes.
  [`base.ts:90`](../../packages/client/src/resources/base.ts#L90)

- A dying socket is now `network`, not a non-retryable `invalid_response`.
  [`base.ts`](../../packages/client/src/resources/base.ts)

**Security**

- The message is a fixed constant; ky's own carried the internal host, port and path.
  [`http.ts:202`](../../packages/client/src/utils/http.ts#L202)

- 5xx discards the server body at construction, so every consumer is protected, not just the UI.
  [`errors.ts`](../../packages/client/src/errors.ts)

**The contract**

- Plain union, no methods, so it survives the RSC boundary a class cannot cross.
  [`result.ts:1`](../../packages/client/src/result.ts#L1)

- Restored on all 86 methods; the `.json()` shortcut used to set it and the new boundary does not.
  [`http.ts:159`](../../packages/client/src/utils/http.ts#L159)

**Peripherals**

- Four assertions that fail if a class is ever reintroduced.
  [`error-handling.test.ts`](../../packages/client/tests/integration/error-handling.test.ts)

- The input to phase 3b: every consumer call site, with the 8 `getCurrentUser` files called out.
  [`phase-3b-consumer-inventory.md:1`](phase-3b-consumer-inventory.md#L1)
