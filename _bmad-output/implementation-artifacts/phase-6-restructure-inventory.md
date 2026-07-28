---
title: 'AD-10 phase 6: inventory for the features/ restructuring and the AD-9 rule suite'
type: 'inventory'
created: '2026-07-27'
baseline_commit: '81f50af'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-rustrak-2026-07-22/ARCHITECTURE-SPINE.md'
---

# Phase 6 inventory

Measured on `main` at `81f50af`, after the `Result` conversion landed. **The
spine's counts predate that work and no longer hold**: it says 85 action
exports of which 10 are dead, and those 10 were already deleted in phase 3b.
Everything below is counted from the tree as it stands.

Three independent axes. Each has its own classification rule, and the rules do
not always agree; where they conflict it is called out rather than resolved
silently.

---

## Axis 1: the 75 action exports

`src/actions/` holds 18 files and 75 exported functions. AD-6 deletes the
directory; every export moves to `features/<module>/data.ts` or
`features/<module>/actions.ts`. The test is **who initiates the call**, not
what the function does.

Classification was done by parsing real `import { … } from '@/actions/…'`
statements and checking whether the importing file opens with `'use client'`.
A first pass using a word-boundary regex was discarded: it counted
`redirect('/auth/login')` as a call to `login`, and it missed four exports
whose imports span multiple lines.

| Verdict | Count | Destination |
|---|---|---|
| Server-invoked only | 40 | `data.ts` |
| Client-invoked only | 34 | `actions.ts` |
| Both | 1 | see below |
| **Total** | **75** | |

This lands within one of the spine's own prediction (33 client / 40 server),
which is a useful check that the axis is being read the same way.

### The one function called from both sides

`team.listTeam` — read by `app/(main)/settings/team/page.tsx` (a Server
Component) and by `projects/[id]/settings/members/members-settings.tsx` (a
Client Component, to populate the add-member dropdown).

The spine sanctions the resolution in advance: the implementation stays in
`data.ts`, and `actions.ts` declares its own thin async function delegating to
it. **Not a re-export** — whether a re-export keeps its `'use server'`
semantics depends on which layer is looking, and the SWC transform and the
TypeScript plugin disagree, so the convention is held by rule (3) rather than
inferred from the compiler.

### Per-module split

| Module | → `data.ts` | → `actions.ts` |
|---|---|---|
| `agents` | 7 | 0 |
| `alerts` | 2 | 7 |
| `auth` | 2 | 3 |
| `events` | 3 | 0 |
| `invitations` | 1 | 2 |
| `issues` | 5 | 8 |
| `logs` | 1 | 0 |
| `members` | 1 | 2 |
| `projects` | 2 | 3 |
| `releases` | 1 | 0 |
| `server` | 1 | 0 |
| `sessions` | 4 | 0 |
| `stats` | 2 | 0 |
| `storage` | 2 | 4 |
| `team` | 1 (+`listTeam`) | 2 |
| `tokens` | 1 | 3 |
| `transactions` | 4 | 0 |
| `version-check` | 1 | 0 |

Seven modules are pure reads (`agents`, `events`, `logs`, `releases`, `server`,
`sessions`, `stats`, `transactions`, `version-check`) and will have a `data.ts`
with no `actions.ts` beside it. That is expected, not an omission: rule (1)
asserts every `actions.ts` opens with `'use server'`, never that one exists.

---

## Axis 2: the 57 colocated components

AD-6 keeps page-local components flat beside `page.tsx` **until a single route
directory exceeds six**, at which point that route gets a `_components/`.

Counted across `app/`, excluding the Next.js special filenames: **57
components in 27 route directories**. Only one directory is over the line:

| Directory | Components | Action |
|---|---|---|
| `projects/[id]/issues/[issueId]/events/[eventId]` | **11** | move to `_components/` |
| everything else | 1 to 4 | stays flat |

So the AD-6 work is far smaller than the raw count suggests: one folder is
created and eleven files move. The other 46 files stay exactly where they are.

### The one live naming violation

`app/(main)/settings/team/components/` — a private folder without the `_`
prefix, which rule (8) rejects. It is named in the spine as already-violating
and must be renamed to `_components/`. It holds 3 files.

### What still has to be decided per component

Whether a component is *route-private* or belongs to a **feature** is a
different question from where it currently sits, and this axis does not answer
it. AD-7's placement rule is by the type it renders: a component whose props
reference a domain type (`Issue`, `Project`, `ReleaseHealthRow`) lives in that
entity's feature however many routes consume it; one whose props are only
primitives and `ReactNode` is a primitive and lives in `src/components/`.
Applying that to all 57 is implementation work, not inventory.

---

## Axis 3: `src/lib/`, 17 files and 3290 lines

AD-7's admission test, applied per file: **does it run in a test runner with
nothing mocked?** Yes means derived logic, which belongs to a feature. No means
glue. Static data tables move to `src/content/` regardless.

### Static data → `src/content/` (1915 lines, 58% of `lib/`)

| File | Lines |
|---|---|
| `platform-snippets.ts` | 1398 |
| `platforms.ts` | 517 |

These two are the reason AD-7 exists: a 1370-line table of SDK snippets sitting
beside ported Sentry algorithms, with nothing distinguishing them.

### Derived logic → its feature

| File | Lines | Feature |
|---|---|---|
| `format-stack-trace.ts` | 215 | `events` |
| `event-schema.ts` | 186 | `events` |
| `breadcrumbs.ts` | 23 | `events` |
| `session-health.ts` | 85 | `sessions` |
| `issue-status.ts` | 71 | `issues` |
| `version.ts` | 62 | `version-check` |
| `project-fields.ts` | 51 | `projects` |
| `chart-format.ts` | 43 | undecided, see below |

### Glue → stays in `lib/`

`rustrak.ts` (176), `results.ts` (69), `clipboard.ts` (39), `utils.ts` (24),
`constants.ts` (5).

### Two files where AD-7's own two rules disagree

`form-errors.ts` (213) and `error-copy.ts` (113) are **pure functions that run
in a test runner with nothing mocked**, so the admission test says "derived
logic, move to a feature". But AD-7 also says `lib/` retains "genuinely
cross-feature, non-domain helpers", and these two are exactly that: every form
in the app uses `form-errors`, every failure surface uses `error-copy`, and
neither knows anything about issues, projects or releases. They are about
*errors*, which is not an entity.

Moving them into a feature would force every other feature to import from it,
which AD-10's sibling rule forbids. Leaving them in `lib/` contradicts the
admission test as literally written.

**This needs deciding in the spec, not during implementation.** The same
question applies to `chart-format.ts`, and probably to `clipboard.ts`.

---

## The AD-9 rule suite: 11 rules, three mechanisms

The spine enumerates **eleven** checks, not nine. Assignment:

| Mechanism | Rules | Why |
|---|---|---|
| `archunit` | (5), (6) | import-graph reachability |
| TypeScript compiler API | (2) | needs the type checker; the load-bearing rule |
| `node:fs` walks | (8) | tree-shaped, not per-file |
| either | (1), (3), (4), (7), (9), (10), (11) | plain content predicates |

Rule (2) — every exported value in `features/*/actions.ts` returns something
assignable to `Promise<Result<unknown, RustrakError>>` — is the one that
catches a function that still throws, because a throwing function has the wrong
inferred return type. It uses the project's own `typescript`, deliberately not
`ts-morph`, to avoid a second TypeScript version in the repo.

### Ordering constraint

Rules **2, 6, 7 and 9 cannot be written before the restructuring lands**: with
no `features/` directory their population is zero and they pass vacuously,
which is precisely the failure AD-9 exists to prevent. Rules 1, 3, 4, 5, 8, 10
and 11 can be written first and will fail honestly against today's tree, which
makes them a usable worklist.

### Two archunit defects to mitigate, both verified in its shipped 2.3.3 source

- `FileInfo.name` strips only the **last** extension, so `name.endsWith('.test.ts')` is never true and any rule written that way passes vacuously forever.
- `allowEmptyTests` misfires on negative dependency rules: it fails by default when nothing imports the target, which is the healthy state. It has to be turned off on exactly the rules that matter most.

AD-9's population floor is the mitigation for both, and is mandatory on every
rule whatever the mechanism. archunit also bundles TypeScript 5.9.3 while this
repo builds with 6.0.3, so a rule matching fewer files than its floor should be
read as a parse failure rather than a clean pass.

---

## Verification baseline

`pnpm run ci` is green at `81f50af`: 21/21. Any red during this phase is
introduced by it, unlike phase 3b which began from a deliberately broken tree.

`webview-ui` currently has 104 tests across 11 files, none of which is an
architecture rule.
