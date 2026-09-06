# Rustrak Dashboard

Next.js App Router, Server Components by default, Client Components only where
something is interactive. Tailwind, Base UI and shadcn/ui, next-intl for `en`
and `zh`. Root context: `/CLAUDE.md`.

The code is organised by **domain, not by technical type**, following a reduced
[Feature-Sliced Design](https://feature-sliced.design). There is no
`components/`, `hooks/`, `actions/` or `lib/` at the root of `src/`. They were
removed deliberately. Read this file before adding one back.

## Three layers

A layer imports only from layers strictly below it, never upward.

```
src/
├── app/          routing and composition. Next lives here and nowhere else.
│   └── <route>/
│       ├── page.tsx        and the other Next special files
│       └── _components/    everything else, unconditionally
├── features/     the domain, one slice per business concept
│   └── <slice>/
│       ├── ui/components/  components whose props name a domain type
│       ├── ui/hooks/
│       ├── api/queries.ts   reads,  import 'server-only'
│       ├── api/mutations.ts writes, 'use server'
│       ├── model/          types and domain logic. No React, no Next.
│       └── lib/            derived logic. No React, no Next.
└── shared/       no slices, segments directly
    ├── ui/components/  primitives, with shadcn output under components/shadcn/
    ├── ui/hooks/
    ├── lib/            pure helpers
    ├── api/            client construction and the cookie adapter
    ├── i18n/           next-intl wiring, messages/ underneath
    └── config/         constants and static tables
```

`i18n` is a segment of `shared`, not a fourth root folder. As `src/i18n/` it sat
outside all three layers and therefore outside every rule that governs them.

The slices come from the resources `@rustrak/client` exposes and the routes that
consume them. The non-obvious groupings carry the reasoning: `project` absorbs
stats, because stats are aggregates *of a project*; `release` absorbs sessions,
because release health *is* sessions grouped by release; `user` absorbs auth,
team, members and invitations, because all four are people and their access.

## Where does this file go?

| What you have | Where |
|---|---|
| Props name one domain type | `features/<that>/ui/components/` |
| Props name several features | composition, `app/**/_components/` |
| Props are only primitives or `ReactNode` | `shared/ui/components/` |
| A hook about one domain | `features/<that>/ui/hooks/` |
| Pure logic about one domain | `features/<that>/model/` or `lib/` |
| A read from a Server Component | `features/<that>/api/queries.ts` |
| A mutation called from the browser | `features/<that>/api/mutations.ts` |
| A type two features both need | **down** into `shared`, never sideways |
| A new user-facing sentence | `shared/i18n/messages/en.json` **and** `zh.json` |
| A date, a number, a percentage | nowhere: format at the call site |

Decide by the type it renders, not by who imports it. A component used on five
routes still belongs to the feature whose type it names.

## Rules the CI enforces

`src/__tests__/architecture/` holds rule files written on
[archunit](https://github.com/lukasniessen/archunitts). They run in `pnpm test`
and cover layer direction, slice isolation, `'use server'` placement, folder
shape, barrel files, locale completeness and the client `Result` shape.

**Read the rule before working around it.** Each file documents what it protects
and why it exists.

## Conventions

- No date or number formatting library. Everything goes through next-intl's
  `useFormatter` / `getFormatter`.
- Locale is resolved per reader, never from the URL.
- shadcn output is CLI output. Compose from outside instead of editing it.
- Prefer solving it in the event handler before reaching for an effect.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
