# Adversarial Review: ARCHITECTURE-SPINE.md (Rustrak Frontend and Client Contract)

**Lens:** adversarial. The goal is to break the spine, not to appreciate it.
**Method:** construct pairs of implementation units one level down, each obeying every AD to the letter, that still build incompatibly. Every pair is a hole.
**Date:** 2026-07-22
**Target:** `_bmad-output/planning-artifacts/architecture/architecture-rustrak-2026-07-22/ARCHITECTURE-SPINE.md`

Verdict up front: the spine is strong on *structure* and weak on *semantics*. It fixes where code lives and what shape a value has, and leaves almost entirely open what a value **means**. Sixteen divergence pairs follow, three of them CRITICAL, of which one reproduces gh-204 (the bug the spine exists to fix) while passing every machine check the spine defines.

---

## D1 (CRITICAL) - `unwrap()` inside `actions.ts` reproduces gh-204 and passes every architecture test

### The two units

- **Unit A:** `features/issues/actions.ts` `bulkUpdateIssues(projectId, ids, state)`. Developer 1 builds it as a single client call.
- **Unit B:** `features/projects/actions.ts` `updateProject(id, input)`. Developer 2 needs a precondition read (fetch the project to confirm the slug did not change) before the write. AD-5 tells them `actions.ts` may import `data.ts`, and that "an action that reuses a read must declare its own async function".

### The two compliant implementations

```ts
// Unit A - features/issues/actions.ts
'use server';
export async function bulkUpdateIssues(
  projectId: number, ids: string[], state: IssueState,
): Promise<Result<{ updated: number }, RustrakError>> {
  const client = await createClient();
  return client.issues.bulkUpdate(projectId, { ids, state });
}
```

```ts
// Unit B - features/projects/actions.ts
'use server';
import { getProject } from './data';            // AD-5 explicitly permits this
export async function updateProject(
  id: number, input: UpdateProject,
): Promise<Result<Project, RustrakError>> {
  const current = unwrap(await getProject(id)); // AD-2 exports unwrap; nothing forbids it here
  if (current.slug === input.slug) return Ok(current);
  const client = await createClient();
  return client.projects.update(id, input);
}
```

Unit B satisfies: AD-1 (it is not the client), AD-2 (one Result type), AD-4 ("`actions.ts` returns `Result` and contains no `try/catch`" - there is no `try/catch`), AD-5 (own async function, no re-export), AD-9 rule (2) (**the declared return type is `Promise<Result<Project, RustrakError>>`, which is exactly what the ts-morph check asserts**).

### The invariant that fails to arbitrate

AD-4 says: *"A page or Server Component that wants a failure to reach its nearest `error.tsx` calls `unwrap(result)` at that call site."* That sentence is **descriptive of where unwrap is useful**, not **prohibitive of where it may appear**. AD-4's headline is "throwing is a local decision, never a layer policy", which reads as an explicit licence to throw anywhere.

The consequence is exactly gh-204: a throw from a Server Action invoked by a Client Component crosses the RSC boundary, `resolveErrorProd` in `next@16.2.10` builds a brand-new `Error` with a hardcoded message, and the user sees nothing. The memlog records this at line 49 and at line 70 ("in Rustrak's 24 useTransition files the calls are already inside try/catch, so TODAY NOTHING ESCAPES"). Under the spine those `try/catch` blocks are removed and the throw becomes user-visible-as-nothing.

AD-9 rule (2) is called "the load-bearing rule, since a function that still throws has the wrong inferred return type". That is only true for a function that throws **instead of** returning. It is false for a function that throws **on one branch and returns a Result on the other**, which is what `unwrap` produces. The rule is blind to it by construction.

### Severity

**CRITICAL.** It regresses the originating issue, it is silent in dev (per gh-204, `next dev` keeps the real message), and it passes the suite that was written to prevent it.

### AD text to add or tighten

Tighten AD-4 with a hard prohibition and give AD-9 a matching check:

> **AD-4 addition:** `unwrap` may appear only in a file under `src/app/`. It is a compile error to import `unwrap` in `features/*/actions.ts` or in `features/*/data.ts`. Rationale: a throw that originates inside a `'use server'` function is redacted by React before any consumer sees it, so `unwrap` in an action converts a readable failure into an invisible one. An action that needs a read as a precondition narrows it with `if (!r.success) return r;` and propagates the same `Result` unchanged.
>
> **AD-9 rule (10):** no file under `features/**` imports `unwrap` from `@rustrak/client`. Population floor: the count of files under `features/**` that import anything from `@rustrak/client`.

---

## D2 (CRITICAL) - `unwrap()` has no specified throw type, and the only two options are both broken

### The two units

- **Unit A:** `app/(main)/projects/[id]/page.tsx`, the project overview. Developer 1 wants a failed fetch to hit `(main)/error.tsx`, so per AD-4 they call `unwrap()`.
- **Unit B:** `app/(main)/projects/[id]/issues/[issueId]/page.tsx`, issue detail. Developer 2 wants a missing issue to render the framework 404, so they narrow and call `notFound()`.

### The two compliant implementations

```ts
// Unit A
const project = unwrap(await getProject(id));   // AD-4 sanctioned
```

```ts
// Unit B
const r = await getIssue(projectId, issueId);
if (!r.success) {
  if (r.error.kind === 'not_found') notFound();
  throw new Error(r.error.message);             // AD-4 sanctioned: "deliberately and locally"
}
```

### The invariant that fails to arbitrate

Two independent failures here, both traceable to one omission: **the spine names `unwrap` as an export of `result.ts` but never says what it throws.**

**(a) The throw type is undecidable from the spine.** AD-2 forbids any value inside a `Result` from being a class instance or carrying a non-`Object` prototype. So `RustrakError` is a plain object literal. `unwrap` therefore has two implementations:

```ts
// implementation 1
export function unwrap<T>(r: Result<T, RustrakError>): T {
  if (r.success) return r.data;
  throw r.error;              // throws a PLAIN OBJECT
}
// implementation 2
export function unwrap<T>(r: Result<T, RustrakError>): T {
  if (r.success) return r.data;
  throw new Error(r.error.message);   // loses `kind`, `status`, `retryAfter`, `issues`
}
```

Implementation 1 hands `error.tsx` an object that is not an `Error`. Next types the `error.tsx` prop as `Error & { digest?: string }`; a plain object has no `.message`, no `.stack`, and no `.digest`, so `(main)/error.tsx` renders `undefined`, the Next dev overlay degrades, and any future `unstable_rethrow` guard (which tests `isNextRouterError`, all `instanceof`-style predicates) misfires. Implementation 2 discards the entire closed union that AD-3 built.

**(b) Even with implementation 2, the message does not survive.** A throw during a Server Component render is redacted by React in production for exactly the same reason as gh-204: only the `digest` crosses the boundary. So AD-4's promise, that a page "wants a failure to reach its nearest `error.tsx`", delivers a boundary hit with **zero** information. `error.tsx` cannot tell a 404 from a 500 from a network partition. That is a strictly worse outcome than today's `try/catch`-free narrowing path, and the spine presents the two options (unwrap vs narrow) as equivalent stylistic choices when only one of them preserves any information at all.

**(c) The user-visible divergence.** Delete a project in one tab. In the other tab, Unit A shows a full-page "Something went wrong" with a Try Again button that (per the spine's own Deferred section) **cannot work**, because `reset()` does not re-fetch Server Component data. Unit B shows a correct 404 page. Same feature area, same underlying failure, two different products. AD-4 blesses both by name.

### Severity

**CRITICAL.** It silently deletes the whole AD-3 error union on the read path, which is 26 of the app's pages.

### AD text to add or tighten

> **AD-2 addition:** `unwrap(result)` throws `new RustrakThrown(result.error)`, a class extending `Error` whose `message` is `result.error.message` and which carries the original `RustrakError` on a `.rustrak` property. It is exported from `@rustrak/client`. It is never placed inside a `Result` (AD-2's plain-object rule is a rule about `Result` payloads, not about thrown values), so it does not cross the RSC boundary and the class restriction does not apply.
>
> **AD-4 addition:** `unwrap` is the correct choice only when the page's degraded state is identical for every `kind`. Any page whose treatment of `not_found` differs from its treatment of `server_error` narrows instead. Specifically: **`not_found` on a route's primary entity is always `notFound()`, never `unwrap()`, in every feature.** This is the one arbitration the spine makes for the consumer; everything else stays local.

---

## D3 (CRITICAL, security) - `network.cause` ships the internal API address to the browser, and AD-3's redaction cannot reach it

### The two units

- **Unit A:** `features/storage/actions.ts` `runCleanup()`, invoked from `app/(main)/settings/storage/storage-cleanup.tsx` (a `'use client'` component with `useTransition`).
- **Unit B:** `features/team/actions.ts` `removeMember()`, invoked from `settings/team/components/team-members-list.tsx`.

### The two compliant implementations

Inside `@rustrak/client`, the transport error mapper. AD-3 fixes the *type* (`{ kind: 'network'; message: string; cause?: string }`) and says only that `cause` is a `string` "because an `Error` instance would break AD-2's serialisability guarantee". It says nothing about the string's content. Two builders:

```ts
// builder 1
return Err({ kind: 'network', message: 'Request failed', cause: String(err.cause) });
// builder 2
return Err({ kind: 'network', message: err.message });   // cause omitted
```

Verified empirically on this machine, Node's undici:

```
message: fetch failed
cause:   ConnectTimeoutError: Connect Timeout Error (attempted address: 10.55.44.33:8081, timeout: 10000ms)
```

`RUSTRAK_API_URL` in a self-hosted deployment is an internal service address (`http://rustrak-server:8080`, a container IP, a private subnet host). Builder 1's `cause` puts that string into a `Result` returned from a `'use server'` function, which React serialises into the Flight payload sent to the **browser**. It is in the page source whether or not any component renders it.

### The invariant that fails to arbitrate

AD-3's redaction rule is: *"when `status >= 500`, the server's message is discarded"*. The `network` variant **has no `status` field**. Neither does `invalid_response`. So AD-3's single security control is structurally unable to fire on the two variants that carry the most implementation detail. The spine's own claim, "`error.message` ... is now always safe to render because AD-3 redacts at the source" (Consistency Conventions, "Errors surfaced to users"), is therefore false for `network` and for `invalid_response`.

Note the secondary path: builder 1's decision is invisible to every AD-9 check. Rule (9) checks the set of `kind` values, not the content of any field.

### Severity

**CRITICAL for a self-hosted product.** It is an unauthenticated-adjacent internal-topology disclosure (the storage-settings page is behind auth, but the invite page at `app/invite/[token]` is public and also calls the client). It is also permanent: once shipped, every deployment leaks its own topology.

### AD text to add or tighten

> **AD-3 tightening:** redaction is keyed on **variant**, not on status. `network.cause` is a fixed enumeration, never a free string: `'timeout' | 'dns' | 'refused' | 'aborted' | 'unknown'`. The underlying transport error is logged by the client's configured logger and never placed in a `Result`. `server_error.message` is the fixed generic string. `invalid_response` carries no server-supplied text (see D4). Restated as one sentence: **the only `RustrakError` fields that may carry server- or transport-supplied text are `message` on the 4xx variants.**
>
> **AD-9 rule (11):** a table test over the client that, for every constructible error path, asserts the serialised `Result` contains no substring of `config.baseUrl` and no substring of the raw transport error.

---

## D4 (HIGH, security) - `invalid_response.issues` is an unredacted channel from the server's response body to the browser

### The two units

- **Unit A:** `features/projects/data.ts` `getProject(id)`. The Rust server adds a field to `Project` in `X.Y.Z` and a user runs `@rustrak/client@X.Y.(Z-1)`; the response fails `projectSchema` if the schema is strict, or a type change fails it regardless.
- **Unit B:** `features/tokens/actions.ts` `createToken(input)`, whose response includes the freshly minted 40-char token.

### The two compliant implementations

AD-3 fixes `{ kind: 'invalid_response'; message: string; issues: ZodIssue[] }`. Two builders differ on what reaches the browser:

```ts
// builder 1 - features/tokens/actions.ts, returns the Result unchanged (AD-2: "crossing every boundary unchanged")
return client.tokens.create(input);
// builder 2 - strips issues before returning
const r = await client.tokens.create(input);
return r.success ? r : Err({ ...r.error, issues: [] });   // but this is a `success:false` literal -> violates AD-9 rule (7)
```

Builder 2's defensive version is actually **forbidden** by AD-9 rule (7) ("no `success: false` object literal exists outside `@rustrak/client`") unless they route it through `Err()`, and AD-2's "crossing every boundary unchanged" reads as a direct instruction not to do it at all. So the spine actively pushes both builders toward builder 1.

What `ZodIssue[]` actually carries, verified against the installed `zod@4.4.3`:

```
[{"code":"unrecognized_keys","keys":["internal_db_column","sentry_key"],"path":[],
  "message":"Unrecognized keys: \"internal_db_column\", \"sentry_key\""}]
```

- `unrecognized_keys.keys` and the generated `message` enumerate **server field names**, including `sentry_key` and `dsn`, which `Project` carries as first-class fields (memlog line 21).
- `invalid_value.values` enumerates the allowed domain of an enum.
- `custom.params` is `Record<string, any>`.
- `$ZodIssueBase` declares `readonly input?: unknown`. In `4.4.3` the final issue objects are stripped of `input` (confirmed: `Object.keys(issue)` is `['expected','code','path','message']`), **but the public type says it may be there**, so any consumer may read it, and a Zod patch release restoring it is a silent leak with no test to catch it. The spine pins Zod exactly, which limits but does not remove this.
- `path: PropertyKey[]` includes `symbol`. A symbol in a value returned from a Server Action is a hard React serialisation throw, not a warning. Unreachable for JSON-parsed data today, but the *type* the spine wrote down permits it, and AD-2's "no value placed inside a `Result` may be a class instance or carry a non-`Object` prototype" does not cover symbols.

### The invariant that fails to arbitrate

AD-3 redacts on `status >= 500`. `invalid_response` has no `status`. AD-2 mandates the `Result` cross "unchanged". AD-9 rule (7) forbids reconstructing a redacted version outside the client. The three rules jointly **guarantee** that whatever the client puts in `issues` reaches the browser.

### Severity

**HIGH.** Field-name disclosure is low individually, but this is the one variant whose payload is unbounded and whose content is derived directly from a response body the client failed to understand.

### AD text to add or tighten

> **AD-3 tightening:** `invalid_response` carries `{ kind: 'invalid_response'; message: string; paths: readonly string[] }`, where `paths` is the dotted `issue.path` of each failure and nothing else. The full `ZodError` is logged by the client and never returned. Rationale: `paths` is what a developer needs to diagnose a contract drift; `keys`, `values`, `params` and `input` are response content and belong in a log, not in a value that crosses to the browser.

---

## D5 (HIGH) - `validation` (422) is unreachable, 413 and 410 are unrepresentable, and two forms will branch differently on the same server behaviour

### The two units

- **Unit A:** `features/projects/components/create-project-form.tsx`. Rejects a duplicate slug and a malformed slug.
- **Unit B:** `features/invitations/components/invite-form.tsx`. Rejects a bad role string and an expired token.

### What the Rust server actually emits

Read from `apps/server/src/error.rs`:

| `AppError` variant | Status |
| --- | --- |
| `NotFound` | 404 |
| `Validation` | **400** |
| `Conflict` | 409 |
| `Unauthorized` | 401 |
| `Forbidden` | 403 |
| `PayloadTooLarge` | **413** |
| `Database`, `Internal` | 500 |

There is **no 422 anywhere in the server** (`grep` for `UNPROCESSABLE` returns nothing). Every user-input rejection, including `AppError::Validation(format!("Invalid role: {}", body.role))` in `routes/team.rs:116` and `AppError::Validation(format!("Invalid project role: {}", body.role))` in `routes/members.rs:94`, arrives as **400 `bad_request`**.

Meanwhile 413 has no union member at all, and 410 has none either, yet the **existing** `src/actions/auth.ts` already branches on it:

```ts
if (err instanceof RustrakError &&
    (err.statusCode === 404 || err.statusCode === 400 || err.statusCode === 410)) {
  return { success: false, error: 'invalid' };
}
```

### The two compliant implementations

```ts
// Unit A - developer 1 reads the union and concludes bad_request is the input-rejection kind
if (!r.success && r.error.kind === 'bad_request') setError('slug', { message: r.error.message });
if (!r.success && r.error.kind === 'conflict')    setError('slug', { message: 'Already taken' });
```

```ts
// Unit B - developer 2 reads the union and concludes `validation` is the input-rejection kind
if (!r.success && r.error.kind === 'validation')  setError('email', { message: r.error.message });
if (!r.success && r.error.kind === 'bad_request') setError('root.serverError', { message: r.error.message });
```

Unit B's field-level branch **never executes**. Its bad-role rejection lands in a root-level toast. Two forms in the same app, same server behaviour, two different UX contracts, both literally compliant with AD-3.

And the 410/413 mapping is genuinely undecidable. The union types statuses as **literals** (`bad_request; status: 400`), so a 410 cannot be expressed as `not_found` without the `status` field lying. The only variant admitting an arbitrary status is `server_error: status: number`. A compliant builder therefore maps 410 to `server_error`, and because AD-3's redaction fires only at `status >= 500`, a 410 becomes a `server_error` that **still carries the server's message** - a kind/status/message combination the union never intended, and one that `isRetryable` will almost certainly get wrong. A second builder maps 413 to `bad_request` and writes `status: 400`, lying about the wire.

### The invariant that fails to arbitrate

AD-3 says the mapping "must be exhaustive over the union". Exhaustive over the *union* is not the same as **total over the status space**. The union has no catch-all 4xx member, and the spine's own "Knowingly unchecked" row disclaims responsibility ("whether the semantically correct `kind` was chosen for a given status").

### Severity

**HIGH.** It is guaranteed dead code plus guaranteed divergence, on the one path (forms) the spine calls out by name in Consistency Conventions.

### AD text to add or tighten

> **AD-3 tightening (three parts):**
> 1. Delete the `validation` variant, or make the Rust server emit 422 for `AppError::Validation` as part of this change. It cannot be both in the union and unreachable. **Preferred: delete it**, and state that `bad_request` is the input-rejection kind, since the server's own status assignment is the fact on the ground.
> 2. Add `{ kind: 'payload_too_large'; status: 413; message: string }` and `{ kind: 'gone'; status: 410; message: string }`; both are emitted or branched on today.
> 3. Add a total fallback: `{ kind: 'http_error'; status: number; message: string }` for any 4xx not otherwise named, with the same redaction posture as the other 4xx variants. Restate the exhaustiveness requirement as **total over `100..=599`**, and add AD-9 rule (12): a table test asserting every integer status in `400..=599` maps to a defined `kind`.

---

## D6 (HIGH) - `invalid_response` conflates "the server sent something we do not understand" with "the caller passed bad input"

### The two units

- **Unit A:** `features/projects/actions.ts` `createProject(input)` calling `client.projects.create`.
- **Unit B:** `features/issues/actions.ts` `addIssueComment(...)` calling `client.issues.addComment`.

### The fact on the ground

`BaseResource.validate` is used in **both directions**. There are **17 input-validation call sites** in `packages/client/src/resources/`:

```
projects.ts:61   this.validate(input, createProjectSchema)
projects.ts:75   this.validate(input, updateProjectSchema)
auth.ts:33/59    this.validate(credentials, registerRequestSchema / loginRequestSchema)
issues.ts:94/131/145/229/304, tokens.ts:42, members.ts:30, invitations.ts:15,
alert-rules.ts:45/62, alert-integrations.ts:42/58, auth.ts:114
```

All of them throw `ValidationError`, the same class AD-3 explicitly renames to `invalid_response` on the grounds that it "means 'our own response schema failed to parse', not 'the user's input was rejected'". That grounds statement is **only half true**: for these 17 sites it means exactly "the user's input was rejected", and the request is never even sent.

### The two compliant implementations

```ts
// builder 1, converting projects.ts: input failure and response failure both -> invalid_response
const parsed = createProjectSchema.safeParse(input);
if (!parsed.success) return Err({ kind: 'invalid_response', message: '...', issues: parsed.error.issues });
```

```ts
// builder 2, converting issues.ts: input failure -> `validation`, response failure -> invalid_response
if (!parsed.success) return Err({ kind: 'validation', status: 422, message: '...' });
//                                                            ^^^ a status that was never sent
```

Both are defensible readings. Builder 2 fabricates an HTTP status for a request that never left the process; builder 1 tells a form that its own bad input is a broken server contract. Downstream, `create-project-form.tsx` cannot write one branch that works against both.

### The invariant that fails to arbitrate

AD-3 defines one union member per *failure source it thought about*, and never enumerates "the caller passed input that failed the client's own request schema" as a source. AD-1's own list of expected outcomes is: *"any HTTP status the server can return, a transport failure, and a response that fails its own schema."* Input validation is a fourth source, unlisted.

### Severity

**HIGH.** 17 call sites, and it lands on the form path, which is the path with the most branching in the consumer.

### AD text to add or tighten

> **AD-1 addition:** a fourth expected outcome is named: **request input that fails the client's own request schema**. AD-3 gains `{ kind: 'invalid_request'; message: string; paths: readonly string[] }`, returned before any transport call. It is distinct from `invalid_response` (our contract with the server broke) and from `bad_request` (the server rejected a well-formed request). Consumers map `invalid_request` to field-level `setError`, and it is the only kind for which per-field mapping is defined.

---

## D7 (HIGH) - The `Result` contract is silent on empty, on void, and on fallback, and the auth case has a security consequence

The prompt named this ground; it is worse than expected, because three sub-cases each diverge and one of them is the app's auth gate.

### D7a - `Promise<void>` methods

`projects.delete`, `issues.delete` return `Promise<void>` today. Under AD-1 they become a `Result`. Two builders:

```ts
async delete(id: number): Promise<Result<void, RustrakError>>   // Ok(undefined)
async delete(id: number): Promise<Result<null, RustrakError>>   // Ok(null)
```

AD-2 says `{ success: true; data: T }`. With `T = void`, `Ok()` takes no argument and the object literal must still carry `data`. With `T = null` the call site reads `r.data === null`. Both compile. A consumer written against one gets a type error against the other, and the `Ok` helper needs two overloads that the spine never mentions. Twenty resources, ~10 delete-shaped methods, converted by different agents.

### D7b - empty paginated list

`client.projects.list()` returns `OffsetPaginatedResponse<Project>` with `items`, `total_count`, `page`, `per_page`, `total_pages`. The server returns `{items: [], total_count: 0, ...}` with **200**. So mechanically it is `success: true`. But `client.issues.list(projectId, ...)` for a **nonexistent** project: does the Rust server 404 or return an empty page? The spine does not say, does not require it to be uniform, and does not tell the consumer which to expect.

Two units: `features/projects/data.ts` `listProjects()` and `features/issues/data.ts` `listIssues()`. Developer 1 writes:

```ts
const r = await listProjects();
if (!r.success) return <ErrorState/>;
if (r.data.items.length === 0) return <EmptyState/>;
```

Developer 2, hitting a 404 for a deleted project, writes:

```ts
const r = await listIssues(projectId);
if (!r.success && r.error.kind === 'not_found') return <EmptyState/>;   // 404 IS the empty state here
```

Now the "no issues yet" onboarding empty state and the "this project was deleted" state are the same pixel in one feature and different pixels in the other.

### D7c - `getCurrentUser`, which today returns a fallback rather than throwing (SECURITY)

`src/actions/auth.ts` today:

```ts
export async function getCurrentUser(): Promise<User | null> {
  try { return await client.auth.getCurrentUser(); }
  catch (err) {
    if (err instanceof RustrakError && err.statusCode === 401) return null;
    console.error('Failed to get current user:', err);
    return null;                     // <- transient errors ALSO return null, deliberately
  }
}
```

and `app/(main)/layout.tsx` gates the entire authenticated app on it:

```ts
const user = await getCurrentUser();
if (!user) redirect('/auth/login');
```

Under AD-1 there is no `catch` and `client.auth.getCurrentUser()` returns `Result<User, RustrakError>`. Two compliant `features/auth/data.ts`:

```ts
// builder 1 - preserve today's null semantics
export async function getCurrentUser(): Promise<Result<User | null, RustrakError>> {
  const r = await client.auth.getCurrentUser();
  if (!r.success && r.error.kind === 'unauthenticated') return Ok(null);
  return r;
}
// builder 2 - pass through
export async function getCurrentUser(): Promise<Result<User, RustrakError>> {
  return client.auth.getCurrentUser();
}
```

And two compliant layouts, both blessed by AD-4:

```ts
// layout against builder 2, option i
const r = await getCurrentUser();
if (!r.success) redirect('/auth/login');    // a 500 or a network blip now reads as "logged out"
```
```ts
// layout against builder 2, option ii
const user = unwrap(await getCurrentUser());  // an unauthenticated user gets a crash page, not a login page
```

Option (i) is a real availability and support-load problem (every backend restart logs the whole instance out, and the memlog's gh-203 story is exactly a user misdiagnosing an error message). Option (ii) is worse: the login redirect stops working. Neither is "wrong" under AD-4, which explicitly says both `unwrap` and narrowing are legitimate local choices.

### The invariant that fails to arbitrate

AD-1 and AD-2 fix the *carrier*. Nothing in the spine says whether an expected-and-meaningful absence is `success: true` with a null payload or `success: false` with a kind. This is the single most-forked decision in any Result-based codebase and the spine does not take a position.

### Severity

**HIGH** overall; **the D7c auth-gate branch is CRITICAL-adjacent** because one compliant reading breaks the login redirect.

### AD text to add or tighten

> **AD-2 addition, the absence rule:** `success: false` means the operation did not complete. An operation that **completed and found nothing** is `success: true`. Concretely and bindingly:
> - An empty collection is `{ success: true, data: { items: [], total_count: 0, ... } }`. A list endpoint never returns `not_found` for an empty result; `not_found` on a list means the **parent** resource is gone and is rendered as a 404, never as an empty state.
> - A `void` operation is `Result<void, RustrakError>` and `Ok()` is callable with no argument. Never `Result<null, _>`.
> - A lookup whose absence is a normal outcome is modelled explicitly as `Result<T | null, RustrakError>` **in the feature's `data.ts`**, never in `@rustrak/client`, which always reports 404 as `not_found`. `features/auth/data.ts::getCurrentUser` is the named instance: it returns `Result<User | null, RustrakError>`, mapping only `unauthenticated` to `Ok(null)`.
>
> **AD-4 addition:** `app/(main)/layout.tsx` narrows: `Ok(null)` redirects to login, `success: false` calls `unwrap` and reaches `error.tsx`. An outage must never present as a logout.

---

## D8 (HIGH) - Cross-feature imports are never mentioned, and one entity spans four modules

### The two units

- **Unit A:** `app/(main)/projects/[id]/releases/[release]/page.tsx` needs (1) release health rows, which come from `client.sessions.stats`, and (2) issues first seen in that release, which come from `client.releases.newIssues` and return `Issue[]`.
- **Unit B:** `app/(main)/projects/[id]/page.tsx` (the overview) needs session summary + stats summary + top issues + project.

### The two compliant implementations

The existing `src/actions/sessions.ts` already contains `getAllReleaseHealthRows(projectId, release, period)`, a paging walk with `RELEASE_ROWS_PER_PAGE = 100`, that exists **solely for the releases detail page** but calls **the sessions resource**.

```ts
// developer 1: naming convention says "name matching the client resource" -> sessions owns it
// features/sessions/data.ts
export const RELEASE_ROWS_PER_PAGE = 100;
export async function getAllReleaseHealthRows(...)
```
```ts
// developer 2: the consumer is the releases route -> releases owns it, and imports sessions' single-page read
// features/releases/data.ts
import { getReleaseHealth } from '../sessions/data';   // is this legal? the spine never says
const RELEASE_ROWS_PER_PAGE = 100;                     // duplicated
```

Developer 3, told cross-feature imports are forbidden, writes a third copy calling `@rustrak/client` directly from `features/releases/data.ts`, which AD-9 rule (6) explicitly permits ("`@rustrak/client` is imported only from `lib/rustrak.ts`, `data.ts` and `actions.ts`" - **any** `data.ts`).

Same for `getNewIssuesForRelease`, which lives in `src/actions/releases.ts` today, calls `client.releases.newIssues`, and returns `Issue[]`. Issues module or releases module? The naming convention ("name matching the client resource") and the ownership convention ("`agents` owns traces and spans", implying feature ownership follows the entity) point in **opposite** directions.

### The invariant that fails to arbitrate

The spine's Consistency Conventions row "Naming - modules" resolves *name* collisions (`members` vs `team`, `transactions` vs `performance`) and is silent on *dependency* between modules. The memlog explicitly gathered the relevant prior art at line 34 ("Bulletproof React ... forbids sibling feature imports") and at line 32 ("import FSD's RULES: strict unidirectional layer imports, no sibling-slice imports, machine enforcement"), and **none of it made it into the spine**. AD-9 has six import rules and not one of them is about `features/*` importing `features/*`.

The concrete cost: `RELEASE_ROWS_PER_PAGE = 100` becomes two or three constants, which AD-7's "a threshold or constant that carries business meaning is defined exactly once and imported" is supposed to prevent - but AD-7 has no machine check and no cross-feature scope.

### Severity

**HIGH.** Eighteen modules, and the entities genuinely span them: a project appears in `projects`, `stats`, `sessions`, `issues`, `releases`, `members`, `alerts`, `storage`; a user appears in `auth`, `team`, `members`, `invitations`.

### AD text to add or tighten

> **AD-10 (new) - features are siblings and do not import each other.**
> - **Prevents:** an implicit dependency graph among 18 modules that nobody can see, and the duplication that follows when a builder avoids the import instead.
> - **Rule:** no file under `features/<a>/` imports a **value** from `features/<b>/` for `a != b`. Type-only imports are exempt (consistent with the standing decision that `@rustrak/client`'s inferred types are the app's ubiquitous view model). A read needed by two features is composed in the **route** that needs both, in `app/`, which is what AD-6 means by "it composes". A constant needed by two features moves to `src/content/`. Ownership tiebreak, stated once: **a feature owns the reads whose primary entity it is named for**, so `getAllReleaseHealthRows` is `features/sessions` (it returns `ReleaseHealthRow`) and `getNewIssuesForRelease` is `features/issues` (it returns `Issue[]`), regardless of which route consumes them.
> - **AD-9 rule (13):** no value import crosses a `features/*` boundary. Population floor: total import statements under `features/**`.

---

## D9 (HIGH) - AD-6 and its own machine check contradict each other, and there is a live violation today

### The two units

- **Unit A:** the `events/[eventId]` route. It has seven page-local components today (`tag-distribution`, `event-chart`, `collapsible-section`, `issue-indicators`, plus its own). Per AD-6 they exceed six and **must** move to `_components/`.
- **Unit B:** the `settings/team` route, which **already has** `app/(main)/settings/team/components/` on disk with three files.

### The two compliant implementations

AD-6 rule: *"Page-local components are colocated flat beside `page.tsx` until a single route directory exceeds six of them, at which point they move to that route's `_components/`."*

AD-9 check (8): *"every folder under `app/` is a route segment, route group or parallel slot, and no `_` folder sits at the bare `app/` root"*.

Developer 1 obeys AD-6 and creates `app/(main)/projects/[id]/issues/[issueId]/events/[eventId]/_components/`. Check (8), read literally ("every folder under `app/`"), fails it. Developer 2 reads AD-6's own preamble ("every folder **directly under** `app/` is a real route segment") and concludes check (8) applies only at depth 1, so they leave 12 loose components beside a page and also keep the existing non-underscored `settings/team/components/` (which Next.js would treat as the route `/settings/team/components`, a real bug: it has no `page.tsx`, so it is a dead segment today, but any file named `page.tsx` added there becomes a live route by accident).

The same check cannot both mandate and forbid `_components/`. Whichever way an implementer resolves it, the other implementer's tree fails the suite, and the spine gives no basis to prefer one.

### The invariant that fails to arbitrate

AD-6 scopes to "directly under `app/`". AD-9 check (8) scopes to "under `app/`". They are different scopes and the spine treats them as the same rule.

Secondary: AD-6's threshold "exceeds six" is an unowned magic number with no stated rationale, and there is no rule for what happens to a component when a route with `_components/` drops back below six.

### Severity

**HIGH**, because it is a direct internal contradiction in the one AD that the machine-check suite is supposed to enforce mechanically, and because the existing `settings/team/components/` is a real accidental-route hazard the spine does not name.

### AD text to add or tighten

> **AD-6 tightening:** the rule is stated once, at one scope. *"Every folder under `app/` is a route segment, a route group `(name)`, a parallel-route slot `@name`, or a private folder `_name`. A private folder never sits at the bare `app/` root. The only permitted private folder name is `_components`."* Then AD-9 check (8) is a transcription of that sentence, including `_components` in its allowlist. Add: **a non-underscored, non-route folder under `app/` is a violation**, and name `app/(main)/settings/team/components/` as the migration's first fix.

---

## D10 (MEDIUM-HIGH) - AD-9's anti-vacuity rule can itself be satisfied vacuously

### The two units

- **Unit A:** the agent implementing AD-9 check (9) in `apps/webview-ui/src/__tests__/architecture/`.
- **Unit B:** the agent implementing `packages/client/src/errors.ts`.

### The two compliant implementations

AD-9 check (9): *"a runtime test asserting the client's exported error `kind` values equal an explicit allowlist, so a new variant fails a test in the release that introduces it."*

But `RustrakError` under AD-3 is a **type**, not a value. `kind` has no runtime existence. Two builders:

```ts
// builder B1 - packages/client/src/errors.ts
export const ERROR_KINDS = ['bad_request','unauthenticated',...] as const;
export type RustrakError = { kind: 'bad_request'; ... } | ...;   // hand-written, NOT derived
```
```ts
// builder B2 - errors.ts exports the type only; no runtime array
export type RustrakError = ... ;
```

Against B2, the test agent's only options are (a) parse the `.d.ts` with ts-morph, or (b) write:

```ts
import * as client from '@rustrak/client';
const kinds = Object.keys(client).filter(/* ...error-ish... */);
expect(kinds.sort()).toEqual(ALLOWLIST.sort());   // kinds is [] -> and ALLOWLIST is [] -> PASSES FOREVER
```

That is precisely the vacuous-pass failure mode AD-9 was written to prevent, reproduced by AD-9's own rule. Worse: even against B1, if `ERROR_KINDS` is hand-written *alongside* a hand-written union rather than the union being **derived from** the array, the two drift and the test asserts nothing about the type.

### The invariant that fails to arbitrate

AD-9 requires "the matched population exceeds a floor" for every rule, but check (9) has no stated population and no stated source of truth. It is the one rule in the set whose subject may not exist at runtime.

### Severity

**MEDIUM-HIGH.** A test that cannot fail is worse than no test, by AD-9's own argument.

### AD text to add or tighten

> **AD-3 addition:** `errors.ts` exports `export const ERROR_KINDS = [...] as const` and the union is **derived from it**: every variant's `kind` is `(typeof ERROR_KINDS)[number]`, enforced by a `satisfies` check in the same file. Adding a variant without adding its kind to the array is a compile error in `@rustrak/client`.
>
> **AD-9 check (9) restated:** the test imports `ERROR_KINDS` as a value and asserts deep equality with a literal allowlist written in the test file. Population assertion: `expect(ERROR_KINDS.length).toBeGreaterThanOrEqual(10)`. Fixture proof: temporarily append a kind, confirm the test fails with a message naming it.

---

## D11 (MEDIUM-HIGH) - Two agents migrating two features produce mutually incompatible intermediate states, and the suite cannot be green in either

### The two units

- **Unit A:** agent 1 migrates `issues` (`src/actions/issues.ts`, 13 exports) to `features/issues/{data,actions}.ts`.
- **Unit B:** agent 2 migrates `team` + `invitations` (which today hold four of the six existing bespoke result shapes).

### The two compliant implementations

Both must land AD-9's suite. Three under-specified things fork immediately:

1. **Scope of check (7)**, "no `success: false` object literal exists outside `@rustrak/client`". Agent 1 scopes the walk to `src/features/**` so their PR is green while `src/actions/auth.ts`'s `{ success: false, error: 'invalid_credentials' }` survives untouched. Agent 2 scopes it to `src/**`, which makes their own PR red until **every** legacy action is converted, i.e. the migration cannot be incremental at all. Both scopes are "the rule as written".

2. **The population floors.** AD-9 mandates "the matched population exceeds a floor" but never says what the floors are or who sets them. Agent 1 writes `expect(dataFiles.length).toBeGreaterThan(0)`, which is satisfiable by one file and therefore near-vacuous. Agent 2 writes `toBeGreaterThanOrEqual(18)` (the module count from the Module Set), which makes the suite red until the last module lands, blocking agent 1's merge. The spine gives no basis to choose, and a floor is a number that must be **maintained** as modules are added, which the spine never assigns an owner to.

3. **Coexistence of `src/actions/` and `features/*/actions.ts`.** During migration a Client Component may import from either. Check (2) (the load-bearing ts-morph return-type rule) is scoped to `features/*/actions.ts`, so every un-migrated throwing action in `src/actions/` remains invisible to it, and gh-204 stays live in production for however long the migration runs, with a green suite reporting otherwise.

### The invariant that fails to arbitrate

The spine describes an end state and has no migration invariant. AD-9 says "the rule set is machine-checked" without saying whether a rule is red-until-done or green-from-day-one, which is the single most consequential property of an architecture rule in a brownfield repo.

### Severity

**MEDIUM-HIGH.** It does not corrupt the end state, but it can stall the migration or produce a green suite that certifies nothing.

### AD text to add or tighten

> **AD-9 addition, the migration clause:** every structural rule is scoped to `src/features/**` and `src/app/**` and is green from the first migrated module. `src/actions/` and `src/lib/` are declared **legacy roots**, exempt from checks (1) to (7), and a **single** additional rule asserts that the file count under each legacy root is **monotonically non-increasing**, with the current counts (18 and 13) written into the test as the starting ceiling. That makes the suite green on day one, red on any regression, and self-retiring when the roots reach zero. Population floors are derived, never hand-written: the floor for `data.ts` is `countDirs('src/features/*')`, not a literal.

---

## D12 (MEDIUM) - Non-`@rustrak/client` I/O has no home in the error union

### The two units

- **Unit A:** `features/version/data.ts` `getUpdateInfo()`. It `fetch`es `https://rustrak.github.io/rustrak/versions.json` directly, parses it with a **local** Zod schema, and today returns `UpdateInfo | null` with `catch { return null }`.
- **Unit B:** `features/version/data.ts` `getServerVersion()`, which does go through `client.health.getVersion()`.

### The two compliant implementations

AD-9 check (2) requires every exported action to return `Promise<Result<unknown, RustrakError>>`. AD-3 makes `RustrakError` closed. So Unit A must produce a `RustrakError` for a failure that has nothing to do with the Rustrak API.

```ts
// builder 1
if (!response.ok) return Err({ kind: 'network', message: 'Version feed unavailable' });
// -> lies: `network` means transport failure to the Rustrak API
```
```ts
// builder 2
return Ok(null);   // every failure, including a 500 from GitHub Pages, is "no update available"
// -> Result<UpdateInfo | null, RustrakError>, preserves today's behaviour, and now `success:true` means nothing
```
```ts
// builder 3
// declares this function exempt: it is not client-backed, so it keeps `Promise<UpdateInfo | null>`
// -> passes check (2) only if check (2) is scoped to actions.ts and this lives in data.ts, which it does
```

Three shapes, all compliant. Note builder 3 is the most honest and is fully legal, because **AD-9 check (2) binds only `actions.ts`**; `data.ts` has no return-type rule at all. That is a gap in its own right: the 46-function read population, the one AD-5 exists to relocate, has **no machine check that it returns `Result`**.

### The invariant that fails to arbitrate

AD-1 binds `@rustrak/client`. AD-3's union is closed and named for HTTP semantics. The spine never states whether the `Result` discipline binds *all* I/O in `data.ts`/`actions.ts` or only client-mediated I/O, and never gives `data.ts` a return-type check.

### Severity

**MEDIUM.** One function today, but the pattern (webhook test pings, integrations, source-map fetches) will grow.

### AD text to add or tighten

> **AD-1 addition:** the `Result` discipline binds every exported function in `features/*/data.ts` and `features/*/actions.ts`, whatever its I/O source. Non-Rustrak I/O maps into the same union via the same status-keyed rule; its failures are `network` or `http_error`, and the fact that the host is not the Rustrak API is carried in `message`, never in a new kind.
>
> **AD-9 check (14):** every exported value declaration in `features/*/data.ts` has a return type assignable to `Promise<Result<unknown, RustrakError>>`. This is the same ts-morph rule as check (2), applied to the read population, and its absence today means the larger of the two populations is unchecked.

---

## D13 (MEDIUM) - Degraded fallbacks have no stated home, so `success: true` can carry a fabricated value

### The two units

- **Unit A:** `features/sessions/data.ts` `getSessionSummary(projectId, period)`, which today returns `EMPTY_SESSION_SUMMARY` (all zeros, `crash_free_sessions_rate: null`) on any error.
- **Unit B:** `features/stats/data.ts` `getProjectStatsSummary(projectId, period)`, consumed on the same overview page.

### The two compliant implementations

```ts
// developer 1 - preserves today's behaviour inside data.ts
export async function getSessionSummary(...): Promise<Result<SessionSummary, RustrakError>> {
  const r = await client.sessions.summary(projectId, period);
  return r.success ? r : Ok(EMPTY_SESSION_SUMMARY);     // an outage now renders "0 crashes, 100% healthy"
}
```
```ts
// developer 2 - pushes the decision to the component, per AD-4's "degraded render"
export async function getProjectStatsSummary(...) { return client.stats.summary(projectId, period); }
// and in the page: if (!r.success) return <StatTileError/>;
```

On one dashboard, two tiles side by side: one shows a fabricated healthy zero on a backend outage, the other shows an error state. Developer 1's version is arguably a **correctness** bug for an error-tracking product (reporting "zero crashes" when the truth is "unknown"), and AD-2's compiler guarantee explicitly cannot catch it, because `Ok(EMPTY_SESSION_SUMMARY)` is a perfectly narrowed success.

### The invariant that fails to arbitrate

AD-4 blesses "a page that wants to render a degraded state narrows with `if (!result.success)`", which places the decision in the page. It does not **forbid** the fallback from being applied in `data.ts`, and the existing code does exactly that in two functions (`getSessionSummary`, `getSessionTimeseries`) plus `getNewIssuesForRelease`.

### Severity

**MEDIUM.** Contained, but it is the one failure mode where the spine's central claim ("a forgotten check cannot produce a silently broken render") is false: a fallback inside `data.ts` produces a silently *wrong* render that no check can see.

### AD text to add or tighten

> **AD-4 addition:** `data.ts` and `actions.ts` never substitute a fallback value for a failure. `Ok(x)` is returned only when the operation succeeded and `x` is what the source returned. A zeroed or empty stand-in is a **presentation** decision and lives in the component that renders it. Named instances to convert: `getSessionSummary`, `getSessionTimeseries`, `getNewIssuesForRelease`, `getUpdateInfo`, `getServerVersion`.

---

## D14 (MEDIUM) - A component shared by exactly two features has no home, and neither do cross-feature types

### The two units

- **Unit A:** `issue-list-card.tsx`. Imported today by `app/(main)/projects/[id]/overview-tiles.tsx` (the **projects** overview) and by `app/(main)/projects/[id]/releases/[release]/page.tsx` (the **releases** detail). It renders an `Issue`.
- **Unit B:** `metric-delta.tsx`. Imported by `app/(main)/projects/project-stats-cells.tsx` and by `components/charts/stat-tile.tsx`. It renders a percentage change, a concept owned by `stats` but consumed by `sessions` and `releases`.

### The two compliant implementations

The spine offers exactly two homes: `features/<module>/components/` and `src/components/{ui,charts,icons}/` ("feature-agnostic primitives").

```
developer 1: features/issues/components/issue-list-card.tsx
             -> then features/releases must import it, which AD-10 (D8) would forbid and the
                spine currently neither permits nor forbids
developer 2: src/components/issue-list-card.tsx
             -> it is not feature-agnostic (it knows Issue, IssueState, issue-status colours),
                so this quietly recreates the loose-components problem AD-6 exists to end
developer 3: duplicates it into both features
```

`trend-sparkline.tsx` is worse: it is imported by `project-stats-cells.tsx`, `issues-list.tsx`, **and** `issue-list-card.tsx`, so it spans three consumers across two features and a shared component.

Cross-feature **types** are equally homeless. The standing decision is that `@rustrak/client`'s inferred types are the view model, which covers most cases. But `UpdateInfo` (defined in `src/lib/version.ts` today) is a local type consumed by `version` and rendered by `components/update-banner.tsx`; AD-7 moves `version.ts` into a feature, and the banner then needs a cross-feature type import.

### The invariant that fails to arbitrate

AD-7's admission test is *"does it run in a test runner with nothing mocked?"*. That test classifies **logic**. It says nothing about **components**, which never pass it (they need React) and therefore fall through every clause of AD-7. AD-6 covers route-local components. Nothing covers the two-feature component.

### Severity

**MEDIUM.** It is the most common daily decision in the codebase and the spine leaves it entirely to taste.

### AD text to add or tighten

> **AD-7 addition, the component placement rule:** a component's home is decided by the **type it renders**, not by who imports it. A component whose props reference a domain type (`Issue`, `Project`, `ReleaseHealthRow`) lives in that entity's feature, always, however many features consume it. A component whose props are only primitives and `ReactNode` (`MetricDelta`, `TrendSparkline`, `CollapsibleSection`) is a primitive and lives in `src/components/`. Consumption by a second feature is handled by AD-10: the second feature does not import it; the **route** composes both. Duplication is never the answer.

---

## D15 (MEDIUM, security) - AD-5 argues from attack surface but declares no authorization invariant for the 35 endpoints it keeps

### The two units

- **Unit A:** `features/storage/actions.ts` `runStorageCleanup(options)`, a destructive instance-wide operation reachable from `settings/storage`.
- **Unit B:** `features/team/actions.ts` `removeMember(userId)`.

### The two compliant implementations

```ts
// developer 1 - thin, relies on the Rust server for authz (the canonical 3-line pattern, ~45 occurrences today)
export async function runStorageCleanup(o: CleanupOptions) {
  const client = await createClient(); return client.storage.cleanup(o);
}
```
```ts
// developer 2 - re-authorizes in the action
export async function removeMember(userId: number) {
  const me = await getCurrentUser();
  if (!me.success || me.data?.role !== 'admin') return Err({ kind: 'forbidden', status: 403, message: '...' });
  ...
}
```

Both compliant. Developer 2's guard is also **structurally impossible to write compliantly**: `Err({kind:'forbidden', ...})` constructs a `RustrakError` outside `@rustrak/client`, which AD-9 check (7) forbids as a `success: false` literal unless routed through `Err()`, and the spine's Consistency Conventions say "No consumer invents an error string or a code". So the spine's rules actively discourage the safer implementation.

### The invariant that fails to arbitrate

AD-5's *Prevents* clause is entirely a security argument: those 46 reads "publish an HTTP endpoint any client can POST to", "46 unnecessary endpoints of attack surface". Having made that argument, the spine states **nothing** about the 35 endpoints that remain published. The memlog captured the relevant first-party guidance verbatim at line 28 ("Treat every action as an untrusted entry point"; "render-time gating is not a security boundary") and at line 26 ("keep auth/authz in a dedicated server-only module while `use server` actions stay thin"), and none of it survived into the spine. Today the app's only auth gate is `(main)/layout.tsx`, which is render-time and therefore, by that guidance, not a boundary at all.

The Rust server is in fact the real authorization boundary (every action forwards the session cookie), and that is a defensible architecture. But it is **undocumented**, so a builder cannot tell whether a thin action is correct-by-design or an oversight, and a single Rust endpoint missing its membership check (cf. the standing "every `/api/stats/*` aggregate must honour the membership allowlist" rule) becomes directly reachable via a stable, discoverable action id.

### Severity

**MEDIUM.** Not exploitable as described, but it is an unstated assumption load-bearing on the whole design.

### AD text to add or tighten

> **AD-5 addition:** authorization is the Rust server's, in full. A Server Action forwards the session and adds no check of its own; the browser-reachable endpoint an action publishes is therefore no more privileged than the API call behind it. This is stated so it is auditable: **an action that calls anything other than `@rustrak/client` (a filesystem write, an env-var read, a direct `fetch` to a third party) is outside that guarantee and must state its own authorization**, and is listed here as it is introduced. `features/version/actions.ts` (external feed fetch) is the current sole instance and requires no auth by design.

---

## D16 (MEDIUM) - 4xx bodies are forwarded verbatim, and non-JSON error bodies have no parse contract

### The two units

- **Unit A:** `features/issues/actions.ts` sending a malformed body. Actix's own JSON extractor rejects it before `AppError` is reached and returns **its own** 400 with a `text/plain` body: `Json deserialize error: expected value at line 1 column 20`.
- **Unit B:** any request through a reverse proxy that is down, returning nginx's `502 Bad Gateway` HTML page.

### The two compliant implementations

The existing `transformHttpError` reads `error.data` and falls back to `HTTP ${status} error`. Under AD-3:

```ts
// builder 1 - falls back to the raw text when JSON parsing fails
const text = await response.text(); message = text.slice(0, 200);
// -> for Unit B this puts "<html><head><title>502 Bad Gateway</title>..." in a toast;
//    redaction saves it (502 >= 500), so this one is fine
// -> for Unit A it puts actix's parser internals in a user-facing toast, and 400 is NOT redacted
```
```ts
// builder 2 - fixed generic string on any non-conforming body
message = `Request failed (${status})`;
```

Unit A is the sharp case: AD-3 redacts only `>= 500`, so a 400 from a framework layer that never went through `error.rs` reaches the user verbatim. And the spine's "Knowingly unchecked" row disclaims exactly this ("whether the Rust server's 4xx bodies are free of internal detail, which is the server's to own"), while the Deferred section defers the `error.rs` fix, so **nobody owns it in this document**.

There is a second, live divergence: the Deferred section says "the client's parsing must accept both the nested `{error:{type,message}}` shape and the flat `{error:"..."}` shape the 429 path uses". Confirmed from source: `error.rs` emits only the nested shape, `http.ts` already handles both, and every test mock uses the flat shape. Two builders converting the mapper will disagree about which shape is canonical, and their **tests** will disagree, which is precisely why this was never caught before.

### The invariant that fails to arbitrate

AD-3 fixes the union and the redaction threshold. It does not fix (a) what happens when the body is not JSON, (b) which of the two body shapes is canonical, or (c) that the redaction threshold assumes all 4xx bodies came from `error.rs`.

### Severity

**MEDIUM.** Bounded disclosure, but it undermines the spine's flat claim that `error.message` is "always safe to render".

### AD text to add or tighten

> **AD-3 tightening:** the body parse is total and explicit. A body that does not match `{ error: { type: string, message: string } }` or `{ error: string }` yields the fixed string `Request failed (<status>)`; the raw body is never used as a message. The nested shape is canonical; the flat shape is accepted for the 429 path only and is scheduled for removal. **AD-9 check (15):** a table test over both shapes plus `text/html`, empty and truncated bodies, asserting the resulting `message` for each. The existing flat-shape test mocks are realigned as part of this work.

---

## Summary table

| # | Divergence | Severity |
| --- | --- | --- |
| D1 | `unwrap()` in `actions.ts` reproduces gh-204, passes AD-9 rule (2) | CRITICAL |
| D2 | `unwrap()` throw type unspecified; plain-object throw breaks `error.tsx`; `kind` lost across RSC render anyway | CRITICAL |
| D3 | `network.cause` leaks internal API host:port to the browser; redaction is status-keyed and cannot fire | CRITICAL |
| D4 | `invalid_response.issues` ships server field names and enum domains to the browser, unredacted, "unchanged" by mandate | HIGH |
| D5 | `validation`/422 unreachable (server maps `Validation` to 400); 413 and 410 unrepresentable | HIGH |
| D6 | `invalid_response` conflates input validation (17 sites) with response validation | HIGH |
| D7 | Empty vs void vs absence undefined; auth-gate reading can break the login redirect | HIGH |
| D8 | Cross-feature imports never addressed; one entity spans four modules | HIGH |
| D9 | AD-6 mandates `_components/`, AD-9 check (8) forbids it; live `settings/team/components/` | HIGH |
| D10 | AD-9 check (9) can pass vacuously, the exact failure AD-9 exists to prevent | MEDIUM-HIGH |
| D11 | Migration: rule scope and population floors unowned; suite cannot be green incrementally | MEDIUM-HIGH |
| D12 | Non-client I/O has no union member; `data.ts` has no return-type check at all | MEDIUM |
| D13 | Fallbacks may live in `data.ts`, so `success: true` can carry a fabricated zero | MEDIUM |
| D14 | Two-feature components and cross-feature types are homeless | MEDIUM |
| D15 | AD-5 argues attack surface, declares no authorization invariant for the endpoints it keeps | MEDIUM |
| D16 | Non-JSON 4xx bodies forwarded verbatim; two body shapes, neither declared canonical | MEDIUM |

## The one structural observation behind most of these

Twelve of the sixteen reduce to a single missing layer in the spine: it specifies **carriers** and not **meanings**. `Result` is defined, `RustrakError` is defined, file placement is defined, and directive placement is defined. What a `success: true` with an empty payload *means*, what a `not_found` on a collection *means*, when absence is a success, when a fallback is a lie, and which `kind` a form is entitled to branch on: none of that is written. A second document is not the answer; roughly four added sentences (the absence rule in AD-2, the unwrap-scope rule in AD-4, the variant-keyed redaction rule in AD-3, and AD-10 for feature siblings) close the majority of the surface.
