---
title: 'AD-10 phase 6: a feature-sliced architecture for apps/webview-ui, with a portable core'
type: 'refactor'
created: '2026-07-27'
status: 'draft'
baseline_commit: '81f50af'
review_loop_iteration: 0
supersedes: 'spec-ad10-p6-features-and-rules.md'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-rustrak-2026-07-22/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/phase-6-restructure-inventory.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** the dashboard is organised by technical type, not by domain. `lib/`
holds a 1398-line SDK snippet table beside a ported Sentry algorithm. 57
components sit beside their `page.tsx` with no rule. `hooks/` groups files by
what they are rather than what they are about. The `data.ts`/`actions.ts` split
delivered earlier in this phase divides code by **coupling to Next**, not by
meaning: it separates "what a Server Component calls" from "what the browser
calls", a boundary that means nothing if the framework changes.

Nothing in the tree answers: where does a component for this domain live, where
do generic ones live, what is allowed to depend on what.

**Approach:** adopt a reduced [Feature-Sliced Design](https://feature-sliced.design)
— slices by domain, segments by purpose, and one hard dependency rule — with two
deliberate departures from the standard, both recorded below.

**The goal is not a tidier tree. It is a portable core.** Measured on this
codebase: 90 of 189 files already import nothing from `next/*`, and another 44
touch only `next/link` and `next/navigation`, which any framework replaces with
a shim. This phase makes that 71% a property the CI enforces rather than an
accident.

## Decision: the portable boundary sits between `app/` and `src/`

Two options were measured before choosing.

**Rejected — full framework independence.** Making the remaining 55
structurally-coupled files portable means moving reads to the browser. That is
not a frontend refactor for Rustrak:

- `apps/server` serves `Cors::default().allow_any_origin()` **without**
  `supports_credentials()`. With `Access-Control-Allow-Origin: *` a browser
  refuses to send credentials, so the session cookie would never arrive. That
  configuration is deliberate and commented: Sentry SDKs post from any origin.
- `RUSTRAK_API_URL` is server-side by design, and `project-context.md` states
  the rule in capitals: never expose it to the browser.

So the cost is a changed deployment model and a weakened CORS posture on
endpoints that are open on purpose, to buy portability for 55 files. Rejected on
evidence, not taste.

**Chosen — a clean core with a coupled edge.** `app/` owns routing and
composition and may use anything Next offers. `src/features/*/model`,
`src/features/*/lib` and `src/shared/lib` may not import `next/*` at all, and a
rule enforces it. A framework migration rewrites composition and keeps the
domain.

`@rustrak/client` is already the framework-agnostic data layer this normally
requires building by hand: a separate published package, Zod schemas, `Result`,
no React. The work here is to stop burying it.

## Decision: two departures from Feature-Sliced Design

**No `pages` layer.** FSD puts page composition in `src/pages/` so it is not
trapped in the framework's routing folder — that is, for portability. This spec
already concedes that pages are not portable, so the layer would be indirection
with no payoff: a file that re-exports another. Composition lives in `app/`,
where the route already is.

**`features` rather than `entities`.** FSD separates `entities` (nouns) from
`features` (verbs) so the two do not mix. With a single domain layer the
distinction costs more than it earns at this size, and `features/` is the name
every React codebase and the existing spine already use. **The known cost:** the
day a slice is genuinely an action rather than a thing, it will sit beside the
nouns and the layer will hold both natures. Revisit then.

## Decision: no barrel files

FSD gives each slice an `index.ts` as its public surface, so internals stay
rearrangeable. **Rustrak does not do this**, and the reason is not taste.

It was tried on the `issue` pilot and **the build failed with 11 errors**. A
barrel that re-exports both `api/queries.ts` (`import 'server-only'`) and
`ui/issues-list.tsx` (`'use client'`) drags the server-only poison pill into
every client component that imports anything from the slice. The two entry
points a barrel would need — one client-safe, one server-only — is two barrels,
which is worse than none.

The generic case against barrels holds too: they defeat tree-shaking, invite
import cycles, and make a bundler resolve a whole slice to fetch one component.

**What replaces the guarantee:** the segment is the boundary, not the file.
`features/issue/ui/…` is public by convention, and the sibling rule below is
what actually keeps slices apart. The cost, stated plainly: internals are no
longer private, so renaming a file inside a slice touches its importers.
Accepted deliberately.

## The shape

```
apps/webview-ui/
├── app/                         routing + composition. Next lives here.
│   └── (main)/projects/[id]/
│       ├── page.tsx
│       └── _components/         everything that is not a Next special file
└── src/
    ├── features/                the domain, one slice per business concept
    │   └── issue/
    │       ├── ui/              components whose props name a domain type
    │       ├── api/             the only place that calls @rustrak/client
    │       ├── model/           types, status logic. No React, no Next.
    │       └── lib/             derived logic and hooks for this domain
    │                            (no index.ts — imports name the file)
    └── shared/                  no slices, segments directly
        ├── ui/                  the shadcn kit
        ├── lib/                 cn, clipboard, chart formatting
        ├── api/                 client construction + the cookie adapter
        └── config/              constants, platform tables
```

## Boundaries & Constraints

**Always:**
- **A layer imports only from layers strictly below it.** `app/` → `features/` →
  `shared/`. Never upward.
- **A slice never imports a sibling slice.** If a screen needs two features, the
  *page* composes them. This is what stops the graph becoming a web.
- **No barrel files. Ever.** Every import names the file it wants:
  `@/features/issue/ui/issues-list`, never `@/features/issue`. See the decision
  above; this one is not negotiable and is not a style preference.
- **A component's home is decided by the type it renders**, not by who imports
  it. Props naming a domain type (`Issue`, `Project`, `ReleaseHealthRow`) means
  it belongs to that feature, however many routes use it. Props of only
  primitives and `ReactNode` mean it is a primitive and belongs in `shared/ui`.
  Props naming *several* features mean it is composition and belongs to the page.
- **Everything under `app/` that is not a Next special file lives in
  `_components/`.** Unconditional, with no size threshold: a threshold is a
  judgement call and judgement calls rot.
- `'use server'` and `import 'server-only'` appear only in `api` segments and in
  `app/`.

**Ask First:**
- Any change to `packages/client` or `apps/server`.
- Any dependency beyond `archunit`.
- Splitting `features` into `entities` + `features`, or reinstating a `pages`
  layer. Both were considered and declined above; reversing either is
  renegotiating this spec.

**Never:**
- `features/*/model`, `features/*/lib` and `shared/lib` do not import `next/*`.
  **This is the rule that protects the portability the phase exists to buy.**
- No `hooks/` directory. A hook belongs to the slice it serves, or to
  `shared/lib` if it is domain-free.
- No `lib/` at `src/` root.
- Do not weaken or delete a test to go green.

## The ten features

Derived from the 20 resources `@rustrak/client` exposes and the 28 routes, not
invented. The non-obvious groupings are the point:

| Feature | Absorbs | Why |
|---|---|---|
| `project` | projects, stats | `stats` are aggregates *of a project*, not a concept of their own |
| `issue` | issues | |
| `event` | events | |
| `release` | releases, sessions | "release health" *is* sessions grouped by release |
| `transaction` | transactions | |
| `agent-trace` | agents | shares `span` with `transaction`; the shared type lives in `shared` |
| `log` | logs | |
| `user` | auth, team, members, invitations | all four are people and their access |
| `alert` | alertRules, alertIntegrations | a rule without an integration does nothing |
| `token` | tokens | |

**Deliberately not features:** `storage` and `health` are maintenance
operations, not nouns a user manipulates; they belong to their page. `spans` is
a shared type, not a slice.

Eighteen flat modules become ten features, because several were the same concept
seen from a different angle.

## I/O & Edge-Case Matrix

| Scenario | Behaviour |
|---|---|
| A component renders one domain type | `features/<that>/ui/` |
| A component renders several features | composition; `app/**/_components/` |
| A component renders only primitives | `shared/ui/` |
| A hook is about one domain | `features/<that>/lib/` |
| A hook is domain-free | `shared/lib/` |
| Two features need the same type | the type moves to `shared`; the slices stay unaware of each other |
| A page needs two features | the page imports both; neither imports the other |
| Static data table | `shared/config/` |
| A read from a Server Component | `features/*/api`, called directly, never through `'use server'` |
| A mutation from the browser | `features/*/api` with `'use server'`, then `router.refresh()` |

</frozen-after-approval>

## What this changes in the spine

AD-6, AD-7 and AD-8 describe the structure this spec replaces, so they are
rewritten rather than reinterpreted. This is the "Ask First" item the previous
spec named, and it is being asked:

- **AD-6** (`src/app/` is routes and composition only) — survives in spirit; its
  six-component threshold is replaced by the unconditional `_components/` rule.
- **AD-7** (derived logic in its feature, static data not in `lib/`) — survives,
  and gains the segment vocabulary (`ui`/`api`/`model`/`lib`/`config`) it was
  missing. Its admission test is clarified as necessary but not sufficient.
- **AD-8** (reads go straight to the source from Server Components) — survives
  unchanged. It is the reason `api` segments exist.
- **New AD needed:** the layer and sibling import rules, and the portable-core
  prohibition on `next/*`. These are the load-bearing constraints and the spine
  currently states none of them.

## Tasks & Acceptance

**Execution, in order. Each is its own commit.**

- [ ] Write the rules that have a real population today: layer direction, sibling isolation, `_components/` placement, and the `next/*` prohibition on the portable core. They fail; the failures are the worklist.
- [ ] `shared/`: move the shadcn kit to `shared/ui`, `rustrak.ts` to `shared/api`, the generic helpers to `shared/lib`, and the static tables to `shared/config`. Delete `src/lib/`.
- [ ] Create the ten slices with their `api` segments, folding the 27 `data.ts`/`actions.ts` files into them. Delete `src/features/*/data.ts` and `actions.ts` as a concept.
- [ ] Move domain components into their feature's `ui`. The 11 under `events/[eventId]` go to `features/event/ui`; expect the same shape for `agents` (4) and `projects` (3).
- [ ] Move domain logic into `model` and `lib` segments: `issue-status` to `issue/model`, `format-stack-trace` and `event-schema` to `event/lib`, `session-health` to `release/model`.
- [ ] Dissolve `hooks/`.
- [ ] Put whatever remains under `app/` into `_components/`.
- [ ] Rewrite AD-6, AD-7 and add the new AD to the spine.

**Acceptance Criteria:**
- Given `pnpm run ci`, then it exits 0.
- Given `grep -rn "from 'next" apps/webview-ui/src/features/*/model apps/webview-ui/src/features/*/lib apps/webview-ui/src/shared/lib`, then there are no hits.
- Given any two slices, then neither imports the other.
- Given `grep -rn "from '@/features/[a-z-]*'" apps/webview-ui/src`, then there are no hits: every import names a file, never a slice root.
- Given `ls apps/webview-ui/src`, then it contains exactly `features`, `shared` and `__tests__`.
- Given any `.tsx` under `app/` that is not a Next special file, then it sits in a `_components/` folder.
- Given every rule, then it has a committed population floor that is a specific number and a recorded observation of it failing.

## Design Notes

The rules come first for the same reason as before: they turn the move into a
red-to-green exercise with a machine-checked definition of done, instead of a
judgement about whether enough files have moved.

`shared/` moves first among the file moves, because everything else imports it
and doing it last means touching every import twice.

The one genuinely hard judgement is the component placement, and it is hard in
exactly one direction: a component that *looks* domain-owned but composes two
features. `overview-tiles.tsx` is the clearest case — it reads stats, sessions,
issues and transactions, so no slice may own it and it stays with its page. When
in doubt, read the props.

## Verification

**Commands:**
- `pnpm --filter=webview-ui test`, `lint`, `format:check`, `check-types`, `build` — exit 0 each.
- `pnpm run ci` — exit 0.

**Manual checks:**
- Load the project overview and confirm the tiles still stream independently.
- Trigger one mutation from a client component and confirm `router.refresh()` still reflects it.
