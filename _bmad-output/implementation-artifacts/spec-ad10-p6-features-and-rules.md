---
title: '[SUPERSEDED by spec-ad10-p6-feature-architecture.md] AD-10 phase 6: restructure apps/webview-ui into features/, and land the AD-9 rule suite'
type: 'refactor'
created: '2026-07-27'
status: 'superseded'
baseline_commit: '81f50af'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-rustrak-2026-07-22/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/phase-6-restructure-inventory.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** the dashboard has no enforced structure. 75 action exports sit in
one flat `src/actions/` regardless of who calls them, so a Server Component
reads through a Server Action — and Next.js dispatches those one at a time per
client, so reads are serialised for no reason. 57 components sit beside their
`page.tsx` with no stated rule for when that stops being acceptable. `src/lib/`
holds 3290 lines in which a 1398-line table of SDK snippets is indistinguishable
from a 215-line ported Sentry algorithm. None of AD-6, AD-7 or AD-8 is checked
by anything, so all three are currently documentation.

**Approach:** move the tree to `features/*/{data,actions}.ts` in one pass, then
write the eleven AD-9 rules that hold it there. The two halves ship together
because neither is worth much alone: a restructure nothing enforces decays, and
a rule suite with no `features/` to match passes vacuously.

**This phase is atomic by construction.** A half-populated `features/`, with
some reads on `'use server'` and some on `import 'server-only'`, builds green
and looks fine — the failure mode is not breakage, it is a codebase with two
conventions and no way to tell which one a file follows. That is strictly worse
than not starting.

## Boundaries & Constraints

**Always:**
- Follow `phase-6-restructure-inventory.md`. It classifies all 75 exports by who
  initiates the call, both from parsed import statements rather than a text
  search. Verify a site before moving it, but do not re-derive the axis.
- **Every AD-9 rule asserts two things**: that the matched population meets a
  floor committed as a specific number, and that the violation set is empty. A
  floor of `> 0` is itself vacuous — it passes when a glob typo matches one file
  out of eighty.
- **Every rule is seen to fail before it is trusted.** Add a deliberate
  violating fixture, watch the suite go red with a legible message, remove the
  fixture. A rule that has never failed is not delivered.
- **A rule is written when its population is real, and not before.** Measured on
  this tree: (1), (2), (3), (4), (5) and (11a) all match zero files today
  because they are predicates over `features/*/`, so writing them now would
  produce six rules that pass by matching nothing. (6) has a real population of
  75 but its *allowed set* names `features/`, so it is stated after the move
  too. The migration review's grouping of "2, 6, 7, 9 after" was written against
  an earlier phase numbering and does not survive contact with the counts: (7)
  and (9) are writable today.
- `listTeam` keeps its implementation in `data.ts`; `actions.ts` declares its
  own thin async function that delegates. Not a re-export — the SWC transform
  and the TypeScript plugin disagree about whether a re-export keeps its
  `'use server'` semantics.
- `actions.ts` may import `data.ts`. The reverse is forbidden.

**Ask First:**
- Any change to `packages/client` or `apps/server`.
- Amending an AD in the spine. If the restructure proves an AD wrong, that is a
  finding to report, not a rule to quietly bend.
- Any dependency beyond `archunit`, which AD-9 already names and which this
  phase is authorised to add, pinned exactly per repo policy.

**Never:**
- No `_`-prefixed folder at the bare `app/` root; the root route uses a route
  group instead.
- No `'use server'` anywhere outside `features/*/actions.ts`.
- Do not write a rule whose population cannot be asserted. Leave the concern
  unchecked and say so in Consistency Conventions instead.
- Do not weaken or delete a test to go green.
- Do not begin the AD-6 component moves and the `lib/` split in the same commit
  as the `actions/` redistribution. Three separable moves, three commits.

## Decision: rule (11b) is knowingly unchecked

AD-9 rule (11)'s second clause — every `try`/`catch` outside `data.ts` and
`actions.ts` opens with `unstable_rethrow` — was written, seen to fail against
five real sites, and then **dropped**. It is recorded here rather than left as a
silent omission, because AD-9 sanctions leaving a concern unchecked and does
not sanction pretending it is covered.

The concern is real. `redirect()` and `notFound()` signal by throwing, and
`unstable_rethrow` (verified in `next@16.2.10`) rethrows only Next's own router
and CSR-bailout errors, walking the `cause` chain, and no-ops on everything
else. A `catch` without it silently eats a navigation: the page does not move,
nothing is logged, and the code reads as correct.

What made it not worth enforcing **now**: none of the five sites can currently
throw one. They are a `JSON.parse`, a `new URL()` inside a Zod refine, two
`localStorage` reads and a `fetch` to GitHub Pages — no `redirect()` or
`notFound()` inside any of those `try` blocks. So blanket compliance bought no
fix, and it charged a real price: `lib/clipboard.ts`, a pure browser utility,
would import a Next navigation API to guard against a navigation it cannot
perform.

The alternative considered and rejected was scoping the rule to files that
plausibly navigate. That trades a mechanical rule for a maintained boundary,
and maintained boundaries rot.

**Revisit when** a `redirect()` or `notFound()` first appears inside a `try`.
At that point the rule is worth its cost, and it can be written scoped to the
population that has one.

## Decision: `form-errors.ts` and `error-copy.ts` stay in `lib/`

The inventory found AD-7's two rules disagreeing. Both files pass the admission
test — pure functions, no mocks — which says "move to a feature". Both are also
"genuinely cross-feature, non-domain helpers", which says "stay".

**They stay**, and AD-7's wording is sharpened in the same commit so this is not
re-litigated: the admission test is *necessary but not sufficient*. Passing it
makes a file a candidate for a feature; it moves only if it also belongs to a
**domain**. `form-errors` and `error-copy` belong to no entity — they are about
failure, which is not an entity — and every form and every failure surface in
the app uses them. Moving either into a feature would force every other feature
to import from it, which AD-10's sibling rule forbids.

The same reasoning keeps `chart-format.ts` (presentation formatting, used by
tiles across three features) and `clipboard.ts` (browser glue) in `lib/`.

## I/O & Edge-Case Matrix

| Scenario | Behaviour |
|---|---|
| A read is needed by a Server Component | plain async call into `features/*/data.ts`; never through `'use server'` |
| A mutation is initiated in the browser | `features/*/actions.ts`, then `router.refresh()` |
| A function is needed by both | implementation in `data.ts`, thin delegate in `actions.ts` |
| A route directory reaches 7 colocated components | that route gains `_components/` |
| A component's props name a domain type | it lives in that entity's feature, however many routes use it |
| A component's props are only primitives and `ReactNode` | it is a primitive and lives in `src/components/` |
| A rule matches fewer files than its floor | treated as a parse failure, not a pass |
| A rule cannot assert its population | not written; recorded as knowingly unchecked |

</frozen-after-approval>

## Code Map

- `phase-6-restructure-inventory.md` — the authority on the three axes.
- `src/actions/*.ts` — 18 files, 75 exports, deleted by the end of this phase.
- `app/(main)/projects/[id]/issues/[issueId]/events/[eventId]/` — 11 colocated components, the only directory over the AD-6 threshold.
- `app/(main)/settings/team/components/` — the live rule (8) violation: a private folder with no `_` prefix.
- `src/lib/platform-snippets.ts` (1398) and `src/lib/platforms.ts` (517) — static data, to `src/content/`.
- `src/__tests__/architecture/` — does not exist yet; one file per concern.

## Tasks & Acceptance

**Execution, in order:**
- [ ] Write the five rules whose population is real today: **(7), (8), (9) and (10)**. They fail against the current tree, and those failures are the worklist for everything below. Each gets its population floor and its proven-failing fixture now.
- [ ] Rename `app/(main)/settings/team/components/` to `_components/`, closing the one violation rule (8) already names.
- [ ] Redistribute the 75 exports into `features/*/{data,actions}.ts` per the inventory. `data.ts` opens with `import 'server-only'`; `actions.ts` opens with `'use server'`. Delete `src/actions/`.
- [ ] Move the 11 components under `events/[eventId]/` into that route's `_components/`. Leave the other 46 where they are.
- [ ] Split `src/lib/`: static data to `src/content/`, derived logic to its feature, glue stays. Apply the decision above verbatim.
- [ ] Place components by the type they render, per AD-7, for the set the inventory deliberately left to implementation.
- [ ] Write the six rules that were vacuous before the move: **(1), (2), (3), (4), (5), (11a)**, plus **(6)**, whose allowed set is defined in terms of `features/` and therefore has to be stated once the directory exists. Rule (2) uses the project's own `typescript`, not `ts-morph`.
- [ ] Sharpen AD-7 in the spine to record that the admission test is necessary but not sufficient.
- [ ] Update the Consistency Conventions row with the final rule-to-mechanism assignment and anything knowingly left unchecked.

**Acceptance Criteria:**
- Given `pnpm run ci`, then it exits 0.
- Given `grep -rn "'use server'" apps/webview-ui/src`, then every hit is a `features/*/actions.ts`.
- Given `ls apps/webview-ui/src/actions`, then it does not exist.
- Given each of the 11 rules, then it has a committed population floor that is a specific number, and a recorded observation of it failing against a deliberate fixture.
- Given `grep -rn "from '@rustrak/client'" apps/webview-ui/src`, then every non-type import is in `lib/rustrak.ts`, a `data.ts` or an `actions.ts`.
- Given a Server Component, then it reaches its data without crossing a `'use server'` boundary.

## Design Notes

Order matters, and it is the opposite of the intuitive one. Writing the seven
writable rules **first** turns the restructure into a red-to-green exercise with
a machine-checked definition of done, instead of a judgement call about whether
enough files have moved. It also proves each rule can fail while there is
something real for it to fail against, which is exactly what AD-9 asks for and
what is hard to fake later once the tree is clean.

The three moves are separable and must stay in separate commits. The exports
redistribution is the risky one — it changes how every page fetches. The
component moves and the `lib/` split are pure file motion with no behaviour
change, and mixing them into the same commit is what makes a diff unreviewable.

Two archunit defects are known and mitigated rather than assumed away, both
verified in its shipped 2.3.3 source: `FileInfo.name` strips only the last
extension, and `allowEmptyTests` fails by default on negative dependency rules
when nothing imports the target, which is the healthy state. The population
floor covers both. archunit also bundles TypeScript 5.9.3 against this repo's
6.0.3, so a rule quietly matching fewer files than expected should be read as a
parse failure.

## Verification

**Commands:**
- `pnpm --filter=webview-ui test`, `lint`, `format:check`, `check-types`, `build` — exit 0 each.
- `pnpm run ci` — exit 0.

**Manual checks:**
- Load a project overview and confirm its tiles still stream independently; the reads moved off Server Actions, which were serialised, so this should not have got slower.
- Trigger one mutation from a client component and confirm `router.refresh()` still reflects it.
