# Rustrak Dashboard

Client-rendered dashboard for Rustrak, built with Vite and TanStack Router. It
compiles to static files that the Rust server embeds and serves itself, so a
Rustrak install is one binary with no Node at runtime.

It is replacing `apps/webview-ui` (Next.js) route by route. Technical context,
conventions and the traps worth knowing are in [`CLAUDE.md`](./CLAUDE.md).

## Requirements

- Node.js 22+
- pnpm 10+
- A running Rustrak server for anything that touches data

## Quick start

```bash
pnpm install

# The Rust server, in another shell
(cd ../server && cargo run)

# The dashboard
pnpm dev            # http://localhost:3003
```

`vite.config.ts` proxies `/api`, `/auth` and `/health` to the server on `:8080`,
so the browser sees a single origin and the session cookie behaves exactly as it
will in production. `RUSTRAK_DEV_PROXY_TARGET` overrides that target if the
server listens elsewhere; it is a Vite setting and never reaches the bundle.

There is no `RUSTRAK_API_URL`. That variable existed because Next.js was a
separate runtime that had to be told where the API lived. Same-origin serving
removes the need entirely.

## Scripts

```bash
pnpm dev              # vite dev on :3003
pnpm build            # -> dist/, which the server embeds
pnpm preview          # serve the build locally
pnpm generate-routes  # regenerate src/routeTree.gen.ts
pnpm check-types
pnpm lint
pnpm format
```

## Serving it from the server

```bash
pnpm --filter=dashboard build
cd ../server && cargo run --features dashboard   # dashboard at http://localhost:8080
```

`RUSTRAK_DASHBOARD=off` makes the server ignore it and behave as an API only.
The `dashboard` cargo feature is not on by default, so `cargo build` works on a
fresh clone without anyone having built the frontend first.
