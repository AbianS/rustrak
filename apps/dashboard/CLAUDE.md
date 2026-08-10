# Rustrak Dashboard - Technical Context

> **Context Note**: This is the **dashboard-specific context** for Rustrak.
> - Root context: `/CLAUDE.md`
> - Server API: `apps/server/CLAUDE.md`
> - Client Package: `packages/client/CLAUDE.md`
> - The app this one replaces: `apps/webview-ui/CLAUDE.md`

## Status: scaffold

This app does not do anything yet. It is the Vite + TanStack Router replacement
for `apps/webview-ui`, and it exists so the migration can happen route by route
instead of in one commit.

Why it exists: the Next.js app in `apps/webview-ui` ships a 53 MB Node runtime to
render 31 of its 33 routes server-side, for an app that lives entirely behind a
login. This one builds to static files that the Rust server embeds and serves
itself (`apps/server/src/dashboard.rs`, behind the `dashboard` cargo feature), so
Rustrak becomes one binary with no Node at runtime.

TanStack Router rather than TanStack Start: Start's value is its server half, and
this project already has a server written in Rust. Its server functions need a
JavaScript runtime to answer, so adopting Start would mean paying for an
abstraction that can never be used here.

## Stack

- **Build**: Vite 8
- **Router**: TanStack Router 1.170 (file-based, `autoCodeSplitting`)
- **Language**: TypeScript 6 (strict)
- **Styling**: Tailwind CSS 4.3
- **API**: `@rustrak/client` (workspace package), called **directly from the
  browser**

## Conventions already decided

- **Path alias is `@/*`, and only `@/*`.** The scaffold shipped `#/*` too; it was
  removed because the 196 files being ported from `webview-ui` all use `@/`.
- **No `version` field in `package.json`.** Whether this package joins the
  `fixed` changeset group in `.changeset/config.json` is still open, and a
  version belonging to no group drifts on its own.
- **Devtools, Tailwind and the Vite plugins are `devDependencies`.** The
  `@tanstack/devtools-vite` plugin strips devtools from production builds.
- **`routeTree.gen.ts` and `.tanstack/` are excluded from Biome** in the root
  `biome.json`. They are generated; formatting them fights the generator.
- Script names (`lint`, `format:check`, `check-types`, `clean`) match
  `webview-ui` exactly, because the root `ci` task is
  `turbo run test build lint format:check check-types doctor` and turbo matches
  by name. A renamed script means this package is silently skipped in CI.

## Auth and the API

There is **no BFF**. The browser calls the Rust API directly, and
`@rustrak/client` is used verbatim: `createKyInstance` already sets
`credentials: 'include'` (`packages/client/src/utils/http.ts`), so a same-origin
request carries `rustrak_session` with no configuration. Build the client with
`baseUrl: window.location.origin`.

Do not port `webview-ui/src/shared/api/rustrak.ts`. That file (and
`parseSetCookie` / `applySetCookies` / `clearSessionCookies` / `dropSessionCookie`)
exists only to move cookies across the RSC boundary by hand. The browser does it
natively.

**One trap:** `login()`, `register()` and `logout()` return the response's
`Set-Cookie` headers. `Set-Cookie` is a forbidden response header in browsers, so
those arrays are always `[]` here. That is not a failure; the cookie is already
stored. Ignore the arrays, never branch on them.

## Development

```bash
pnpm dev            # vite dev on :3003
pnpm build          # -> dist/, which the server embeds
pnpm check-types
pnpm lint
pnpm format
```

`vite.config.ts` proxies `/api`, `/auth` and `/health` to the Rust server on
`:8080`, so the browser sees a single origin and the session cookie behaves
exactly as it will in production. Run the server alongside:

```bash
(cd ../server && cargo run)
```

`RUSTRAK_DEV_PROXY_TARGET` overrides the proxy target if the server is on another
port. It is a **Vite** setting: it never reaches the browser bundle and does
nothing in production. There is deliberately no `RUSTRAK_API_URL` here; that
variable existed because Next was a separate runtime that had to be told where the
API lived, and same-origin serving removes the need entirely.

---

The block below is generated and maintained by the TanStack CLI. Leave the
markers in place. It is an index of on-demand documentation commands, not project
context.

<!-- intent-skills:start -->
# TanStack Intent - before editing files, run the matching guidance command.
tanstackIntent:
  - id: "@tanstack/devtools#devtools-app-setup"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-app-setup"
    for: "Install TanStack Devtools, pick framework adapter (React/Vue/Solid/Preact), register plugins via plugins prop, configure shell (position, hotkeys, theme, hideUntilHover, requireUrlFlag, eventBusConfig). TanStackDevtools component, defaultOpen, localStorage persistence."
  - id: "@tanstack/devtools#devtools-marketplace"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-marketplace"
    for: "Publish plugin to npm and submit to TanStack Devtools Marketplace. PluginMetadata registry format, plugin-registry.ts, pluginImport (importName, type), requires (packageName, minVersion), framework tagging, multi-framework submissions, featured plugins."
  - id: "@tanstack/devtools#devtools-plugin-panel"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-plugin-panel"
    for: "Build devtools panel components that display emitted event data. Listen via EventClient.on(), handle theme (light/dark), use @tanstack/devtools-ui components. Plugin registration (name, render, id, defaultOpen), lifecycle (mount, activate, destroy), max 3 active plugins. Two paths: Solid.js core with devtools-ui for multi-framework support, or framework-specific panels."
  - id: "@tanstack/devtools#devtools-production"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-production"
    for: "Handle devtools in production vs development. removeDevtoolsOnBuild, devDependency vs regular dependency, conditional imports, NoOp plugin variants for tree-shaking, non-Vite production exclusion patterns."
  - id: "@tanstack/devtools-event-client#devtools-bidirectional"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-bidirectional"
    for: "Two-way event patterns between devtools panel and application. App-to-devtools observation, devtools-to-app commands, time-travel debugging with snapshots and revert. structuredClone for snapshot safety, distinct event suffixes for observation vs commands, serializable payloads only."
  - id: "@tanstack/devtools-event-client#devtools-event-client"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-event-client"
    for: "Create typed EventClient for a library. Define event maps with typed payloads, pluginId auto-prepend namespacing, emit()/on()/onAll()/onAllPluginEvents() API. Connection lifecycle (5 retries, 300ms), event queuing, enabled/disabled state, SSR fallbacks, singleton pattern. Unique pluginId requirement to avoid event collisions."
  - id: "@tanstack/devtools-event-client#devtools-instrumentation"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-instrumentation"
    for: "Analyze library codebase for critical architecture and debugging points, add strategic event emissions. Identify middleware boundaries, state transitions, lifecycle hooks. Consolidate events (1 not 15), debounce high-frequency updates, DRY shared payload fields, guard emit() for production. Transparent server/client event bridging."
  - id: "@tanstack/devtools-vite#devtools-vite-plugin"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-vite#devtools-vite-plugin"
    for: "Configure @tanstack/devtools-vite for source inspection (data-tsd-source, inspectHotkey, ignore patterns), console piping (client-to-server, server-to-client, levels), enhanced logging, server event bus (port, host, HTTPS), production stripping (removeDevtoolsOnBuild), editor integration (launch-editor, custom editor.open). Must be FIRST plugin in Vite config. Vite ^6 || ^7 only."
  - id: "@tanstack/router-core#router-core"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core"
    for: "Framework-agnostic core concepts for TanStack Router: route trees, createRouter, createRoute, createRootRoute, createRootRouteWithContext, addChildren, Register type declaration, route matching, route sorting, file naming conventions. Entry point for all router skills."
  - id: "@tanstack/router-core#router-core/auth-and-guards"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/auth-and-guards"
    for: "Route protection with beforeLoad, redirect()/throw redirect(), isRedirect helper, authenticated layout routes (_authenticated), non-redirect auth (inline login), RBAC with roles and permissions, auth provider integration (Auth0, Clerk, Supabase), router context for auth state."
  - id: "@tanstack/router-core#router-core/code-splitting"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/code-splitting"
    for: "Automatic code splitting (autoCodeSplitting), .lazy.tsx convention, createLazyFileRoute, createLazyRoute, lazyRouteComponent, getRouteApi for typed hooks in split files, codeSplitGroupings per-route override, splitBehavior programmatic config, critical vs non-critical properties."
  - id: "@tanstack/router-core#router-core/data-loading"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/data-loading"
    for: "Route loader option, loaderDeps for cache keys, staleTime/gcTime/ defaultPreloadStaleTime SWR caching, pendingComponent/pendingMs/ pendingMinMs, errorComponent/onError/onCatch, beforeLoad, router context and createRootRouteWithContext DI pattern, router.invalidate, Await component, deferred data loading with unawaited promises."
  - id: "@tanstack/router-core#router-core/navigation"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/navigation"
    for: "Link component, useNavigate, Navigate component, router.navigate, ToOptions/NavigateOptions/LinkOptions, from/to relative navigation, activeOptions/activeProps, preloading (intent/viewport/render), preloadDelay, navigation blocking (useBlocker, Block), createLink, linkOptions helper, scroll restoration, MatchRoute."
  - id: "@tanstack/router-core#router-core/not-found-and-errors"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/not-found-and-errors"
    for: "notFound() function, notFoundComponent, defaultNotFoundComponent, notFoundMode (fuzzy/root), errorComponent, CatchBoundary, CatchNotFound, isNotFound, NotFoundRoute (deprecated), route masking (mask option, createRouteMask, unmaskOnReload)."
  - id: "@tanstack/router-core#router-core/path-params"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/path-params"
    for: "Dynamic path segments ($paramName), splat routes ($ / _splat), optional params ({-$paramName}), prefix/suffix patterns ({$param}.ext), useParams, params.parse/stringify, pathParamsAllowedCharacters, i18n locale patterns."
  - id: "@tanstack/router-core#router-core/search-params"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/search-params"
    for: "validateSearch, search param validation with Zod/Valibot/ArkType adapters, fallback(), search middlewares (retainSearchParams, stripSearchParams), custom serialization (parseSearch, stringifySearch), search param inheritance, loaderDeps for cache keys, reading and writing search params."
  - id: "@tanstack/router-core#router-core/ssr"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/ssr"
    for: "Non-streaming and streaming SSR, RouterClient/RouterServer, renderRouterToString/renderRouterToStream, createRequestHandler, defaultRenderHandler/defaultStreamHandler, HeadContent/Scripts components, head route option (meta/links/styles/scripts), ScriptOnce, automatic loader dehydration/hydration, memory history on server, data serialization, document head management."
  - id: "@tanstack/router-core#router-core/type-safety"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/type-safety"
    for: "Full type inference philosophy (never cast, never annotate inferred values), Register module declaration, from narrowing on hooks and Link, strict:false for shared components, getRouteApi for code-split typed access, addChildren with object syntax for TS perf, LinkProps and ValidateLinkOptions type utilities, as const satisfies pattern."
  - id: "@tanstack/router-plugin#router-plugin"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-plugin#router-plugin"
    for: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."
  - id: "@tanstack/virtual-file-routes#virtual-file-routes"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/virtual-file-routes#virtual-file-routes"
    for: "Programmatic route tree building as an alternative to filesystem conventions: rootRoute, index, route, layout, physical, defineVirtualSubtreeConfig. Use with TanStack Router plugin's virtualRouteConfig option."
<!-- intent-skills:end -->
