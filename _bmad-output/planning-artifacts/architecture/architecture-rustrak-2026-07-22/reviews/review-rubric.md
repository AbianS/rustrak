# Rubric Walker review - ARCHITECTURE-SPINE.md

**Target:** `_bmad-output/planning-artifacts/architecture/architecture-rustrak-2026-07-22/ARCHITECTURE-SPINE.md`
**Reviewed:** 2026-07-22
**Method:** every factual claim in the spine was checked against the working tree at `main` (719f84f). Version claims were checked against `package.json` and `pnpm-lock.yaml`, not against the spine's own prose or `CLAUDE.md`.

**Verdict:** the spine is unusually well-evidenced and most of its brownfield claims verify exactly. It is not yet safe to build from. Three of its nine ADs claim to prevent a divergence that their own check set does not stop; one whole dimension it owns (observability) is silent; one Stack row is factually wrong; and the mandated breaking change to a published package is under-specified in five separate ways, the worst of which is a name collision the spine never acknowledges.

---

## What verifies clean

Recorded first, because the spine's evidence base is stronger than most and the findings below should not be read as impeaching it wholesale. All of the following were checked and are accurate:

- `components/ui/` holds exactly 21 primitives.
- `lib/platform-snippets.ts` is 1370 lines; `platforms.ts` is 517; 1370 + 517 = the claimed 1887 lines of static tables.
- `lib/format-stack-trace.ts` is exactly 215 lines of ported Sentry algorithms.
- `packages/client/src/resources/` holds exactly 20 resources (excluding `base.ts` and `index.ts`).
- `transformHttpError` (`packages/client/src/utils/http.ts:48`) does have a `default:` branch returning a bare `RustrakError` with only a status, and 409 and 422 do fall into it.
- `ValidationError` is thrown from `resources/base.ts` `validate()` on **our own** response schema failing, carries no `statusCode`, and the name does mislead.
- `apps/server/src/error.rs:76` serialises `message: self.to_string()` for every variant including `Database(#[from] sqlx::Error)`.
- `lib/rustrak.ts` `createClient()` awaits `cookies()` at line 24, so the deferred `use cache` prerequisite is real as stated.
- 18 files carry `'use server'`, all under `src/actions/`; 85 exported async functions.
- 2 `error.tsx` exist (`app/error.tsx`, `app/(main)/error.tsx`); there is no `global-error.tsx`.
- 41 files import types from `@rustrak/client` and only 5 import a value, which is exactly why AD-9 check (6) needs its type-only carve-out. It has it.
- `import 'server-only'` needs no dependency: `apps/webview-ui/node_modules/next/types/global.d.ts:57` declares `module 'server-only'`, pulled in by `next-env.d.ts`'s `/// <reference types="next" />`. I confirmed the npm package is *not* resolvable from `apps/webview-ui` under pnpm and that this does not matter. The spine's claim is correct and was clearly verified rather than assumed.
- ~57 non-special `.tsx` sit loose under `app/` against the spine's "about 59" (the spine presumably counts `.ts` too). Within tolerance.

---

## 1. Does it fix the real divergence points for the level below, and does it miss any?

The divergences it does fix, and fixes well: result shape, error vocabulary, directive placement, `app/` folder legality, the home of derived logic, the read path, the module-name collisions (`members`/`team`, `transactions`/`performance`, `alerts`/`integrations`), and the architecture-test tooling choice. The `archunit` rejection in particular is argued from shipped source rather than docs and is the right call.

### F1.1 - The interaction between the migration and the enforcement is undecided - HIGH

The spine mandates a whole-tree reorganisation (`src/actions/` 18 files / 85 functions into `features/*/{data,actions}.ts`; ~57 loose `app/` components relocated; `lib/` split three ways; `@rustrak/client` inverted) **and** a check suite that asserts "the violation set is empty" (AD-9). On day one of the migration every one of checks (1)-(8) fails for every unmigrated file. The spine never says whether the checks land with a shrinking baseline allowlist, whether the whole migration must land as one atomic commit, or whether checks are added rule-by-rule as each becomes true. Two builders will answer this differently and produce incompatible repos.

It is worse than a normal migration question because `turbo`'s `test` task `dependsOn: ["^build"]`: the moment `@rustrak/client` changes shape, `webview-ui` and `packages/mcp` stop compiling, so a phased rollout across packages is not available even if a builder wanted it.

**Fix:** add one AD or one Deferred entry that states the sequencing contract. Suggested: "the `@rustrak/client` inversion, the `packages/mcp` consumer update and the `webview-ui` call-site update land as one commit, because lockstep versioning and `turbo`'s `^build` dependency make anything else unbuildable. The `webview-ui` tree reorganisation lands module by module; each architecture check is written and enabled in the commit that makes its population non-empty, and AD-9's population floor is what stops a check being enabled vacuously early."

### F1.2 - `src/actions/` and `src/hooks/` are given no disposition - HIGH

`apps/webview-ui/src/` today contains `actions/`, `app/`, `components/`, `hooks/`, `lib/`. The spine's target tree shows `app/`, `features/`, `lib/`, `content/`, `components/`, `__tests__/`. The top-level `actions/` (18 files) and `hooks/` (`use-mobile.ts`) simply vanish from the picture without a sentence saying they are removed.

This is not cosmetic, because it combines with F2.2 below: nothing in the AD set or the check set forbids `src/actions/` from surviving. Checks (1), (3) and (4) are all scoped to `features/*`. A half-finished migration that leaves `src/actions/projects.ts` in place passes every check in the spine.

`use-mobile.ts` is genuinely feature-agnostic, so the "role on the inside" axis (`features/<module>/hooks/`) has no slot for it and the spine's `components/{ui,charts,icons}/` line does not cover hooks.

**Fix:** state in AD-5 that `src/actions/` is removed and that `'use server'` may appear in exactly one filename in the repo. Add `hooks/` to the `components/` line in the target tree as the home for feature-agnostic hooks, or say `use-mobile` moves into `components/ui/`.

### F1.3 - The authorization boundary for the 35 published action endpoints is not decided - HIGH

AD-5's entire force comes from the observation that `'use server'` **publishes an HTTP endpoint any client can POST to**. The spine then removes that exposure for the 46 reads and leaves 35 mutations exposed by design, and says nothing further about them.

The research the spine drew on (recorded in `.memlog.md`) named this explicitly: "Treat every action as an untrusted entry point"; "render-time gating is not a security boundary"; keep auth/authz in a dedicated server-only module "while `use server` actions stay thin". And the brownfield reality it also recorded is that auth gating today lives in `app/(main)/layout.tsx` via `getCurrentUser()` plus `redirect`, i.e. render-time gating, repeated per page.

A builder reading only this spine will conclude the layout gate is sufficient, because the spine raises the endpoint-exposure argument and then only solves half of it.

**Fix:** add one sentence to AD-5. Something like: "the Rust server is the authorization boundary; every action reaches it carrying the session cookie via `lib/rustrak.ts`, and the server re-authorizes per request. `apps/webview-ui` performs no authorization of its own, and the `(main)/layout.tsx` gate is a redirect affordance, not a security control." If that is not true of every endpoint the actions call, the spine needs to say what is.

### F1.4 - `toast.error(error.message)` is not in fact always safe - MEDIUM

Consistency Conventions: "`toast.error` with `error.message`, which is now always safe to render because AD-3 redacts at the source." AD-3 redacts only when `status >= 500`. Two kinds have no status at all:

- `invalid_response` - means *our own* response schema failed to parse. Its message describes a broken internal contract (`"API response validation failed"` today), and it carries `issues: ZodIssue[]`. Rendering it to a user is exactly the "internal detail reaching a user" that AD-3 exists to prevent.
- `network` - carries `cause?: string` derived from a transport error, which can contain the internal `RUSTRAK_API_URL` host.

The spine's own memlog captured this ("`ValidationError` ... must map to INTERNAL, never to VALIDATION ... this is the easiest mistake in the whole design"), and then the spine kept the message field user-facing.

**Fix:** extend AD-3's redaction rule from "when `status >= 500`" to "when `status >= 500`, and for `invalid_response` and `network` unconditionally". Those three kinds get a fixed generic string; the raw detail moves to a separate non-rendered field (see F6.1). Then the convention's "always safe" claim becomes true.

### F1.5 - No correlation handle survives redaction - MEDIUM

See F6.1. Listed here because it is a divergence point for the level below: with 5xx redacted inside the client and no incident id, each implementation spec will invent its own way for support to correlate a user report with a server log, or none at all.

### F1.6 - `RustrakError` is redefined without disposing of the existing export - MEDIUM here, CRITICAL in the breaking-change section

See the dedicated section below.

### F1.7 - A named brownfield bug was dropped - LOW

`.memlog.md` flagged `src/lib/constants.ts:1` as the bare statement `'server only';` (with a space) rather than `import 'server-only'` - a no-op that creates no boundary, in a file imported by two page components, and it explicitly called it "worth fixing under this architecture". The spine never mentions it. Since AD-5 makes `import 'server-only'` load-bearing, leaving a near-miss spelling in the tree is an active trap.

**Fix:** one line in AD-7 or the target tree: `constants.ts` is glue and stays in `lib/`, with its no-op directive replaced by a real `import 'server-only'`.

---

## 2. Is every AD's Rule enforceable, and does it prevent what it claims?

### F2.1 - AD-4's "neither contains a `try/catch`" is unenforced, unlisted, and load-bearing - HIGH

AD-4's Rule says `data.ts` and `actions.ts` "both return `Result` and neither contains a `try/catch`". This is not among AD-9's nine enumerated checks, and it is not in the "Knowingly unchecked" row either. It falls through a gap between the two lists, which is precisely the failure mode AD-9 was written to avoid.

It is not a stylistic rule. `.memlog.md` records that `unstable_rethrow` was "LOAD-BEARING TODAY, not hypothetical: every action calls `createClient()` which awaits `cookies()`, a Request-time API that throws `DynamicServerError` during static generation, so swallowing it would convert a framework bailout into a false failure result and silently produce a wrong render". The design then removed `unstable_rethrow` on the sound reasoning that with no catch block there is nothing to swallow. That reasoning holds **only for as long as the no-catch rule holds**, and the spine dropped every trace of `unstable_rethrow` while leaving the rule that replaced it unchecked.

Note also that check (2) does not catch this: a function with a `try/catch` that returns `Err(...)` still has return type `Promise<Result<T, RustrakError>>`.

**Fix:** add a tenth check - no `TryStatement` node in any `features/*/data.ts` or `features/*/actions.ts` (trivial with the `ts-morph` project already required for check (2)). Add a sentence to AD-4 recording *why*: that framework control-flow throws (`DynamicServerError` from `cookies()`, `redirect()`, `notFound()`) must propagate, and that this is what makes `unstable_rethrow` unnecessary rather than merely unused.

### F2.2 - AD-5's stated "Prevents" is not prevented by any check - HIGH

AD-5 claims to prevent "46 read functions ... continuing to carry `'use server'`" and "the two populations drifting apart as a matter of discipline". The checks that back it are (1) every `features/*/actions.ts` opens with `'use server'`, (3) no `'use server'` appears under any `data.ts`, (4) every `data.ts` opens with `import 'server-only'`.

None of these forbids `'use server'` appearing anywhere else. A `'use server'` at the top of `features/issues/components/bulk-bar.tsx`, or in a surviving `src/actions/issues.ts`, or inline in a `page.tsx`, publishes exactly the endpoints AD-5 exists to eliminate and passes all nine checks. The rule as written is a rule about two filenames, not a rule about the directive.

**Fix:** restate check (1) in its complementary form: `'use server'` appears in `src/` only as the first statement of a file named `features/*/actions.ts`, and nowhere else - including no inline `'use server'` function bodies. This is a single `fs` walk plus a first-line predicate, is strictly stronger, and is what AD-5's "Prevents" actually describes.

### F2.3 - AD-2's "no class instance inside a Result" is unchecked, and the AD's own analogy invites the violation - MEDIUM

AD-2 requires that "no value placed inside a `Result` may be a class instance or carry a non-`Object` prototype" - the one rule standing between the design and the hard React serialisation throw the AD quotes verbatim. It is not checked and not listed as knowingly unchecked.

The trap is sharpened by the AD's own rationale. It tells developers to hold one shape in their head because `Result` mirrors Zod `safeParse` exactly. But `safeParse`'s failure branch is `{ success: false, error: ZodError }` and `ZodError` **is a class instance**. A developer who internalises "same shape" and returns a `safeParse` result from an action gets the runtime throw AD-2 exists to prevent, and check (7) will not see it because there is no `success: false` object literal - the object came from Zod.

**Fix:** either add a check (a `ts-morph` assertion that no exported action return type resolves to a type with a constructor signature is hard; a cheaper, honest alternative is a runtime unit test over the helper constructors), or move this explicitly into "Knowingly unchecked" **with the Zod trap named**, so a reviewer knows to look for it. The second is acceptable; silence is not.

### F2.4 - AD-6 is only half-checked - MEDIUM

AD-6's Rule has four clauses: (a) every folder under `app/` is a segment, group or slot; (b) page-local components colocate flat until a route exceeds six, then move to `_components/`; (c) no `_` folder at the bare `app/` root; (d) `app/` contains no `data.ts`, no `actions.ts` and no derived logic.

Check (8) covers (a) and (c). Nothing covers (b) or (d). Yet (b) is the clause that addresses the stated Prevents - "about 59 components sit loose beside their `page.tsx` ... no one can tell a route-private component from one that should be shared". A rule whose numeric threshold is the whole point, left to review, will not hold at 57 files.

(b) and (d) are both trivial `fs` walks: count non-special `.tsx` per route directory; assert no file named `data.ts`/`actions.ts` under `app/`.

**Fix:** extend check (8) to cover all four clauses, or state (b) and (d) as knowingly unchecked and accept that AD-6 does not prevent what it says it prevents.

### F2.5 - AD-7's admission test is genuinely subjective, and its "only" is contradicted by the tree - MEDIUM

Two problems.

First, "does it run in a test runner with nothing mocked?" is not a decidable question at authoring time, and `apps/webview-ui` has no test runner today, so the test is counterfactual for the entire migration. `lib/chart-format.ts` (43 lines, `percentChange`) passes the test cleanly and belongs to no single feature - it serves `components/charts/*`. `lib/breadcrumbs.ts` (23 lines) passes and serves `events`. `lib/issue-status.ts` (65) passes and serves `issues`. But `chart-format.ts` has no feature. Two builders will place it in `features/stats/`, in `components/charts/`, and in `lib/` respectively.

Second, the Rule says "`src/lib/` retains **only** genuinely cross-feature, non-domain helpers (`utils.ts`, `rustrak.ts`)". By the admission test, `clipboard.ts` (39 lines, needs `navigator`) and `constants.ts` (5 lines, reads `package.json`) are both glue and both belong in `lib/`. The parenthetical enumerates two files where the rule implies four or more, so the enumeration reads as exhaustive and contradicts the test.

**Fix:** change the parenthetical to "e.g. `utils.ts`, `rustrak.ts`, `clipboard.ts`, `constants.ts`" so it is illustrative, and add one line settling the cross-feature-derived-logic case: derived logic that serves a `components/` primitive rather than a feature lives beside that primitive (`components/charts/format.ts`), because the admission test decides *whether* it is derived logic and the consumer decides *where*.

### F2.6 - Check (2) has an implementation prerequisite that will bite - MEDIUM

Check (2) - "every exported value declaration in `features/*/actions.ts` has a return type assignable to `Promise<Result<unknown, RustrakError>>`" - is correctly identified as the load-bearing rule. It requires `ts-morph` to resolve the project's types. Two things will break a naive implementation:

- `data.ts` starts with `import 'server-only'`, which resolves **only** through `next/types/global.d.ts`'s ambient `declare module 'server-only'`, reachable only via `next-env.d.ts`. A `ts-morph` `Project` constructed from a bare file glob rather than from `tsconfig.json` will report TS2307 on every `data.ts`.
- `ts-morph`'s bundled TypeScript version must be able to parse a TypeScript 6.0.3 project. The spine already noted `archunit` bundles 5.9.3 and rejected it partly for that; the same risk applies to `ts-morph` and is not noted.

**Fix:** state in the Architecture-test tooling row that the `ts-morph` `Project` is constructed from `apps/webview-ui/tsconfig.json` (not a glob), and pin `ts-morph` to a version whose bundled `typescript` is >= 6.0.

### F2.7 - AD-5's "compilation error" overstates what the type checker does - LOW/MEDIUM

AD-5 says `import 'server-only'` "makes inclusion in the client module graph a **compilation error**". Precisely: `next/types/global.d.ts` declares the module as an empty ambient module, so `tsc --noEmit` accepts a Client Component importing a server-only module without complaint. The error is produced by the bundler alias (`next/dist/build/webpack-config.js:1146` and the Turbopack equivalent) during `next build`.

This matters because `apps/webview-ui` has **no** `check-types` script (see F6.2), so the only gate that produces the error is `next build`. Calling it a "compilation error" invites a builder to believe `tsc` covers it.

**Fix:** say "a build error, produced by the bundler at `next build`, not by `tsc`". The Layer enforcement row already gets this right ("is a build error, not a test"); AD-5's phrasing should match it.

### F2.8 - AD-9's "each check proves it can fail" is a ritual with no residue - LOW

The rule says a violating fixture is added, the failure confirmed, and the fixture removed. After removal nothing distinguishes a rule that was proved from one that was not, and a later refactor of the rule's predicate re-introduces the vacuous-pass risk with no signal. This is the exact failure the AD cites from the reference project.

**Fix:** keep the fixtures. Each rule file exports its predicate and carries two tests: the population/violation assertion over the real tree, and a unit test running the same predicate over an in-memory fixture that must be reported as a violation. Same cost, permanent residue.

### F2.9 - AD-8's `router.refresh()` clause is unchecked - LOW

"Mutations initiated in the browser go through `actions.ts` and are followed by `router.refresh()`." Unchecked and unlisted. Acceptable to leave unchecked (it is a dataflow question), but it should be in the "Knowingly unchecked" row rather than absent.

---

## 3. Could anything under Deferred let two independently-built units diverge?

### F3.1 - `apps/server/src/error.rs` - the 4xx body contract is a real unmade decision - HIGH

This is the sharpest Deferred finding. The spine simultaneously:

- mandates that 4xx `message` values flow **verbatim** to end users (`toast.error(error.message)`, and AD-3 only redacts 5xx);
- defers "the exact shape of the emitted body" to the server;
- and lists "whether the Rust server's 4xx bodies are free of internal detail" as knowingly unchecked, "which is the server's to own".

So the spine decides that a string is rendered to users and defers whether that string is safe, to a different codebase, with no contract. A client builder and a server builder will answer "what may a 4xx `message` contain?" differently, and the divergence is a data-leak, not a style difference. `error.rs:76` currently emits `self.to_string()` for **every** variant, so the current 4xx answer is "whatever `thiserror` formats", which for several variants includes internal identifiers.

**Fix:** promote one sentence out of Deferred into AD-3: "a 4xx `message` is a user-facing string; the server guarantees it contains no internal identifier, no SQL, and no column or constraint name. Any 4xx that cannot meet that guarantee must be emitted as a 5xx." That is an invariant, it is testable on the server side, and it is what makes the verbatim-render decision defensible. The *shape* of the body can stay deferred.

### F3.2 - `packages/mcp` "call-site changes, not invariants" understates it - MEDIUM

`packages/mcp/src/errors.ts` is a 32-line `instanceof` cascade over `NotFoundError`, `RateLimitError`, `AuthenticationError` and `RustrakError`, producing four distinct MCP-facing messages. AD-3 deletes all four classes. What replaces it is not a call-site edit; it is a fresh decision about which of the ten `kind` values get bespoke MCP text (the current four? all ten? does `invalid_response` surface as "API error" or as something an AI agent can act on? does `forbidden` say something different from `unauthenticated`, which today it cannot because there is no `AuthorizationError` branch?).

Two builders produce materially different MCP behaviour. `packages/mcp` also has 16 test files that will need the same treatment.

**Fix:** either state the mapping in AD-3 (a `kind` -> MCP-message table is four lines), or reword the Deferred entry to name it as an open decision rather than as mechanical work: "`packages/mcp`'s `toMcpError` becomes an exhaustive `switch` over `kind`; which kinds earn bespoke agent-facing text is decided in the implementation spec."

### F3.3 - Deferring `unstable_retry` leaves AD-4 depending on broken machinery - MEDIUM

AD-4's Rule routes deliberate failures to `error.tsx` via `unwrap()`, and its Prevents says making nothing throw "forfeits `error.tsx` as an automatic boundary for the 26 pages that rely on it". The Deferred section then states plainly that `(main)/error.tsx`'s retry button "cannot currently work" because `reset()` cannot recover from Server Component errors, and that the fix is deferred.

So the architecture's chosen failure path terminates at a boundary whose only recovery affordance is known non-functional, and the spine ships that as an invariant while deferring the repair. That is not two builders diverging - it is one builder correctly implementing a design that is known to leave users at a dead end.

**Fix:** move the `unstable_retry` swap out of Deferred and into AD-4 as a clause ("a boundary that AD-4 routes failures to must offer a working retry; `reset()` does not recover Server Component errors, so `(main)/error.tsx` uses `unstable_retry`"). It is two lines of code and it is what makes AD-4's trade honest. `unstable_catchError` is correctly deferred - that one genuinely is an enhancement.

### F3.4 - Correctly deferred, no finding

- **Client-side data fetching** - genuinely a re-platforming, and AD-8 forecloses it positively rather than leaving a hole. Well handled.
- **Cache Components** - the `cookies()` prerequisite is stated precisely and verified against `lib/rustrak.ts`. The note that the tag vocabulary needs a named home is the right forward-looking flag. Good.
- **Component tests** - correctly deferred with the reason given (Vitest and async Server Components).
- **Sub-structuring `components/ui/`** - correctly deferred, and honest that no threshold guidance exists.
- **Revisiting the no-layers decision** - the reopen conditions are concrete and falsifiable. Model entry.

---

## 4. Is named technology verified-current?

### F4.1 - The `ky` version is wrong - HIGH

Stack row: "ky | 1.14.3 `[ADOPTED]`, sealed inside `@rustrak/client`".

Actual: `packages/client/package.json` pins `"ky": "2.0.2"`, and `pnpm-lock.yaml` resolves `ky@2.0.2`. There is no ky 1.14.3 anywhere in the tree.

This is not a transcription nit. `packages/client/src/utils/http.ts` already uses `isHTTPError` and `error.data`, which are ky 2 APIs; a builder who trusts the Stack table and pins 1.14.3 breaks the client. The value 1.14 also appears in the root `CLAUDE.md` ("ky 1.14+"), which is the likely source - i.e. the row was copied from stale prose rather than verified, which is exactly what an `[ADOPTED]` tag is supposed to rule out. Every other version row (Next 16.2.10, React 19.2.7, TypeScript 6.0.3, Tailwind 4.3.2, Zod 4.4.3, react-hook-form 7.81.0, Biome 2.5.4) verifies exactly against `package.json`, so this is an isolated miss - but it is in the one package the spine is breaking.

**Fix:** ky 2.0.2. Consider also updating the root `CLAUDE.md` line that seeded it.

### F4.2 - `ZodIssue` is the deprecated alias, and the spine puts it in a published type - MEDIUM

AD-3 declares `{ kind: 'invalid_response'; message: string; issues: ZodIssue[] }`. In zod 4.4.3, `zod/v4/classic/errors.d.ts:3` carries: `@deprecated Use z.core.$ZodIssue from @zod/core instead, especially if you are building a library on top of Zod.` `@rustrak/client` is a library built on top of Zod, and this is the exact case the deprecation names.

There is a second, larger consequence the spine does not acknowledge: `@rustrak/client` today exports **no** Zod types at all (the public surface is `RustrakClient` + `ClientConfig` + 9 error classes + ~120 pure type exports). Putting `ZodIssue` in an exported union makes `zod` part of the package's public type surface for the first time, so every external installer's TypeScript now needs a compatible zod resolution.

There is also a serialisation risk that cuts against AD-2: a zod issue's `path` is a `PropertyKey[]`, which admits `symbol`. A `symbol` in a value crossing a Server Action boundary is not serialisable.

**Fix:** do not export a zod type. Flatten at construction to a client-owned plain shape: `issues: { path: (string | number)[]; message: string }[]`. That keeps the public surface zod-free, satisfies AD-2's serialisability guarantee by construction, and sidesteps the deprecation entirely.

### F4.3 - Two Stack rows violate the spine's own pinning convention - LOW/MEDIUM

Consistency Conventions: "Dependency pinning | Exact versions, no caret or tilde, per standing repo policy." The Stack table then lists `vitest | 4.x` and `ts-morph | latest stable at install`. Two builders installing a week apart get different versions, and "4.x" is not a thing you can put in a `package.json` under this repo's policy.

`packages/client` and `packages/mcp` both pin `vitest` at `4.1.10`; matching that is presumably the intent and should be stated.

**Fix:** `vitest 4.1.10` to match the sibling packages. Pin `ts-morph` to a concrete version (see F2.6 on the TypeScript 6 constraint).

### F4.4 - `sonner` and `@hookform/resolvers` are prescribed but absent from the Stack - LOW

The conventions mandate `toast.error(...)` (that is `sonner`, pinned at 2.0.7) and "react-hook-form with a Zod resolver" (that is `@hookform/resolvers`, pinned at 5.4.0). Both are named behaviourally and neither appears in the Stack table, while `react-hook-form` itself does. Minor asymmetry; a builder has to go find the versions.

**Fix:** add both rows, or drop `react-hook-form` from the table for consistency and let the conventions row carry it.

---

## 5. Does it ratify rather than contradict the existing brownfield codebase?

Broadly yes - see the "verifies clean" list above, which is long. The exceptions:

### F5.1 - Existing `instanceof RustrakError` call sites are not acknowledged - MEDIUM

Four files under `src/actions/` branch on the class: `auth.ts` (three sites, one of which reads `err.statusCode === 401` and another branches on 404/400/410), `invitations.ts`, `members.ts`, `team.ts`. AD-3 deletes the class and renames `statusCode` to `status`. The spine names `packages/mcp` as an affected consumer and does not name these.

They will be rewritten anyway as part of the `features/` migration, so the code impact is absorbed - but `actions/auth.ts`'s status-code branching is the "leak" the memlog identified as callers reasoning in HTTP, and the spine's error union **entrenches** it by exposing `status` on every kind. That may well be the right call, but it is a decision the spine takes silently.

**Fix:** one line in AD-3 acknowledging that `status` remains on the public error type deliberately - consumers legitimately branch on 401 and 409 - so that a later reader does not treat it as an oversight.

### F5.2 - `router.refresh()` is credited to the wrong file count - LOW

Conventions: "`router.refresh()`, the established idiom in 24 files." Actual: 28 call sites across **14** files. 24 is the `useTransition` file count (recorded correctly as such in `.memlog.md`); the two numbers got crossed in the spine. Harmless in effect, but it is a load-bearing "this is already the idiom" argument resting on an inflated figure.

**Fix:** "28 call sites in 14 files, paired with `useTransition` in 24."

### F5.3 - The dual-body-shape work is described as pending when it is already done - LOW

Deferred: "The client's parsing must accept both the nested `{error:{type,message}}` shape and the flat `{error:"..."}` shape the 429 path uses; every existing test mock uses the flat shape, which is why the mismatch was never caught."

`packages/client/src/utils/http.ts:19-29` already handles both, with a comment citing #204. The mock realignment may still be outstanding, but the parsing is not. As written a builder will re-implement it.

**Fix:** "the client's parsing already accepts both shapes (`utils/http.ts`); what remains is realigning the test mocks, which all use the flat shape."

### F5.4 - `health` -> `version` is the one unstated module remap - LOW

The Module set names `version`; the client resource is `health.ts`. The convention says module names match "the client resource where one exists", and every other remap is resolved explicitly (`spans` under `agents`, `alert-rules` -> `alerts`, `alert-integrations` -> `integrations`, `sourcemaps` deliberately absent). `health` -> `version` is the only one left to inference.

**Fix:** add it to the collisions-resolved sentence.

---

## 6. Is every dimension this altitude owns decided, deferred, or an open question?

I take this altitude to own: structure, data flow, the error contract, enforcement tooling, build and CI wiring for that tooling, the configuration/secret boundary, observability of failures it deliberately destroys information about, and the packaging path for the app it restructures. I do **not** think it owns accessibility or visual design (owned by the UX artifact), nor detailed performance budgets (AD-8 already carries the one performance invariant that is structural).

### F6.1 - Observability is entirely silent, and AD-3 actively destroys information - HIGH

This is the clearest whole-dimension gap. The spine says nothing about logging, error reporting, or correlation, anywhere.

It is not a neutral omission, because AD-3 makes it worse on purpose: "when `status >= 500`, the server's message is discarded and replaced with a fixed generic string." `.memlog.md` had the answer and the spine dropped it - the earlier decision read "the real message is discarded, which is why the mapper emits an **incidentId** and logs the full error server-side". Neither survives into the spine.

The result: a user reports "something went wrong", and there is no handle connecting that report to any server log line. For an error-tracking product this is a pointed omission - the dashboard cannot say anything about its own failures.

Related and also silent: `apps/webview-ui` does not report its own errors anywhere (no Sentry SDK, no `instrumentation.ts`, no `onRequestError`), which is at least worth a deliberate "not now".

**Fix:** add an AD or a Consistency Conventions row. Minimum viable: `server_error` carries `incidentId?: string`, populated from a response header the Rust server sets (`X-Request-Id` or equivalent); `toast.error` renders the generic message plus the id; the id is never rendered for non-5xx kinds. Then add one Deferred entry for the app's own error reporting, so the dimension is at least named.

### F6.2 - Build and CI wiring is understated to the point of being wrong - HIGH

AD-9: "run by `pnpm test` and therefore by `pnpm ci` with no CI file changes." Literally true and materially incomplete.

`apps/webview-ui/package.json` has exactly four scripts: `dev`, `build`, `start`, `knip`. No `test`, no `lint`, no `format:check`, no `check-types`. Root `ci` is `turbo run test build lint format:check`. So `apps/webview-ui` is today the **only** workspace package entirely outside the quality pipeline - `.memlog.md` states this explicitly and the spine did not carry it forward.

Two consequences the spine needs to own:

- `check-types` is the missing one that matters most. AD-4's core guarantee ("reading `.data` without narrowing is a compile error, so a forgotten check cannot produce a silently broken render") and AD-5's `server-only` guarantee both depend on the type checker running in CI. Today `next build` is the only gate, and `next build` type-checks the app graph but is a slower, coarser signal than `tsc --noEmit`. Adding `test` alone leaves the compiler-enforced half of the architecture ungated by a dedicated check.
- `lint` and `format:check` also do not run for this package, so the Biome `useFilenamingConvention` rule the conventions table cites as "already enforced repo-wide by Biome at error level" is **not** in fact enforced in CI for `apps/webview-ui`. That undercuts the "Naming - files" convention row directly.

**Fix:** state in AD-9 which scripts `apps/webview-ui/package.json` gains - `test` (vitest), `check-types` (`tsc --noEmit`), `lint` and `format:check` (biome) - and note that this is what plugs the package into `pnpm ci` for the first time. Correct the "Naming - files" row to say the rule becomes enforced for this package as part of that.

### F6.3 - The packaging and deployment path is never mentioned - MEDIUM

`apps/webview-ui` ships as a Docker image built from `apps/webview-ui/Dockerfile`, via `turbo prune webview-ui --docker`, `pnpm install`, `pnpm run build`, with `next.config.ts` set to `output: 'standalone'` and the runner copying `.next/standalone`, `.next/static` and `public/`. There is a `.github/workflows/docker-publish.yml`. The spine mentions none of this, and it introduces changes that touch it:

- `src/__tests__/architecture/` sits **inside** `src/`, and `tsconfig.json` `include` is `**/*.ts` / `**/*.tsx`. So the architecture tests are type-checked by `next build` inside the Docker image, and their `vitest` and `ts-morph` imports must resolve at image-build time. The Dockerfile's `pnpm install` is not `--prod`, so they will - but only by accident, and it adds `ts-morph` (a heavyweight dep carrying its own TypeScript) to every image build.
- `apps/webview-ui/knip.json` configures Next entry points. It has no `vitest` plugin config and no test entry patterns, so `pnpm knip` will report the new test files as unused files and `vitest`/`ts-morph` as unused devDependencies.

**Fix:** add a short Consistency Conventions row or a target-tree note: architecture tests live at `apps/webview-ui/tests/architecture/` (outside `src/`, so `next build` and the standalone trace never see them) and are excluded from `tsconfig.json`'s `include` with a dedicated `tsconfig.test.json`; `knip.json` gains the vitest entry patterns. If keeping them under `src/` is deliberate, say so and say why.

### F6.4 - The configuration / environment boundary is undecided - MEDIUM

`RUSTRAK_API_URL` is read in exactly one place today (`lib/rustrak.ts:31`), which is a good property nobody has written down. The Next.js data-security guidance the spine drew on states the rule as a security control in the same breath as the SDK rule: "verify that database packages **and environment variables** are not imported outside the Data Access Layer". AD-9 check (6) implements the SDK half and omits the env half.

Also unaddressed: nothing says which env vars exist, whether any may be `NEXT_PUBLIC_`, or how the deployed image is configured. For a self-hosted product where the operator sets these by hand, "which variables does the UI read" is a real contract, and the spine restructures the only file that answers it.

**Fix:** extend check (6) to `process.env` - it may be read only in `lib/rustrak.ts` and `next.config.ts`, and no `NEXT_PUBLIC_` variable is introduced without an explicit decision. One extra predicate in a check that already walks the tree.

### F6.5 - Testing beyond architecture tests - NO FINDING

Correctly handled. AD-9 decides the architecture suite; Deferred names component and integration testing as a separate decision with a real reason (Vitest and async Server Components). That is a dimension decided-and-deferred, which is what the rubric asks for. The one omission is the client's own existing suite, which belongs to the breaking change and is filed there (F7.3).

### F6.6 - Performance - NO FINDING

AD-8 carries the structural performance invariant (Server Action serialisation), Deferred carries caching with a verified prerequisite, and Consistency Conventions rules out barrel-file/tree-shaking questions by not introducing barrels. Nothing further is owed at this altitude. Adding a performance-budget section would be padding.

### F6.7 - Accessibility - LOW

I do not think a structural spine owns a11y, and I am not treating its absence as a real gap. But the spine does own `components/{ui,charts,icons}/` placement and `src/app/` composition, and the repo has a `web-design-guidelines` skill, so a single line stating that accessibility and visual design are owned by the UX artifact and not by this spine would close the question rather than leave a reader wondering. Optional.

---

## 7. The breaking change to `@rustrak/client` - is there enough to execute it?

**No.** The *design* is clear and well-argued. The *execution contract* is missing in six places, one of which is a name collision that will stop a builder cold on the first file.

### F7.1 - `RustrakError` already exists as an exported class, and the spine never says what happens to it - CRITICAL

`packages/client/src/errors/base.ts` exports `class RustrakError extends Error` with `retryable`, `statusCode` and `cause`. It is the base of a nine-class hierarchy, all nine of which are re-exported from `packages/client/src/index.ts`: `AuthenticationError`, `AuthorizationError`, `BadRequestError`, `NetworkError`, `NotFoundError`, `RateLimitError`, `RustrakError`, `ServerError`, `ValidationError`.

AD-3 declares `RustrakError` as a plain union type under the same name, and the spine nowhere states that the classes are removed. A builder faces an unanswerable question on file one: is the class kept alongside the type (impossible - same name, same export site), deprecated for a release, or deleted outright? And `err instanceof RustrakError` in five files across two packages becomes a type error the moment the name refers to a type.

**Fix:** state it explicitly in AD-3. Suggested: "the nine error classes are removed from `packages/client/src/index.ts` in the same release. `RustrakError` is re-declared as the union type described above; there is no deprecation window, and no class-shaped error survives in the public surface. `packages/mcp` and `apps/webview-ui` are updated in the same commit (F1.1)."

### F7.2 - There is no old-to-new mapping table - HIGH

A builder migrating call sites needs, and does not have:

| Today | Spine | Stated? |
| --- | --- | --- |
| `err.statusCode` | `error.status` | no |
| `err.retryable` | `isRetryable(error)` | named in the tree, never specified |
| `ValidationError` | `kind: 'invalid_response'` | implied by AD-3's prose, never mapped |
| `err.validationErrors: ZodError` | `issues: ZodIssue[]` | shape changes, unstated |
| `err.cause: Error` | `cause?: string` | stated in AD-3 |
| bare `RustrakError` (409, 422) | `kind: 'conflict'` / `'validation'` | stated |
| `NotFoundError` message | `kind: 'not_found'` message | see below |

`isRetryable` is the sharpest gap: it appears once, in the Structural Seed's `errors.ts` line, and is never defined. Which kinds are retryable? Does it agree with ky's internal retry config, which currently retries `[408, 500, 502, 503, 504]` **including on POST/PUT/PATCH/DELETE**? A consumer calling `isRetryable` and retrying has no way to know the client already retried twice.

Separately, the memlog found a live bug the spine does not mention: `NotFoundError`'s constructor does `super('Resource not found: ' + resource)` while `transformHttpError` passes the server's message as `resource`, so every 404 today reads "Resource not found: Project 42 not found". Under AD-3 that double prefix disappears, silently changing every 404 message consumers may be matching on. Worth one line.

**Fix:** put the table above into AD-3 or into the CHANGELOG spec (F7.5). Specify `isRetryable` (suggest: `network`, `rate_limited`, `server_error`) and state its relationship to ky's internal retry.

### F7.3 - The client's own test suite is never named - HIGH

`packages/client/tests/` holds 25 test files across `unit/` and `integration/` with MSW mocks and **85 `toThrow` assertions**. Every one of them inverts under AD-1. The spine's only mention of client tests is the Deferred line about realigning body-shape mocks - which is a small subset of the work and appears under an entry about `apps/server/src/error.rs`, where a builder will not look for it.

`packages/mcp` has a further 16 test files exercising `toMcpError`.

**Fix:** one line in AD-1: "`packages/client`'s 25 test files invert with the contract - `rejects.toThrow(X)` becomes `expect(result.success).toBe(false)` plus a `kind` assertion - and this is part of the same commit. `packages/mcp`'s 16 test files follow its `toMcpError` rewrite."

### F7.4 - Published documentation teaching the old API is never mentioned - HIGH

Two artifacts document the throwing API in detail:

- `apps/docs/content/sdks/client.mdx` lines 93-131: a section titled "Error Handling" opening "The client throws typed error classes instead of generic errors", a full `try`/`catch` + `instanceof` cascade example, and a nine-row table of error classes with HTTP codes and retryability.
- `packages/client/README.md` (243 lines), which ships **inside the npm tarball** (`"files": ["dist", "README.md"]`) and is therefore the first thing an external installer reads.

`docs` is in the `.changeset/config.json` fixed group, so it versions in lockstep and will publish `0.14.0` documentation describing the `0.13.0` API unless someone is told to change it. The spine's `scope` field names `packages/client`, `apps/webview-ui`, `packages/mcp` and the Rust error body - docs are excluded by omission, and no Deferred entry covers them.

**Fix:** add `apps/docs/content/sdks/client.mdx` and `packages/client/README.md` to `scope`, and state that the error-handling sections are rewritten in the same release. This is the highest-probability thing to be forgotten, because it is the only affected artifact that no compiler or test will complain about.

### F7.5 - No migration note is specified for external consumers - MEDIUM

`@rustrak/client` is `publishConfig.access: public` with a `homepage`, `keywords` and an npm audience. The only guidance the spine gives about the release is "the `Result` change is a `minor` changeset, never `major`, per the 0.x convention" - which is correct under the repo's 0.x policy and simultaneously means external installers get a **minor** bump that breaks every call site.

Under semver-for-0.x that is legitimate. It also makes the CHANGELOG entry the entire migration guide those users will ever see.

**Fix:** add to the Versioning row: "the changeset body carries the full old-to-new mapping (F7.2) and a before/after example, because a `minor` bump is the only signal external installers get for a total call-site break."

### F7.6 - The scope of "every public method" has unlisted edge cases - MEDIUM

AD-1 says "every public method on every resource". Four cases a builder will hit and cannot resolve from the spine:

- **`BaseResource.validate()`** (`resources/base.ts`) throws `ValidationError` from a `protected` helper used by all 20 resources. Converting it to return a `Result` changes every resource method's body, not just its signature. The Structural Seed's `packages/client/src/` tree shows `result.ts`, `errors.ts` and `resources/` and does not mention `base.ts` at all - the single file where the most mechanical change lands.
- **`auth.login`** returns `LoginResult` carrying raw `Set-Cookie` header strings, consumed by `lib/rustrak.ts`'s `applySetCookies(result.cookies)`. It becomes `result.data.cookies`, and the 46-line hand-rolled `parseSetCookie` sits behind it. Not hard, but it is the one method whose consumer contract changes shape rather than just wrapping.
- **The `RustrakClient` constructor.** AD-1 reserves `throw` for "malformed `baseUrl`" - i.e. the constructor still throws. Worth stating outright, since it is the single exception to "the client does not throw".
- **`health`** (the resource behind the `version` module) - in scope, trivially, but it is the one resource with no corresponding module name (F5.4).

**Fix:** add `base.ts` to the Structural Seed tree with a note that `validate()` returns `Result` rather than throwing, and add one sentence to AD-1 naming the constructor as the sole throwing surface.

---

## Summary of findings by severity

**Critical**
- F7.1 `RustrakError` name collision with the existing exported class hierarchy; no disposition stated.

**High**
- F1.1 Migration sequencing vs AD-9's empty-violation-set assertions is undecided.
- F1.2 `src/actions/` and `src/hooks/` have no stated disposition and survive every check.
- F1.3 Authorization for the 35 published action endpoints is not decided.
- F2.1 AD-4's no-`try/catch` rule is unenforced and unlisted, and `unstable_rethrow` was dropped.
- F2.2 AD-5's "Prevents" is not prevented: nothing forbids `'use server'` outside `features/*/actions.ts`.
- F3.1 Deferred `error.rs` leaves the 4xx message-safety contract unmade while mandating verbatim rendering.
- F4.1 Stack lists ky 1.14.3; the repo pins ky 2.0.2.
- F6.1 Observability silent; 5xx redaction destroys the message with no correlation handle.
- F6.2 Build/CI wiring understated: no `check-types`, `lint` or `format:check` for `apps/webview-ui`.
- F7.2 No old-to-new mapping table; `isRetryable` named but never specified.
- F7.3 `packages/client`'s 25 test files / 85 `toThrow` assertions never named.
- F7.4 Published docs and the npm-shipped README teaching the throwing API never named.

**Medium**
- F1.4 `toast.error(error.message)` unsafe for `invalid_response` and `network`.
- F1.5 No correlation handle survives redaction.
- F2.3 AD-2's no-class-instance rule unchecked, with the Zod `safeParse` analogy inviting the violation.
- F2.4 AD-6 half-checked; the six-component threshold and the no-`data.ts`-in-`app/` clause are unenforced.
- F2.5 AD-7's admission test is subjective and its `lib/` enumeration contradicts it.
- F2.6 Check (2)'s `ts-morph` project must come from `tsconfig.json`, and must parse TypeScript 6.
- F3.2 `packages/mcp` deferral understates an unmade `kind`-to-message decision.
- F3.3 Deferring `unstable_retry` leaves AD-4's failure path terminating at a broken retry button.
- F4.2 `ZodIssue` is deprecated in zod 4 and drags zod into the published type surface.
- F5.1 Existing `instanceof RustrakError` / `statusCode` call sites in `src/actions/` unacknowledged.
- F6.3 Docker / `output: 'standalone'` / knip impact of tests inside `src/` unaddressed.
- F6.4 `process.env` boundary omitted from check (6).
- F7.5 No migration note specified for external npm consumers.
- F7.6 `BaseResource.validate()`, `auth.login`, and the constructor exception unlisted.

**Low**
- F1.7 The `'server only'` typo in `lib/constants.ts` was dropped.
- F2.7 AD-5 calls the `server-only` guard a "compilation error"; it is a bundler build error.
- F2.8 AD-9's prove-it-can-fail fixtures leave no residue after removal.
- F2.9 AD-8's `router.refresh()` clause unchecked and unlisted.
- F4.3 `vitest 4.x` and `ts-morph latest` violate the spine's own exact-pinning convention.
- F4.4 `sonner` and `@hookform/resolvers` prescribed but absent from the Stack.
- F5.2 `router.refresh()` credited to 24 files; it is 28 call sites in 14 files.
- F5.3 The dual-body-shape parsing is described as pending; it is already implemented.
- F5.4 `health` -> `version` is the one unstated module remap.
- F6.7 Accessibility not named as out of scope.
