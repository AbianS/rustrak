# @rustrak/ui

The Rustrak component system. It implements `Rustrak Rediseno v5`: near-black
canvas, lime accent, Onest for what you read and IBM Plex Mono for what you
cross-check.

Nothing imports it yet. It is developed and reviewed in Storybook, and it is
consumed by `apps/dashboard` as the move off Next.js proceeds.

```bash
pnpm storybook    --filter=@rustrak/ui   # http://localhost:6008
pnpm test         --filter=@rustrak/ui   # unit + component tests in Chromium
pnpm check-types  --filter=@rustrak/ui
pnpm build        --filter=@rustrak/ui   # dist/ with ESM + types
```

## What holds it up

| Piece | Choice | Why |
|---|---|---|
| Primitives | [Base UI](https://base-ui.com) 1.7 | Stable since December 2025 and, since July 2026, shadcn/ui's default. `useRender` gives every component a polymorphic `render` prop without a `Slot` wrapper. |
| Styling | Tailwind 4.3 with `@theme` | Tokens are native CSS. Changing theme is rewriting variables, not recompiling. |
| Variants | `tailwind-variants` 3 | Slots, compound variants and `tailwind-merge` built in. `cva` would mean wiring the merge by hand in every multi-part component. |
| Icons | `lucide-react` behind an adapter | See below. |
| Tests | Storybook 10 + Vitest 4 in real Chromium | Every story is a component test and goes through axe. |
| Packaging | `tsdown` | ESM, types, `"use client"` in the banner, and every dependency external. |

The shadcn CLI was not used. Its idea was taken (the code lives in the
repository, and you can read and change it) but the components are written
against these tokens, not against theirs.

## The three rules

**1 · No loose values.** A component writes `bg-surface`, `h-control-md` or
`text-control`. Never `bg-[#16161a]`, `h-[34px]` or `text-[13px]`.

Tailwind's factory namespaces are **reset** (`--color-*: initial`, and the same
for `--text-*`, `--radius-*`, `--shadow-*`, `--font-*`). In this package
`bg-red-500` and `text-sm` do not exist: they compile to nothing. If a utility
is not in `styles/tokens.css`, it does not belong to the design.

**2 · Three token layers.**

```
--rk-lime: #c5f11e         primitive · the raw value, used by nobody
  └─ --surface-brand       semantic  · says what it is for; a theme rewrites it
       └─ --color-surface-brand   Tailwind · publishes the semantic as a utility
```

`lib/tokens.ts` mirrors the published names so `tailwind-merge` knows that
`text-control` is a size and `text-fg-muted` a colour; `lib/tokens.test.ts`
compares the two files and fails if they drift. It also fails if layer 3 ever
points at a `--rk-*` primitive directly, because that is the shortcut that would
make a second theme impossible.

**3 · State is read from the DOM.** Base UI hands out `data-pressed`,
`data-disabled` and friends. Recipes read them with variants; boxes read their
children with `has-*`. No state props to thread through, no two sources of truth
that can disagree.

## Hairlines are inset rings, not borders

The design contains **not one `border`**: every hairline is
`box-shadow: inset 0 0 0 1px`, which in Tailwind 4 is `inset-ring`.

That is not a stylistic tic. A real border joins the box and shifts content the
moment it appears on hover or focus, so a row of buttons visibly relayouts as
the pointer crosses it. An inset ring is painted on top and moves nothing.

It also composes: `focusRing` uses `ring`, drawn **outside** the box, so a
secondary button keeps its hairline while focused instead of trading one for the
other.

The single exception is the `dashed` button variant. `inset-ring` is a
box-shadow and takes no `border-style`, so that one uses a real border. It is
safe there because the variant never gains or loses the border, only recolours
it.

## Motion

Durations and curves are **IBM Carbon's** "productive" scale, the one meant for
dense work software. Material's was rejected: it is calibrated for consumer and
mobile apps, and its 225-375ms feels slow when you are working down a list of
issues toggling filters. This is an on-call tool. At three in the morning nobody
wants to watch an animation.

| Utility | Value | For |
|---|---|---|
| `duration-instant` | 70 ms | colour, hover, focus |
| `duration-fast` | 110 ms | press, tooltip |
| `duration-moderate` | 150 ms | an indicator that slides |
| `duration-slow` | 240 ms | panel, sidebar |
| `ease-standard` | `0.2,0,0.38,0.9` | changes without moving |
| `ease-entrance` / `ease-exit` | — | arrives braking / leaves accelerating |

Ready-made combinations live in `lib/motion.ts`: `interactiveTransition`,
`pressScale`, `pressScaleSmall`, `popTransition`. Milliseconds and
`cubic-bezier` are never written by hand, and `transition-all` is never used.

`prefers-reduced-motion` turns transitions and animations off globally, and the
`transform`-based press cancels itself so the change does not become a hard snap.

## The cursor

Tailwind 4 dropped `cursor: pointer` from buttons to match the browser. On a
desktop OS that makes sense, since the button already looks pressable from its
relief. In a flat dark interface like this one it does not: the hand is the
signal separating "this does something" from "this is a label".

`styles/base.css` puts it back, keyed on role rather than tag, because Base UI
draws the checkbox, the radio and the switch as a `<span>` carrying the role.
Disabled gets `not-allowed`.

## Icons go behind an adapter

Today it is lucide. Tomorrow it may not be, and swapping it should not touch
twenty components. Three layers:

```
components/icon/icon.tsx             the contract: IconComponent, sizes
components/icon/adapters/lucide.tsx  the only file importing lucide-react
components/icon/icon-catalog.ts      the product's names: ResolveIcon, IssueIcon
```

Components import from the catalog, never from the library. The name says what
the icon **means** (`resolve`, `reopen`, `issue`), not what it draws, so
changing the glyph does not force a change on anyone using it.

Size and stroke are imposed by the system in CSS, not passed as props to the
library: a CSS rule beats the `width`, `height` and `stroke-width` attributes
any library paints into the SVG, so the adapter does not depend on the library
accepting them.

## How the application consumes it

```tsx
import { Button } from '@rustrak/ui';
```

In `globals.css`:

```css
@import 'tailwindcss';
@import '@rustrak/ui/fonts.css';
@import '@rustrak/ui/styles.css';
@source '../../node_modules/@rustrak/ui/dist';
```

The `@source` is **not optional**: Tailwind only generates the utilities it can
see, and this package's classes live in its own bundle.

Fonts are served from the package rather than from Google Fonts, because Rustrak
is installed on other people's servers, sometimes with no route to the internet,
and the whole point of the migration is a binary that serves itself. Skip the
`fonts.css` import if the app already loads Onest and IBM Plex Mono itself.

The theme goes on `<html>`: `data-theme="dark"`.

## There is no light theme, and that is on purpose

`Rustrak Rediseno v5` is a dark design and only a dark design: there is not one
light screen in the file.

Inventing a light palette here would be work thrown away the day one is actually
decided, and it would not be a mechanical conversion either. **The lime accent
is roughly 1.4:1 on white**, so a light theme cannot reuse it as the action
colour. It needs a design decision (does the accent darken? does the primary
action become ink?), not a translation.

The architecture is ready for it. When the decision exists it is a thirty-line
block in `styles/tokens.css` and not one component changes. That is what the
three layers are for, and `tokens.test.ts` guards the property that makes it
true.

## What exists

**Foundations** · `cn`, `tv`, `focusRing`, tokens, the icon adapter and catalog.

**Actions** · `Button` (primary · secondary · ghost · danger · dashed, in three
sizes, with icon, menu chevron, loading and selected states).

That is all, deliberately. The system is being grown one component at a time
against real screens rather than scaffolded whole and then adjusted.

## Accessibility

Every story runs in a real Chromium and goes through axe, with a11y failures set
to `error` so they break the test rather than sit in a warning nobody reads.

What the system guarantees:

- visible focus on everything focusable, through the same 2px lime ring;
- unlabelled buttons **require** `aria-label` and the type checks it at compile
  time: `<Button icon={X} />` without a name does not get past `tsc`;
- `prefers-reduced-motion` turns transitions and animations off.

`color-contrast` is currently left to axe. Once the palette is used across more
than one component it should move to a dedicated `contrast.test.ts` that pins
the ratios, so a palette tweak shows up in the diff instead of passing unnoticed.
