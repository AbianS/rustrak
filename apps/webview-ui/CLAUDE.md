# Rustrak WebView UI - Technical Context

> **Context Note**: This is the **frontend-specific context** for Rustrak.
> - Root context: `/CLAUDE.md`
> - Server API: `apps/server/CLAUDE.md`
> - Client Package: `packages/client/CLAUDE.md`

## Overview

Next.js 16 dashboard for the Rustrak error tracking system. App Router, Server
Components by default, Client Components only where something is interactive.

The code is organised by **domain**, not by technical type, following a reduced
[Feature-Sliced Design](https://feature-sliced.design). If you are looking for a
`components/`, `hooks/`, `actions/` or `lib/` folder at the root of `src/`, they
were deleted on purpose. See "Architecture" below before adding a file.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5.9 (strict mode)
- **Styling**: Tailwind CSS 4.3
- **UI Components**: Base UI + shadcn/ui
- **Theme**: next-themes (dark/light/system)
- **i18n**: next-intl 4 (`en`, `zh`), resolved per reader, **not** from the URL
- **Icons**: Lucide React
- **API Client**: `@rustrak/client` (workspace package)
- **Architecture tests**: [archunit](https://github.com/lukasniessen/archunitts)

There is no date or number formatting library. Dates, relative times, numbers
and percentages all go through next-intl's `useFormatter` / `getFormatter`; see
"Internationalisation" below.

## Architecture

Three layers. **A layer imports only from layers strictly below it, never
upward.** This is enforced, not merely documented.

```
apps/webview-ui/
├── components.json              shadcn CLI config; its aliases point into shared/
└── src/
    ├── app/                     routing + composition. Next lives here.
    │   └── <route>/
    │       ├── page.tsx         and the other Next special files
    │       └── _components/     everything else, unconditionally
    ├── features/                the domain, one slice per business concept
    │   └── <slice>/
    │       ├── ui/
    │       │   ├── components/  components whose props name a domain type
    │       │   └── hooks/       (when one exists)
    │       ├── api/             the only place that calls @rustrak/client
    │       │   ├── queries.ts   reads      -> import 'server-only'
    │       │   └── mutations.ts writes     -> 'use server'
    │       ├── model/           types and domain logic. No React, no Next.
    │       └── lib/             derived logic. No React, no Next.
    └── shared/                  no slices, segments directly
        ├── ui/
        │   ├── components/      primitives, and shadcn/ under components/shadcn/
        │   └── hooks/
        ├── lib/                 pure helpers: cn, clipboard, arithmetic
        ├── api/                 client construction + the cookie adapter
        ├── i18n/                next-intl wiring, and messages/ under it
        └── config/              constants and static tables
```

`i18n` is a segment of `shared`, not a fourth thing at the root of `src`. It
was written as `src/i18n/` first, which put it outside all three layers and
therefore outside every rule that governs them -- a shared component imported
from it and no rule could see the edge. Under `shared/` it is covered by
`layer-direction` for free.

### The eleven features

Derived from the resources `@rustrak/client` exposes and the routes that consume
them, not invented. The non-obvious groupings are the point:

| Feature | Absorbs | Why |
|---|---|---|
| `project` | projects, stats | stats are aggregates *of a project*, not a concept of their own |
| `issue` | issues | |
| `event` | events | |
| `release` | releases, sessions | "release health" *is* sessions grouped by release |
| `transaction` | transactions, spans | the spans embedded in a transaction payload |
| `agent-trace` | agents, span rows | reads the `spans` table; a different type to `transaction`'s |
| `log` | logs | |
| `user` | auth, team, members, invitations | all four are people and their access |
| `alert` | alertRules, alertIntegrations | a rule without an integration does nothing |
| `token` | tokens | |
| `storage` | storage, source maps | |

### Where does this file go?

| What you have | Where it goes |
|---|---|
| A component whose props name one domain type | `features/<that>/ui/components/` |
| A component whose props name several features | composition: `app/**/_components/` |
| A component whose props are only primitives / `ReactNode` | `shared/ui/components/` |
| A hook about one domain | `features/<that>/ui/hooks/` |
| A hook with no domain | `shared/ui/hooks/` |
| Pure logic about one domain | `features/<that>/model/` or `lib/` |
| A static data table | `shared/config/` |
| A read called from a Server Component | `features/<that>/api/queries.ts` |
| A mutation called from the browser | `features/<that>/api/mutations.ts` |
| A type two features both need | it moves **down** into `shared`, never sideways |
| A new user-facing sentence | `shared/i18n/messages/en.json` **and** `zh.json` |
| A date, a number, a percentage | nowhere: format it at the call site through `useFormatter` |

**Decide by the type it renders, not by who imports it.** A component used by
five routes still belongs to the feature whose type it names.

## Rules the CI enforces

`src/__tests__/architecture/` holds eleven rule files, 46 assertions, written on
archunit. They run in `pnpm test`. **Read the rule before working around it** --
each file documents why it exists and what it is protecting.

| Rule | What it forbids |
|---|---|
| `layer-direction` | `shared` reaching into `features` or `app`; `features` reaching into `app` |
| `slice-isolation` | any slice importing a sibling slice |
| `portable-core` | `features/*/model`, `features/*/lib`, `shared/lib` importing `next/*` |
| `no-barrel-files` | any `index.ts` / `index.tsx` under `src/` |
| `app-folder-shape` | a component sitting loose under `app/` outside `_components/` |
| `ui-segment-shape` | a file at a `ui/` segment root, or a folder outside `components/hooks/utils/stores` |
| `use-server-placement` | a file in `api/` that is not `queries.ts` (`server-only`) or `mutations.ts` (`'use server'`) |
| `result-shape` | minting a `success: false` literal outside `@rustrak/client` |
| `client-error-kinds` | a new client error `kind` slipping in unhandled (compile-time) |
| `message-keys` | `en`/`zh` drifting apart, a translator bound to a namespace that does not exist, a key that resolves to nothing, or a second English dictionary living in a `.ts` file |
| `locale-completeness` | formatting a date or number without the request locale (`toLocaleString`, `new Intl.*`, a date library); and re-introducing locale routing: a locale-aware navigation import, a `[locale]` segment, or a proxy |

Two conventions in that folder that exist for a reason:

- **Every rule commits a specific population number**, never `> 0`. A negative
  rule over an empty set passes while checking nothing, and a glob that quietly
  stops matching is the most common way that happens. When one of these floors
  fails, the number moved -- update it deliberately and say why.
- **Every rule was watched failing** against a real violation before being kept.

### No barrel files. Ever.

Every import names the file it wants: `@/features/issue/ui/components/issues-list`,
never `@/features/issue`. This is not a style preference. A barrel re-exporting
both `api/queries.ts` (`server-only`) and a `'use client'` component drags the
server-only poison pill into every client component that imports anything from
the slice -- it was tried, and the build failed with 11 errors.

The segment is the public boundary, not a file.

## Key Patterns

### 1. Two directives, two purposes

Both appear **only** in an `api` segment or under `app/`, and they are not
interchangeable:

- `import 'server-only'` -- a build-time poison pill. The module is unreachable
  from the browser bundle. Used by every `queries.ts`: reads are called directly
  from Server Components and never need an endpoint.
- `'use server'` -- turns every export into a public POST endpoint. Used only by
  `mutations.ts`, because the browser genuinely calls those.

Marking a read `'use server'` costs a public endpoint and buys nothing.

**The split is by who calls it, not by what it does to the database.**
`previewStorageCleanup` mutates nothing and still lives in `mutations.ts`,
because a `'use client'` component invokes it and a `server-only` module would
not be reachable from there.

### 2. Reads go straight to the source

A Server Component calls `queries.ts` directly. No action layer, no fetch
waterfall:

```typescript
// features/issue/api/queries.ts
import 'server-only';

export async function listIssues(
  projectId: number,
): Promise<Result<OffsetPaginatedResponse<Issue>, RustrakError>> {
  const client = await createClient();
  return client.issues.list(projectId);
}
```

### 3. `Result`, never exceptions

Every `@rustrak/client` method returns `Result<T, RustrakError>`, a plain-object
discriminated union keyed on `kind`. It survives `structuredClone`, so an action
hands it straight back across the server/client boundary instead of losing it to
an RSC digest. Consuming `result.success` is the point; **minting a second thing
that looks like one is what `result-shape` forbids.**

See `packages/client/CLAUDE.md`.

### 4. Session auth via httpOnly cookie

`shared/api/rustrak.ts` builds the client with the request's session cookie:

```typescript
export async function createClient(): Promise<RustrakClient> {
  const cookieStore = await cookies();
  // ...forwards the session cookie to the server
}
```

`RUSTRAK_API_URL` is **server-side only**. Never expose it to the browser: the
server serves `Cors::default().allow_any_origin()` without `supports_credentials()`,
so a browser would refuse to send the session cookie anyway.

### 5. Mutations from the browser

```typescript
'use client';

export function DeleteButton({ id }: { id: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteProject(id);
      if (!result.success) return toast.error(errorCopy(result.error));
      router.refresh();
    });
  };
  // ...
}
```

## Internationalisation

Two locales, `en` and `zh`, on next-intl 4. **The locale is not in the URL.**
`/projects` is `/projects` in every language; `shared/i18n/request.ts` resolves
which one to answer in, per request, from the reader.

That is next-intl's "without i18n routing" setup, and it is the right one for
this app. A locale prefix buys indexable per-language URLs and per-locale
caching, and an internal dashboard behind a login has use for neither. It also
costs something real: a link pasted to a colleague opens in the *sender's*
language rather than the reader's, which is backwards for a tool a team shares.

There was a prefix for one unmerged branch. Removing it deleted `proxy.ts`, a
navigation wrapper, a `redirect` wrapper, a catch-all route, a `hasLocale`
guard, and the entire class of bug where a forged prefix (`/v1.0/...`) rendered
the app under a bogus locale. Do not bring it back; `locale-completeness`
fails the build if you start to.

**Which language a request gets**, in order, in `request.ts`:

1. the `NEXT_LOCALE` cookie, written when the reader picks one on
   `/settings/account`. An explicit choice always beats an inferred one.
2. `Accept-Language`, matched on the base tag so `zh-CN` and `zh-TW` both reach
   `zh`. A first-time Chinese speaker lands in Chinese rather than being shown
   English and left to find the setting.
3. `en`.

When the preference moves onto the user record (rustrak/rustrak#258, together
with the timezone) that read goes in front, and the cookie becomes what an
anonymous visitor gets rather than the store.

### The five things to know before touching it

1. **Copy lives in `shared/i18n/messages/{en,zh}.json`, and nowhere else.**
   Six modules once carried their own English tables behind an optional
   translator parameter, unreachable because every call site passed one. They
   are gone and `message-keys` forbids the shape. A module in the portable core
   names keys and takes a `Translate`; it does not hold sentences.

2. **Never format a date or a number yourself.** No `toLocaleString()`, no
   `new Intl.NumberFormat`, no date library -- `locale-completeness` fails the
   build on all three. `toLocaleString()` in particular is not
   locale-*neutral*, it is locale-*of-whatever-process-ran-it*, which on a
   Server Component means the container's. Use `useFormatter()` in a client
   component, `await getFormatter()` in a server one, and name the option set:

   ```tsx
   const format = useFormatter();
   format.dateTime(new Date(x), 'date');   // Jan 5, 2026 / 2026年1月5日
   format.relativeTime(new Date(x));       // 3 weeks ago / 3周前
   format.number(n, 'compact');            // 12.4K / 1.2万
   format.number(rate, 'percent');
   ```

   The named formats (`date`, `dateTime`, `precise`, `time`, `axisDay`,
   `axisTime`, `compact`, `percent`, `percentChange`) are defined once in
   `shared/i18n/request.ts`. Add there, not at the call site.

   **A builder is not a component.** Column definitions and tooltip factories
   take `format` as a parameter, exactly as they already take `t`.

3. **Timestamps render in the reader's timezone, and this copies Sentry.**
   `timezoneProvider.tsx` in `getsentry/sentry` resolves
   `user.options.timezone ?? browserTimezone` and never defaults to UTC. Their
   frontend can read `Intl` directly because it renders in the browser; ours
   renders on the server, where the zone arrives in no header. So
   `TimeZoneCookie` writes it from an effect and `request.ts` reads it back,
   validated, falling back to UTC.

   **A UTC reading is labelled, a local one is not.** Also Sentry's rule, from
   `dateTime.tsx`: the zone is shown only when the time is UTC, "in which case
   the user would want to know that it's UTC and not their own time zone". A
   local time matches the reader's own clock and needs no caption; a UTC time
   looks identical and is silently hours out. `request.ts` switches
   `timeStyle` on that condition.

   Not ported: Sentry's persisted `user.options.timezone` and `clock24Hours`,
   which need a column and an endpoint on the Rust side (#258, the same change
   that persists the language). The 12/24-hour clock is the smaller loss, since
   `Intl` already picks it from the locale.

4. **Navigate with `next/link` and `next/navigation`,** plainly. There is no
   wrapper to go through, because there is no prefix to preserve.

5. **Messages are split by where they render.** `shared/i18n/client-messages.ts`
   holds two namespace sets: the shell's, and the dashboard's. One provider at
   the root shipping all 30 namespaces made `/auth/login` a 113KB document
   carrying the copy for source-map cleanup. Adding a namespace means deciding
   which set it belongs to.

### Adding a string

Add the key to **both** dictionaries, resolve it with `t`, run `pnpm test`.
`message-keys` fails if `zh` is missing it, if the namespace does not exist, or
if the key resolves to nothing.

## Routes

| Route | Description |
|-------|-------------|
| `/` | Redirect to `/projects` |
| `/auth/login` | Login form |
| `/invite/[token]` | Accept an invitation |
| `/projects` | Projects list |
| `/projects/new` | Create project: platform grid + name |
| `/projects/[id]` | Project overview: independently streamed tiles |
| `/projects/[id]/issues` | Issues list |
| `/projects/[id]/issues/[issueId]` | Redirects to the latest event |
| `/projects/[id]/issues/[issueId]/events/[eventId]` | Event detail |
| `/projects/[id]/issues/[issueId]/events/empty` | Issue with no retained events |
| `/projects/[id]/logs` | Log stream |
| `/projects/[id]/performance` | Transaction stats |
| `/projects/[id]/performance/summary` | Performance summary |
| `/projects/[id]/performance/[txnId]` | Transaction detail + span waterfall |
| `/projects/[id]/releases` | Releases + health |
| `/projects/[id]/releases/[release]` | Release detail |
| `/projects/[id]/agents` | AI agent traces |
| `/projects/[id]/agents/[traceId]` | Agent trace waterfall |
| `/projects/[id]/settings` | Redirect to `general` |
| `/projects/[id]/settings/general` | Name, slug, platform, danger zone |
| `/projects/[id]/settings/client-keys` | DSN + SDK setup snippet |
| `/projects/[id]/settings/alerts` | Alert rules |
| `/projects/[id]/settings/members` | Membership + roles |
| `/settings` | Redirect to `tokens` |
| `/settings/tokens` | API token management |
| `/settings/team` | Team + invitations |
| `/settings/integrations` | Alert integrations |
| `/settings/storage` | Retention and source-map cleanup |
| `/settings/account` | Account info |
| `/settings/appearance` | Theme selector |
| `/settings/about` | Version info |

Failure surfaces: `app/error.tsx` (full screen, with brand panel),
`app/(main)/error.tsx` (below the header, no brand panel), and
`app/not-found.tsx`, which answers both an unmatched URL and every `notFound()`
raised inside the app. It only manages the first because the root layout is
static again: while it was a `[locale]` segment, an unmatched URL reached no
layout and Next served its own unstyled page instead.

## UI Components

shadcn/ui on Base UI primitives. **The CLI-generated kit lives in
`shared/ui/components/shadcn/` and is kept separate from hand-written shared
components in `shared/ui/components/`.** `components.json` aliases are set so
`shadcn add` lands files in the right place -- do not move them by hand.

## Testing

**This project currently runs architecture tests only.** The page, component and
action tests were deleted deliberately while the structure was still moving;
they return in their own pass. So:

- `vitest.config.mts` runs on `node`, not jsdom. There is no
  testing-library, no React plugin and no setup file.
- Adding a rendering test means restoring that harness in the same commit.

```bash
pnpm test          # the architecture rules
pnpm test:watch
```

Rule files live in `src/__tests__/architecture/`. Shared predicates are in
`predicates.ts`, which is deliberately free of filesystem walking -- selection,
counting and assertion all go through archunit's `projectFiles()`, so a rule's
population and its verdict cannot disagree about which files exist.

## Environment Variables

```bash
RUSTRAK_API_URL=http://localhost:8080  # Backend API URL. Server-side only.
```

## Development

```bash
pnpm dev
pnpm build
pnpm test           # architecture rules
pnpm lint           # Biome, warnings are errors
pnpm format         # rewrite
pnpm format:check   # verify only
pnpm check-types    # tsc --noEmit
pnpm knip           # unused files, exports and dependencies
```

## Docker

```bash
docker build -t rustrak-ui .
docker run -p 3000:3000 -e RUSTRAK_API_URL=http://api:8080 rustrak-ui
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
