---
title: 'Field-level validation errors: the wire contract (server and client)'
type: 'feature'
created: '2026-07-22'
status: 'in-progress'
baseline_commit: '2f0721cbbec3ebffcd5363e37f86ed6233e05b4a'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-rustrak-2026-07-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** when the server rejects a form, the UI cannot tell which input was wrong. The only place that tries decides by string-matching the server's English prose (`message.includes("slug '")` in `create-project-form.tsx:169`), which cannot be translated and is already dead in production, since a Server Action throw is redacted. Everywhere else falls back to a toast the user has to translate back into an edit. The root cause is that the wire carries no field: `ErrorDetail` is `{type, message}` and the field name lives inside the sentence.

**Approach:** the server names the field and what happened, as data. `ErrorDetail` gains an optional `fields` array of `{field, code, message?}`, and `@rustrak/client` exposes it on the error union.

**Scope is the wire only: `apps/server` and `packages/client`.** The consuming half (the react-hook-form mapping helper, converting `general-settings-form.tsx` to RHF, deleting the string matcher) folds into AD-10 phase 3b, which is already going to rewrite every one of those files to consume `Result`. Doing it here would mean editing `apps/webview-ui` while it does not compile, and editing the same forms twice. This spec exists so the `fields` data is on the wire **before** 3b touches a form, which is exactly the ordering Abian asked for.

## Boundaries & Constraints

**Always:**
- `fields` is **optional and additive**. A consumer that ignores it keeps working, and it ships before anything consumes it.
- `field` is a **dot path matching the request body**, not a JSON Pointer, because `setError` takes dot paths and Zod produces them. The integration dialogs need this: everything the user types is packed into one opaque `credentials` object, so the path is `credentials.url`, not `url`.
- `code` is lower snake_case from **one small closed set**, reused across resources. GitHub ships six for its whole API. A large or per-endpoint vocabulary becomes an unversionable public API.
- **The UI selects its copy from `(field, code)` and never parses `message`.** Per-field `message` is optional and exists only for what the code cannot express, mirroring GitHub, where it appears only alongside `code: custom`. If it starts arriving on every error, the codes stop being used and translation dies; a reviewer should treat a populated `message` on a well-covered code as a smell.
- `fields` attaches to **`Conflict` as well as `Validation`**. 12 of the 14 sites are 409, so a validation-only design would miss almost all of the work.
- Top-level `message` stays as it is: English, advisory, for logs and as the last-resort toast.

**Ask First:**
- Adding a code beyond the agreed set. The set is the part that is expensive to change later.
- Changing any HTTP status. `Validation` stays 400 and `Conflict` stays 409; a status change is breaking and buys nothing here.
- Touching the two `middleware/auth.rs` 401 bodies, which emit a different shape entirely.

**Never:**
- Do not adopt RFC 9457 or `application/problem+json`. Verified: the RFC does **not** standardise field errors (`invalid-params` is from the obsoleted 7807; 9457's own example is different and non-normative), and none of Stripe, GitHub, Twilio or Slack use the media type. It would be a breaking envelope change for zero interop on the only part that matters.
- Do not echo the rejected value back. One careless application to a password field puts a credential in the log store.
- Do not add per-field errors to **login**. Saying "this email exists but the password is wrong" is user enumeration. Login stays deliberately vague, and that intent gets a comment so nobody "fixes" it later.
- Do not touch `apps/webview-ui`. It does not compile until phase 3b, and its forms are 3b's work.
- Do not accumulate multiple errors yet. The server returns on first failure today; keep it. The array shape allows more than one later without another wire change.

## I/O & Edge-Case Matrix

| Scenario | Body | Form behaviour |
|---|---|---|
| Slug taken | `fields: [{field: 'slug', code: 'already_exists'}]` | `setError('slug')` with the form's own copy |
| Name taken | `fields: [{field: 'name', code: 'already_exists'}]` | `setError('name')` |
| Slack URL bad | `fields: [{field: 'credentials.webhook_url', code: 'invalid'}]` | `setError('credentials.webhook_url')` |
| Something the code set cannot express | `fields: [{field: 'x', code: 'custom', message: '...'}]` | render `message` verbatim |
| Form-level failure (last admin, expired invitation) | no `fields` | `setError('root.serverError')` plus toast |
| `field` names an input the form does not have | any | fall back to `root.serverError`; **never** call `setError` with it |
| Old client, new server | `fields` present | ignored, toast as today |

</frozen-after-approval>

## Code Map

- `apps/server/src/error.rs:5-17` -- `ErrorResponse`/`ErrorDetail`, two `String` fields, built in one place at `:61-81`. Already carries `utoipa::ToSchema` behind the `openapi` feature.
- The 14 sites to annotate: `services/project.rs:206, 296, 344, 351, 494-498, 506, 521`; `services/invitation.rs:33, 39`; `services/alert.rs:88, 136, 279`; `routes/team.rs:133`; `services/project_member.rs:80`.
- `services/project.rs:494-498` -- **one `return` whose two arms name two different fields.** The annotation goes inside the branch, not on the statement. Most likely place to get it wrong.
- `services/project.rs:412` -- `Cannot generate valid slug from name` belongs to **`name`**, not `slug`: it fires only when the user sent no slug, and in that mode the slug input is `readOnly`.
- `apps/webview-ui/src/app/(main)/projects/new/create-project-form.tsx:159-181` -- the string matcher this replaces.
- `apps/webview-ui/src/app/(main)/projects/[id]/settings/general/general-settings-form.tsx` -- raw `useState`, no react-hook-form, so nothing to bind a field to. Must be converted.
- `apps/webview-ui/src/app/(main)/settings/integrations/integrations-list.tsx:619-624, 865-873, 1216-1224` -- where every typed credential is packed into one `credentials` object.
- `apps/webview-ui/src/app/auth/login/login-form.tsx:46-59` -- routes everything to `password`, deliberately.
- `packages/client/src/errors.ts` -- the `RustrakError` union that gains the field data.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/server/src/error.rs` -- add `FieldError { field: String, code: FieldErrorCode, message: Option<String> }` and a `FieldErrorCode` enum serialising to snake_case. Start with: `required`, `invalid`, `already_exists`, `too_short`, `too_long`, `custom`. `ErrorDetail` gains `fields`, skipped when empty.
- [ ] `apps/server/src/error.rs` -- give `AppError::Validation` and `AppError::Conflict` a way to carry fields without breaking their 105 other call sites. Adding a variant beats changing the existing ones.
- [ ] Annotate the 14 sites listed in the Code Map, reading each in context first. Add a Rust test per site asserting the emitted body, since these are the contract.
- [ ] `packages/client/src/errors.ts` -- `validation` and `conflict` gain `fields?: FieldError[]`. Export the type and the code union.
- [ ] `packages/client/tests/mocks/handlers.ts` and `tests/unit/app-error-contract.test.ts` -- extend the existing parity test to also assert the `FieldErrorCode` variants match the union, the same way it already pins the eight `AppError` prefixes.
- [ ] Append one entry to `deferred-work.md` handing the consuming half to phase 3b, naming every form the helper must cover and the `setError` guardrail, so 3b does not have to re-derive it.

**Acceptance Criteria:**
- Given each of the 14 annotated sites, when its Rust test runs, then the emitted body carries the expected `field` and `code`.
- Given a taken name while the slug was auto-derived, then the emitted `field` is `name`, not the read-only `slug`.
- Given a consumer that ignores `fields`, when the server sends them, then nothing breaks: the field is optional and omitted when empty.
- Given the extended parity test, when a `FieldErrorCode` variant is added in Rust without updating the TypeScript union, then the test fails.
- Given `cargo test` and `pnpm --filter=@rustrak/client test`, then both exit 0.
- Given `pnpm run ci`, then it fails only on the same four tasks phase 3a left failing, and on nothing new.

## Design Notes

Sizing, from a full trace of every form to its service: 119 `Validation`/`Conflict` sites exist, 54 are reachable from a form, and only **14 need a field**. 24 more are already caught by Zod in the browser and need nothing. The rest are ingest, cursors and source maps that no form can reach. The design is small because the problem is smaller than it looks.

12 of the 14 are `Conflict`, which is the fact most likely to be missed: uniqueness is the thing only the server can know, and uniqueness is a 409.

Two sites in `middleware/auth.rs` emit `{"error": "Not authenticated"}`, a different shape from every `AppError`, and it is the 401 every Server Action hits on an expired session. They stay field-less; worth a follow-up to unify the shape, out of scope here.

## Verification

**Commands:**
- `cd apps/server && cargo test` -- expected: exit 0, including the new per-site body tests.
- `pnpm --filter=@rustrak/client test` -- expected: exit 0, parity test extended and passing.
- `pnpm run ci` -- expected: fails on exactly the four tasks phase 3a left failing (`@rustrak/mcp#test`, `@rustrak/mcp#check-types`, `webview-ui#check-types`, `webview-ui#build`) and nothing else.

**Manual checks:**
- `curl` a create-project request with a taken slug and confirm the body carries `fields: [{field: 'slug', code: 'already_exists'}]`.
- Confirm `ErrorDetail` still serialises without a `fields` key when there are none.
