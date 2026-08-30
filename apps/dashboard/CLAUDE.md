# Rustrak Dashboard

The web dashboard: React 19, TanStack Router in file-based mode, Vite,
`@rustrak/ui` for everything visual and `@rustrak/client` for everything over
the wire. Root context: `/CLAUDE.md`.

It compiles to static files and **the Rust server hands them out**. There is no
Node process in production, no second container, and no separate origin.

```bash
pnpm dev --filter=@rustrak/dashboard         # Vite on :3000, proxying to the server
pnpm build --filter=@rustrak/dashboard       # -> dist/
pnpm check-types --filter=@rustrak/dashboard
```

## The one idea: the browser only ever talks to its own origin

In production that is literally true. `apps/server/src/routes/dashboard.rs`
mounts `dist/` at `/` and keeps `/api`, `/auth`, `/health`, `/docs` and
`/api-docs` for itself, so the same Actix process answers the page and the API.

In development Vite owns the origin and proxies those same five prefixes to the
server. The list lives in `vite.config.ts` and is the same one the server
refuses to answer with the application shell; **the two must not drift**, or a
route works in one environment and 404s in the other.

Everything follows from that:

- `RustrakClient` is built with `window.location.origin` (`src/lib/rustrak.ts`).
  No API URL to configure, in either environment.
- The session cookie is first-party in both, so no `SameSite=None`, no third
  party cookie policy to fight.
- No CORS on the dashboard's path at all. The server's permissive CORS exists
  for SDK ingestion, not for this.

`VITE_RUSTRAK_API_URL` overrides the origin, for a bundle hosted away from its
server. It is an escape hatch and it gives up all three properties above.

## How the two environments differ, and where that bites

| | development | production |
|---|---|---|
| Serves the page | Vite, `:3000` | the Rust server, `/` |
| Reaches the API | Vite proxy | same process |
| A deep link like `/projects` | Vite's history fallback | `routes::dashboard`'s fallback |
| Assets | unbundled modules | hashed files under `/assets`, `immutable` |

The failure this shape invites is a deep link. `/projects` is a page only the
router knows about: type it in or reload on it and the request goes to the
server, which has never heard of it. `tests/integration/dashboard_test.rs` on
the server side is what pins that behaviour, along with its mirror image: an
API path must never come back as the shell, or `@rustrak/client` parses HTML
and reports a schema failure against itself.

## Who gets in

Everything behind a session lives under `src/routes/_authenticated/`, a
pathless layout route whose `beforeLoad` is the only guard in the application.
Adding a page means putting the file in that folder. The check never goes in a
component: one that redirects has already painted what it was protecting.

`src/lib/auth-store.ts` reads the server's answer as **three** states:

| | means | the guard |
|---|---|---|
| `authenticated` | `/auth/me` returned a user | renders the page |
| `anonymous` | the server answered 401 | redirects to `/login` |
| `unreachable` | network, timeout, 5xx, bad schema | renders "the server did not answer" |

The third row matters: only `unauthenticated` means signed out. Collapsing a
dropped connection into `anonymous` bounces to `/login`, where the login
request fails for the same reason, on a loop.

The store is a module singleton, so the router takes it at construction rather
than through `RouterProvider`'s `context` prop. `ensure()` memoises the
in-flight promise: nested guards would otherwise each issue a `/auth/me`.

### Two rules the login page keeps

- **The credential error never names which half was wrong.** It would confirm
  whether an address has an account. The server matches that in wording *and*
  in timing (`auth/credentials.rs`), and the form must not undo it. Anything
  that is not a verdict on the credentials goes under the form instead.
- **`redirect` is sanitised in `validateSearch`.** Only a path on this origin
  survives; `//host` and `/\host` are absolute URLs wearing a path's clothes.

`IncidentField` draws a closed-form function of its own coordinates and must
stay that way: `/login` is unauthenticated, and the instance's real error
volume would tell anyone who loads it when this team deploys and breaks.

## Tables

`/projects` is the pattern every list page follows.

The URL is the state. `lib/table-search.ts` reads `q`, `sort`, `page` and `per`
out of the address and back, and those four names are the design system's *and*
the server's, so the address bar, the loader's request and Rust's parser are one
shape instead of three translations of one. Share the address and the other
person sees your list.

The table is fully manual: the server filters, sorts and paginates, and
`useDataTable` only ever *proposes* a change. The proposal becomes a
`navigate({ search })`, the loader answers it, and the rows come back shaped.
There is no path where the table second-guesses a page the server already made.

A column is sortable only when the server can sort by it. `open` and `events`
are aggregates `StatsService` computes for the page that was already fetched, so
they carry `enableSorting: false` and `ProjectSort` on the server omits them.
The two have to agree: a header that offers a sort the server drops looks broken.

`/` redirects to `/projects` in `beforeLoad`, so nothing renders first.

## Tests

`pnpm test --filter=@rustrak/dashboard` runs Vitest in Node over
`src/**/*.test.ts`. `auth-store.ts` takes its three endpoints as an `AuthApi`
so it can be tested without `window`; components are covered by
`@rustrak/ui`'s own Chromium suite instead of a jsdom that cannot see them.

## Getting the design system's CSS

`src/styles.css` imports Tailwind, then `@rustrak/ui/styles.css`, then points
`@source` at `packages/ui/src`. That last line is not optional: Tailwind emits
only the utilities it can see and it never looks inside `node_modules`, so
without it every component arrives unstyled.

It points at the real path rather than the symlink under `node_modules`, and at
`src` rather than `dist`, so editing a recipe in the design system shows up here
without rebuilding the package first.

## Rules

- **Never write a loose value.** `bg-surface`, `text-card-title`,
  `p-page-gutter`. The design system resets Tailwind's colour, radius, shadow
  and text namespaces, so `bg-red-500` compiles to nothing. If it is not a
  token it is not in the design: see `packages/ui/CLAUDE.md`.
- **Never import from a deep path in `@rustrak/ui`.** The package exports one
  entry point on purpose.
- **Navigation is the router's, drawing is the design system's.** Every
  navigable component takes `render={<Link to="..." />}`; the package has no
  routing dependency and must not grow one.
- **Data comes from `@rustrak/client`, through a route loader.** Every method
  returns a `Result` and never throws, so a loader returns it as-is and the
  component renders both branches. Do not `unwrap`.
- `routeTree.gen.ts` is generated by the Vite plugin. It is committed, excluded
  from Biome, and never edited by hand.

## Where the build ends up

`vite build` writes `dist/`. `scripts/bundle-dashboard.sh` copies it to
`apps/server/static`, which is what `RUSTRAK_DASHBOARD_DIR` defaults to, so
`cargo run` from `apps/server` picks it up with no configuration. Turbo runs
that copy as part of `@rustrak/server#build`.

A missing build is not an error anywhere in that chain: the server is a
complete product without a UI, and `cargo build` alone has to keep working for
anyone who never installs Node.
