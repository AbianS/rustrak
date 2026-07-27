---
title: 'AD-10 phase 2: make the client test suite test the real error contract'
type: 'test'
created: '2026-07-22'
status: 'done'
baseline_commit: 'aa5b2692dd1aa3163cc5bfdd77a09ab522fd67a9'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-rustrak-2026-07-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** `packages/client`'s suite has 97 percent coverage and cannot detect a broken error message. Two independent holes cause this. All 50 error fixtures in `tests/mocks/handlers.ts` use a flat `{error: 'string'}` body, while the server emits a nested `{error: {type, message}}` body for every `AppError`. And no test anywhere asserts a message parsed out of an HTTP error body: the 50 `toThrow` assertions check only the class, and every `error.message` assertion lives in `tests/unit/errors.test.ts`, which constructs errors directly and never reaches `transformHttpError`. The client could return `[object Object]` for every error and the suite would stay green. That is why gh-204 survived.

**Approach:** Rebuild the fixtures on the shapes the server actually produces, add the statuses that are entirely absent, and introduce the missing assertion class so a wrong message fails a test.

## Boundaries & Constraints

**Always:**
- Fixture bodies mirror `apps/server/src/error.rs` exactly: `{error: {type, message}}`, where `type` is one of the eight literals it emits (`NotFound`, `ValidationError`, `Conflict`, `Unauthorized`, `Forbidden`, `PayloadTooLarge`, `DatabaseError`, `InternalError`) and `message` carries the thiserror prefix, so a 404 message reads `Resource not found: <detail>`, not a bare detail.
- The 429 keeps the flat `{error: 'rate_limit_exceeded', retry_after: N}` body plus a `Retry-After` header, because that is what `routes/ingest.rs` genuinely sends. Both shapes stay live and both stay tested.
- Every new assertion checks the parsed `error.message`, not only the error class. A test that only asserts the class does not count as covering this.
- Exact dependency versions if anything is added. Files kebab-case.

**Ask First:**
- **If an assertion exposes a defect other than the one named below, STOP and report it. Never write a test that blesses current behaviour.**
- Changing any file under `packages/client/src/` beyond the one authorised fix below.

**Authorised source fix (Abian, this session):** `errors/http.ts:37` has `NotFoundError` prepend `Resource not found: ` to a message that already carries that prefix from the server, so every 404 currently reads `Resource not found: Resource not found: X`. Fix it here rather than deferring, and write the assertions against the corrected behaviour. The same double-prefix pattern must be checked for in every other error class before assuming `NotFoundError` is the only one.

**Never:**
- Do not touch `apps/webview-ui` or `apps/server`.
- Do not begin the `Result` conversion. That is phase 3, and this phase exists to make phase 3 verifiable.
- Do not lower an assertion to make it pass.
- Do not delete a test to resolve a failure.

## I/O & Edge-Case Matrix

| Scenario | Fixture body | Expected client behaviour | Currently tested |
|---|---|---|---|
| Any `AppError` (400/401/403/404/409/413/500) | `{error: {type, message}}` | `error.message` equals the server's `message` | No, zero nested fixtures exist |
| Rate limit (429) | `{error: 'rate_limit_exceeded', retry_after: N}` + `Retry-After` header | `RateLimitError` with `retryAfter` populated | No, zero 429 fixtures exist |
| Server failure (500) | `{error: {type: 'DatabaseError', message}}` | `ServerError`, `retryable: true`, `statusCode` preserved | No, zero 5xx fixtures exist |
| Body is not JSON | non-JSON payload | Falls back to `HTTP <status> error`, never throws while parsing | Unknown |
| Body is JSON but has no `error` key | `{}` | Same fallback, no `undefined` leaking into the message | Unknown |

</frozen-after-approval>

## Code Map

- `apps/server/src/error.rs:44-92` -- the authority on the nested shape and the eight `type` literals. `message` is `self.to_string()`, so the thiserror prefix is part of it.
- `apps/server/src/routes/ingest.rs:42-46` -- the sole flat-shape emitter, with `Retry-After`.
- `packages/client/tests/mocks/handlers.ts` -- 1943 lines, 50 inline `HttpResponse.json({error: '...'}, {status})` calls, no shared helper. Statuses present: 404 x34, 400 x9, 409 x4, 401 x3, 403 x1. Absent entirely: 413, 429, every 5xx.
- `packages/client/src/utils/http.ts:15-50` -- `transformHttpError`. Already accepts both shapes and already cites gh-204; not to be changed here.
- `packages/client/src/errors/http.ts:37-43` -- `NotFoundError`'s double-prefix defect.
- `packages/client/tests/integration/error-handling.test.ts` -- the natural home for the new message-level and status-coverage tests.
- `packages/client/tests/unit/errors.test.ts` -- where message assertions live today, bypassing `transformHttpError`. Explains the blind spot; leave it alone.

## Tasks & Acceptance

**Execution:**
- [x] `tests/mocks/handlers.ts` -- add a small exported helper that builds the nested body from a `type`, a `message` and a status, plus a separate one for the 429 flat body and header -- 50 inline literals is exactly how the shapes drifted, and a helper makes the next drift a one-line change.
- [x] `tests/mocks/handlers.ts` -- convert all 50 error fixtures to the helper, choosing the `type` literal that matches the status the server would return, and writing messages with the real thiserror prefix.
- [x] `tests/mocks/handlers.ts` -- add fixtures for the missing statuses: at least one 413 `PayloadTooLarge`, one 429 with `Retry-After`, and one 500 `DatabaseError`. Route them so a test can reach them deterministically, following whatever request-matching convention the file already uses for its 404 cases.
- [x] `tests/integration/error-handling.test.ts` -- add message-level tests: for each status, assert the class **and** that `error.message` equals the message the fixture sent. This is the assertion class the suite has never had.
- [x] `tests/integration/error-handling.test.ts` -- add a 429 test asserting `RateLimitError` and a populated `retryAfter`, and a 500 test asserting `ServerError` with `retryable` true and `statusCode` preserved.
- [x] `tests/integration/error-handling.test.ts` -- add the two malformed-body cases from the matrix, asserting the fallback message and that no `undefined` or `[object Object]` appears in it.
- [x] `src/errors/http.ts` -- fix the double-prefix defect so a 404 message is the server's message verbatim, and audit every other error class in the file for the same pattern -- authorised source fix; the constructor was prefixing a string that already arrives prefixed.
- [x] Prove the suite can fail: temporarily break `transformHttpError` so every case returns the generic fallback, confirm at least one test goes red, revert, and report the result -- a suite that has never been seen to fail is not evidence of anything.

**Acceptance Criteria:**
- Given the suite, when `pnpm --filter=@rustrak/client test` runs, then every test passes and no fixture in `handlers.ts` uses a bare `{error: 'string'}` body except the 429.
- Given a deliberate regression that makes `transformHttpError` return `HTTP <status> error` for every case, when the suite runs, then at least one test fails. Prove this by temporarily introducing it, observing the failure, and reverting.
- Given the fixtures, when they are read against `apps/server/src/error.rs`, then every `type` literal used exists in that file and every status maps to the variant that produces it.
- Given `pnpm run ci`, when it runs from the repo root, then it exits 0.

## Spec Change Log

- **Trigger:** the adversarial review went and read the Rust call sites one by one and found that many fixture messages were invented rather than copied. `Invitation expired or used` against the server's `Invitation is expired or already used`; a flagship 404 assertion pinned to `Project not found`, a string produced only by `get_by_sentry_key`, which is `#[allow(dead_code)]` and wired to no route; `/auth/register` fixtures simulating 400 validation when `routes/auth.rs:106-115` returns 403 `Registration is invite-only` unconditionally; a 409 test using a scenario `routes/team.rs:118-137` answers with 403 because it checks the primary-admin guard first; and 404 details systematically dropping the identifier the server always interpolates.
  **Amended:** every message re-derived from its actual Rust call site. Two structural fixes followed. `appErrorResponse` now derives the status from the type, so an impossible pairing is unrepresentable rather than merely discouraged. And a new `tests/unit/app-error-contract.test.ts` parses `apps/server/src/error.rs` and asserts the prefix table, the status table and the `AppErrorType` union all still match the Rust enum.
  **Known-bad state avoided:** shipping a more convincing fiction than the one we replaced. Shape-correct, detail-wrong fixtures are worse than obviously-wrong ones, because nobody re-checks them. Without the contract test the suite stayed a closed loop where a fixture and its assertion could drift together forever and stay green.
  **Scope expansions, all deliberate:** `packages/mcp` was touched because the authorised `NotFoundError` fix relocated the double-prefix one layer up (`toMcpError` added its own `Not found: ` to an already-prefixed message; before the fix it was tripled). One further source change landed in `src/utils/http.ts`, tightening `if (body)` to `if (body && typeof body === 'object')`, because the non-JSON fallback was working only by accident. `tests/integration/auth.test.ts` was rewritten because five of its tests asserted a 201 the server cannot produce.
  **KEEP:** the contract test and its two-directional proof. The construction-time prefix assertion in `appErrorResponse`. The `projectNotFound` / `projectNotVisible` split, which encodes that `access::require` and `get_by_id` produce different 404 wordings. The status-transform fixtures living on a synthetic path rather than on a real endpoint that cannot produce those statuses.

## Design Notes

The fixture helper matters more than it looks. The 50 bodies drifted from the server precisely because each was written inline at its call site, so nothing forced consistency and nothing broke when the server changed. Centralising the shape means the next contract change is one edit and a red suite rather than a silent divergence.

The deliberate-regression check in the acceptance criteria is the real deliverable. Converting fixtures alone would leave the suite still incapable of detecting a wrong message, because `transformHttpError` already handles both shapes, so nothing would have failed before the change and nothing new would fail after it. Proving the suite can now go red is what makes phase 3 trustworthy.

## Verification

**Commands:**
- `pnpm --filter=@rustrak/client test` -- expected: exit 0, all tests pass.
- `pnpm --filter=@rustrak/client test:coverage` -- expected: exit 0, coverage not lower than before.
- `pnpm --filter=@rustrak/client check-types` -- expected: exit 0.
- `pnpm run ci` -- expected: exit 0 across the monorepo.

**Manual checks:**
- Every `type` string in `handlers.ts` appears in `apps/server/src/error.rs`.
- The temporary-regression experiment from the acceptance criteria was actually run, and its result is reported.

## Suggested Review Order

**The one thing that makes this more than cosmetic**

- Parses `error.rs` and fails if the Rust wording or status mapping drifts. Proven in both directions.
  [`app-error-contract.test.ts:1`](../../packages/client/tests/unit/app-error-contract.test.ts#L1)

- Status derived from type, so an impossible pairing cannot be written.
  [`handlers.ts:29`](../../packages/client/tests/mocks/handlers.ts#L29)

**Source changes, the only behaviour-affecting edits**

- Stops double-prefixing; the server message already reads `Resource not found: X`.
  [`errors/http.ts:41`](../../packages/client/src/errors/http.ts#L41)

- The same bug had relocated here, where it read `Not found: Resource not found: X`.
  [`mcp/errors.ts:18`](../../packages/mcp/src/errors.ts#L18)

- Non-JSON fallback was working by accident; now deliberate.
  [`utils/http.ts:26`](../../packages/client/src/utils/http.ts#L26)

**Fixtures corrected against the real Rust call sites**

- Two distinct 404 wordings: `access::require` and `get_by_id` do not agree.
  [`handlers.ts:78`](../../packages/client/tests/mocks/handlers.ts#L78)

- Register is invite-only and returns 403 for every input; the old 400s were fiction.
  [`handlers.ts:880`](../../packages/client/tests/mocks/handlers.ts#L880)

- 413 and 429 moved off a GET that can never produce them.
  [`handlers.ts:378`](../../packages/client/tests/mocks/handlers.ts#L378)

**Peripherals**

- The assertion class the suite never had: message, status and retryable per status.
  [`error-handling.test.ts:157`](../../packages/client/tests/integration/error-handling.test.ts#L157)

- Rewritten because five tests asserted a 201 the server cannot return.
  [`auth.test.ts:1`](../../packages/client/tests/integration/auth.test.ts#L1)
