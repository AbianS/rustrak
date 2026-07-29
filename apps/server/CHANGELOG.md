# @rustrak/server

## 0.14.0

### Minor Changes

- [`cb62882`](https://github.com/rustrak/rustrak/commit/cb62882c84e421e3d9070a75693e1f6be709cb66) Thanks [@AbianS](https://github.com/AbianS)! - `@rustrak/client` no longer throws. Every resource method returns `Result<T, RustrakError>`, a plain discriminated union that survives `structuredClone` and therefore React's server/client boundary, and the nine error classes collapse into one union keyed on `kind`. 5xx bodies are redacted inside the client, so no consumer can leak a server message by accident. Breaking for anyone calling the client directly.

  The server now names the offending field as data: `ErrorDetail` carries an optional `fields` array of `{field, code, message?}` on both 400 and 409, so a form can mark the input that was rejected instead of matching English prose.

  The dashboard gains a command bar built on cmdk, with a project preview column and word-boundary scoring (@bobbymannino), and real failure screens: a full-viewport `ErrorScreen` for the routes with no chrome, plus the app's first custom 404.

  Internally `webview-ui` is now sliced by domain with a portable core, and both apps sit behind the CI quality gate.

## 0.13.0

### Minor Changes

- [`853a5c1`](https://github.com/rustrak/rustrak/commit/853a5c14f3464989f6098738587d865a7c05a234) Thanks [@AbianS](https://github.com/AbianS)! - Project creation becomes a full page with a searchable platform grid and per-platform SDK setup snippets, and projects can now be created with an explicit platform and slug. The projects list gains per-row stats: events, new issues, open and fatal counts, and a sparkline of active issues, all attached in two queries per page and only when `?stats_period=` is passed.

## 0.12.3

### Patch Changes

- [`cf45301`](https://github.com/rustrak/rustrak/commit/cf4530150429667aca20577dfa48fc62d4d5317a) Thanks [@AbianS](https://github.com/AbianS)! - Rebuild the project overview as a bento dashboard, backed by two new project-level stats endpoints (`GET /api/projects/{id}/events/stats` for error volume bucketed by severity, and `GET /api/projects/{id}/stats/summary` for events, new issues and open issues against the preceding window). The overview gains a period filter held in the URL, per-tile Suspense streaming, and a chart palette validated for contrast and colorblind separation.

  Releases now render as a paginated table matching Issues, Logs, Performance and Agents. `GET /api/projects/{id}/sessions/stats` accepts `page`/`per_page` and returns an `OffsetPaginatedResponse<ReleaseHealthRow>` instead of a bare array; `sessions.stats()` in `@rustrak/client` takes an options object instead of positional arguments, and `releaseHealthSchema` and the `ReleaseHealth` array type are removed.

  `@rustrak/mcp` exposes the new stats endpoints as `get_error_volume` and `get_project_stats`.

## 0.12.2

### Patch Changes

- [#207](https://github.com/rustrak/rustrak/pull/207) [`17e17ac`](https://github.com/rustrak/rustrak/commit/17e17ac404cd1dab51edb3ef385defdf4c223813) Thanks [@AbianS](https://github.com/AbianS)! - The dashboard now tells you when a newer Rustrak release is available. A dismissible pill appears at the top of authenticated pages, expanding on hover into the version jump and a link to that release's changelog entry. The check reads a static feed published by the docs site, runs server-side with an hourly cache, and can be turned off entirely with `RUSTRAK_VERSION_CHECK_ENABLED=false`.

## 0.12.1

### Patch Changes

- [#205](https://github.com/rustrak/rustrak/pull/205) [`2211a5e`](https://github.com/rustrak/rustrak/commit/2211a5eb2d35401b82deeb6922c737f6c4c59a32) Thanks [@AbianS](https://github.com/AbianS)! - Fixed the "Send a test" action on email integrations. The recipients typed into the dialog were dropped before reaching the test endpoint, so the test either failed or sent to the integration's configured addresses instead of the ones entered. The test panel also moved out of the dialog footer into its own section, is now visible (disabled) while creating an integration, and validates the parsed recipient list so input of only commas or spaces can no longer be submitted.

## 0.12.0

### Minor Changes

- [`ebcfbbd`](https://github.com/rustrak/rustrak/commit/ebcfbbd3c5fccca6204549cfbd09087a2967f15c) Thanks [@AbianS](https://github.com/AbianS)! - Project configuration moves out of modal dialogs into dedicated settings routes, with a new Client Keys page for SDK onboarding. Projects can now have their platform set manually instead of relying only on auto-detection, exposed through the server, `@rustrak/client`, and a searchable picker in the dashboard covering the full Sentry platform list.

## 0.11.1

### Patch Changes

- [`c6d7eee`](https://github.com/rustrak/rustrak/commit/c6d7eee6b61da252fd4195f1c6f5fbc90248f0ae) Thanks [@AbianS](https://github.com/AbianS)! - Fix events.digest_order collision after retention purge that could silently drop events. Retention cleanup decremented the digested_event_count counter used to derive new digest_order values, letting it collide with a surviving event's row. Removed events.digest_order entirely — events now paginate within an issue on a (timestamp, id) keyset, matching Sentry's own per-group event ordering.

## 0.11.0

### Minor Changes

- [#194](https://github.com/rustrak/rustrak/pull/194) [`9a8b1bb`](https://github.com/rustrak/rustrak/commit/9a8b1bb34c815a6d2ffe23129f42a9cae2f5dc9b) Thanks [@AbianS](https://github.com/AbianS)! - ## Sentry Releases API

  Server implements `POST`/`PUT .../releases/...`, the endpoints `sentry-cli` and the Sentry JS bundler plugins (Next.js, SvelteKit, Nuxt, Remix) call on every build to create and finalize a release. Previously these 404'd, showing up in every build log for most self-hosted JS users. Adds a `releases` table (`project_id` + `version`, unique) backing the new endpoints.

  Regression clearing for issues resolved "in the next release" now compares real release creation dates instead of a string-inequality check, and runs automatically whenever a release is created — matching Sentry's own behavior of clearing pending resolutions on release creation.

  ## Removed: `POST /api/projects/{id}/deploys`

  This project-invented endpoint (and `@rustrak/client`'s `createDeploy` / `@rustrak/mcp`'s `record_deploy`) is removed. It existed only as a manual workaround to trigger the regression-clearing logic before release creation could do it automatically — creating a release now has the same effect, matching real Sentry (which has no such endpoint either; Sentry's own Deploy object is unrelated deploy-tracking metadata, not a regression-clearing trigger).

## 0.10.2

### Patch Changes

- [`9c49900`](https://github.com/rustrak/rustrak/commit/9c49900024c762044a5be63ae2467646c17d3cc6) Thanks [@AbianS](https://github.com/AbianS)! - Fixed a production migration failure on startup. `20260718000000_agent_perf_indexes` combined two `CREATE INDEX CONCURRENTLY` statements in a single migration file; sending multiple statements together makes Postgres wrap them in an implicit transaction, and `CONCURRENTLY` cannot run inside any transaction block, so the server failed to boot with "CREATE INDEX CONCURRENTLY cannot run inside a transaction block". The migration is now split into two single-statement migrations, one per index, so both can run outside a transaction as intended.

## 0.10.1

### Patch Changes

- [`2beae94`](https://github.com/rustrak/rustrak/commit/2beae943a6ace197c8e029947d973a5c803d5c47) Thanks [@AbianS](https://github.com/AbianS)! - ## Dashboard Query Performance

  Fixed two independent causes of multi-second dashboard queries that saturated the database connection pool on installations with large `spans` and `transactions` tables.

  Agent trace queries scanned the entire spans table. The `gen_ai_*` columns were added to tables already holding millions of rows, and since `ADD COLUMN` does not rewrite the heap, the new column had no planner statistics: Postgres assumed `IS NOT NULL` matched every row and fell back to a sequential scan, taking around 14 seconds even when no AI spans existed at all. Partial indexes now carry the predicate themselves, so the plan no longer depends on column statistics and the fix applies to existing installations without any manual `ANALYZE`.

  Transaction stats streamed every matching row to the application to compute percentiles in memory, over a million values per request on busy projects. Postgres now computes them as ordered-set aggregates in a single round trip, cutting the endpoint from roughly 14 seconds to 300 milliseconds. SQLite keeps the in-memory path, since it has no `percentile_cont`.

## 0.10.0

### Minor Changes

- [`d05105a`](https://github.com/rustrak/rustrak/commit/d05105aec39e7c44bcb459a43b3780377e221a2e) Thanks [@AbianS](https://github.com/AbianS)! - ## AI Agent Monitoring

  New Agents page tracks LLM-instrumented spans from any Sentry SDK: agent runs, duration, models by calls/tokens, tool calls, and a per-trace waterfall. Deliberately ships without a cost/spend estimate, since per-model pricing tables go stale too fast to promise, so Rustrak shows exact token counts instead.

  ## Sentry Spans Protocol v2

  Server now recognizes Spans Protocol v2, the batched wire format real Sentry SDKs (verified against @sentry/node + Vercel AI SDK) actually use for AI-instrumented spans. Previously only the legacy standalone-span format was parsed, so AI Agent Monitoring received no data from real SDKs. Also fixes cache/reasoning token attribute mapping and timestamp validation to match Relay's behavior.

  ## Standalone Span Ingestion

  Server accepts Sentry's standalone "span" envelope item (OTel-style spans without a parent transaction), the prerequisite for AI Agent Monitoring and general span-level querying via `GET /api/projects/{id}/spans`.

  ## Fixes & Docs

  - Source maps guide corrected for project/org resolution behavior and SvelteKit setup added
  - Docs build pinned to zod 4.3.5 to fix a CI-only shallow-clone failure with nextra

## 0.9.2

### Patch Changes

- [`50314dc`](https://github.com/rustrak/rustrak/commit/50314dc42960f5d5ddbd29cbc2d9111b7abfeae9) Thanks [@AbianS](https://github.com/AbianS)! - Added RUSTRAK_LOG_TIMEZONE environment variable for configuring server log timestamp display timezone. Updated dependencies across all packages. Fixed clippy compliance issue in notification service.

## 0.9.1

### Patch Changes

- [`b3a05e9`](https://github.com/rustrak/rustrak/commit/b3a05e979e47669a3ec665bfe0dae4e6bc2eeef3) Thanks [@AbianS](https://github.com/AbianS)! - ## Project Platform Auto-Detection

  Server automatically detects project platform from ingested events and exposes a `platform` field. The web UI renders platform-specific icons using platformicons. Client package now exposes `project.platform` in responses.

  ## Project Overview & Releases

  New project overview page with session trend charts and health score cards. New releases section with release environment cards and release list. Server adds releases and enhanced sessions API endpoints. Client adds releases and sessions resources.

  ## Sentry-Compatible UI Improvements

  Stack trace rendering now matches Sentry's behavior with in-app/system frame grouping, platform-adaptive formatting, and threads section. Breadcrumbs display with expand toggle, category icons, and color coding.

  ## Server Fixes

  Oversized events are now intelligently trimmed instead of being rejected outright. Source map rewriting also applies to thread frames, not just exception stacktraces.

## 0.9.0

### Minor Changes

- [`2686495`](https://github.com/rustrak/rustrak/commit/2686495ee671ef7ebdd319ed643e892c4f766bbf) Thanks [@AbianS](https://github.com/AbianS)! - - New Sentry-compatible issues model with status and priority lifecycle management, bulk operations (list stats, copy-as, packages context), and social features (share, bookmark, assign, snooze)
  - Issues web UI: new issue detail pages, event navigation with breadcrumbs, activity timeline, trend sparklines, collapsible sidebar
  - Token delete confirmation dialog in webview-ui settings
  - Agent-rusty now has access to the full getsentry/sentry monolith source for deeper Sentry compatibility analysis
  - Fixed is_resolved and is_muted shim logic to not interfere with muted/resolved issues
  - Fixed userReportSchema to accept empty-string email
  - Fixed 3 Sentry-compat divergences identified against the monolith source
  - Performance: list_stats now projects only `data->user` instead of full event blob
  - Dependencies updated to latest exact versions

## 0.8.1

### Patch Changes

- [`8406c44`](https://github.com/rustrak/rustrak/commit/8406c44154cbd730bd20a7563e013197b0651c8b) Thanks [@AbianS](https://github.com/AbianS)! - Storage cleanup now supports scoping to specific data types (events, transactions, logs, sessions). The server endpoint accepts optional data-type filter parameters, the MCP tools include `--events`, `--transactions`, `--logs`, and `--sessions` flags, the client forwards the filter options, and the WebView UI provides a data-type selection interface. Also fixes the cleanup success toast to correctly report when no issues were found.

## 0.8.0

### Minor Changes

- [`edad7dc`](https://github.com/rustrak/rustrak/commit/edad7dc0548ab184f708d878c4f8ae5963bbb9f5) Thanks [@AbianS](https://github.com/AbianS)! - Logs ingestion, storage, and retrieval pipeline with full SDK compatibility, including standalone log breadcrumb types. New webview-ui logs page with shadcn Table, sticky header, and dedicated sidebar entry. Client SDK logs resource and MCP list_logs tool added. Docs updated with logs usage guide.

## 0.7.2

### Patch Changes

- [`6286fd4`](https://github.com/rustrak/rustrak/commit/6286fd43b77bd4edd954fbd3254abf77c5dea15c) Thanks [@AbianS](https://github.com/AbianS)! - Added GET /api/tokens/{id} endpoint to reveal full token values. Updated client SDK tokens resource and MCP server tools accordingly. Fixed performance pages to use internal table scroll like the issues page, added password visibility toggle on login form, adapted storage settings layout for mobile, and updated GitHub links from personal to rustrak organization.

## 0.7.1

### Patch Changes

- [`37062b0`](https://github.com/rustrak/rustrak/commit/37062b0186f8d38efd310df986ef157cc57f2675) Thanks [@AbianS](https://github.com/AbianS)! - fix: correct storage counts, robust cleanup, and streamed storage page

## 0.7.0

### Minor Changes

- [`8d4547e`](https://github.com/rustrak/rustrak/commit/8d4547e719c5fd683349e492f3065e792bca5145) Thanks [@AbianS](https://github.com/AbianS)! - Add storage usage tracking and data retention.

  The server now reports storage usage and supports configurable data retention, including manual storage cleanup and source-map garbage collection. A new storage settings page in webview-ui surfaces usage and cleanup controls. The TypeScript client and MCP package gain a storage resource/tool for programmatic access.

  Fixes:

  - SQLite: enable WAL mode and use BEGIN IMMEDIATE for digest writes to prevent dropped events under concurrent writes ([#131](https://github.com/rustrak/rustrak/issues/131), [#141](https://github.com/rustrak/rustrak/issues/141))
  - Support clipboard copying over HTTP, with improved fallback positioning (@WahidinAji, [#146](https://github.com/rustrak/rustrak/issues/146))
  - Correct local PostgreSQL development setup instructions (@WahidinAji, [#147](https://github.com/rustrak/rustrak/issues/147))

## 0.6.2

### Patch Changes

- [`d2642ba`](https://github.com/rustrak/rustrak/commit/d2642baaa51466e4fe79143113bc6c18fe241dba) Thanks [@AbianS](https://github.com/AbianS)! - Dedicated transaction and span processing pipeline added to the server with ingestion flow, migrations, models, and grouped performance UI in webview-ui featuring transaction detail, span waterfall chart, and stats table. Client and MCP packages updated with transaction API resources and tools. Documents performance protocol compatibility gaps vs the Sentry Relay pipeline.

## 0.6.1

### Patch Changes

- [`d0aa064`](https://github.com/rustrak/rustrak/commit/d0aa064b9d84d4ab86209e0d200cea51bf089ee3) Thanks [@AbianS](https://github.com/AbianS)! - Replace cursor-based pagination with offset-based pagination for the transactions API. Fix MCP package declaration output to ensure proper type exports (@jamilahmadzai). Update quinn-proto dependency and address various review feedback across the server, client, and UI packages.

## 0.6.0

### Minor Changes

- [`bd78a7e`](https://github.com/rustrak/rustrak/commit/bd78a7e8608ef6071480ab8563eef932320601de) Thanks [@AbianS](https://github.com/AbianS)! - Transaction ingestion pipeline with processor-pattern architecture, transaction detail endpoint, new performance dashboard UI with sidebar redesign, and client/MCP API wiring to support the new transaction endpoints

## 0.5.2

### Patch Changes

- [`a2b791b`](https://github.com/rustrak/rustrak/commit/a2b791b54e0db5630741c268dc1d14ec93b968cd) Thanks [@AbianS](https://github.com/AbianS)! - Release health period selector: the period parameter is now optional and configurable from the UI via a dropdown (24h, 48h, 7d). Previously the stats endpoint defaulted to 24h with no override. Also updates 35 JS and 11 Rust dependencies, removes 8 unused webview-ui packages, and fixes the Docker Rust base image version.

## 0.5.1

### Patch Changes

- [`ba2cff3`](https://github.com/rustrak/rustrak/commit/ba2cff31b504bd64a2202cd5898f2c5599080320) Thanks [@AbianS](https://github.com/AbianS)! - Fix transaction envelope items being accidentally processed through the error digest pipeline. Performance monitoring transactions are now correctly skipped during error ingestion, matching Sentry Relay's ErrorsProcessor behavior.

## 0.5.0

### Minor Changes

- [`8cf7a09`](https://github.com/rustrak/rustrak/commit/8cf7a09b2fa2006058dfad280cd215caf2aaa585) Thanks [@AbianS](https://github.com/AbianS)! - Session tracking and release health monitoring with full Sentry SDK compatibility, including session lifecycle management, crash-free rate aggregation, and a new release health dashboard. Added a dedicated changelog page to the documentation site. Various fixes for ingest handling of session-only envelopes, UI destructive button variants, Clippy warnings, and CI/release tooling.

## 0.4.1

### Patch Changes

- [#112](https://github.com/rustrak/rustrak/pull/112) [`174f439`](https://github.com/rustrak/rustrak/commit/174f4396749cac04fa2b07e0f90d3a76b67b0bd5) Thanks [@AbianS](https://github.com/AbianS)! - Add `/health/version` endpoint and display server version in About page. Expose version via client SDK and MCP tool.

## 0.4.0

### Minor Changes

- [`837ae98`](https://github.com/rustrak/rustrak/commit/837ae98c0d313aa20e54fc19a13f67f927e81e52) Thanks [@AbianS](https://github.com/AbianS)! - Add team management and project-level RBAC.

  **Server (`@rustrak/server`)**

  - New `teams`, `team_members`, `project_members` tables with migration
  - Team routes: create, get, update, delete, member management
  - Project member routes: add/remove members, role assignment (owner/admin/member)
  - `access` service: permission checks across all routes
  - RBAC extractors and middleware applied to projects, issues, events, source maps, alerts, tokens
  - `require_admin` middleware ordering fix on `list_channels`
  - Integration tests: `team_rbac_test.rs`

  **Client (`@rustrak/client`)**

  - New resources: `TeamResource`, `MembersResource`, `InvitationsResource`
  - New schemas and types: `team`, `member`, `invitation`
  - Updated `UserSchema` with role fields
  - Integration tests for all new resources

  **UI (`webview-ui`)**

  - Settings > Team page: invite members, list members, manage roles
  - Pending invitations list with accept/revoke
  - Project header with members dialog and role-based actions
  - `/invite/[token]` accept invitation flow
  - Hide global admins from project add-member list

  **MCP (`@rustrak/mcp`)**

  - New `team` tools: `list_team_members`, `invite_member`, `remove_member`, `update_member_role`
  - Fix alerts tools authorization (`require_admin` ordering)
  - Integration and unit tests for team tools

  **Docs**

  - New `usage/team.mdx`: team management guide
  - Updated `sdks/mcp.mdx`: team tools documentation

## 0.3.3

### Patch Changes

- [`f748f8c`](https://github.com/rustrak/rustrak/commit/f748f8cce27cb6599a2503aec74b257778b05866) Thanks [@AbianS](https://github.com/AbianS)! - feat(alerts): two-tier integrations with global credentials and per-rule routing override

  - Add alert integrations hub UI with collapsible section layout
  - Add two-tier alert routing: global channel credentials + per-rule override
  - Redesign alert rule form dialog
  - Remove legacy `channel_ids` field from alert rules
  - Add `alert-integrations` and `alert-channels` resources to client package
  - Fix source maps chunk upload to accept non-SHA1 multipart field names
  - Fix project event counts not decrementing when an issue is deleted
  - Regenerate OpenAPI spec with updated alert models

## 0.3.2

### Patch Changes

- [`27f6a8a`](https://github.com/rustrak/rustrak/commit/27f6a8a51e8526cc3db8f1116f8449225d5674c8) Thanks [@AbianS](https://github.com/AbianS)! - Fix non-SHA1 multipart field names in chunk upload and decrement project event counts when an issue is deleted.

## 0.3.1

### Patch Changes

- [`5a0854b`](https://github.com/rustrak/rustrak/commit/5a0854bfd62e1e7e7267b89de248bfab40707b4c) Thanks [@AbianS](https://github.com/AbianS)! - chore: migrate repository to rustrak GitHub organization and Docker Hub

## 0.3.0

### Minor Changes

- [`fd768de`](https://github.com/rustrak/rustrak/commit/fd768de0816ba6eeeaa26ed8893d82bd6224fd2b) Thanks [@AbianS](https://github.com/AbianS)! - Add source map upload and stack frame rewriting support.

  ## @rustrak/server

  - **Source map processing pipeline** — New `POST /api/projects/{id}/files/` endpoint accepts artifact bundles (gzip/zip) and individual `.map` files via multipart upload, stores chunks, and assembles them asynchronously (workers/sourcemap_assembly.rs)
  - **Frame rewriting** — Digest worker now resolves minified stack frames to original source positions using stored source maps; file/line/col/context_line are rewritten in-place before event storage
  - **Assembly state machine** — chunk upload → assembly job → frame rewriting with retry logic; `retry_count` resets on re-queue; HTTP 200 with `missingChunks` field returned for assembly error state (Sentry protocol compliant)
  - **Migrations** — two new migrations: remove issue soft delete (`20260521`), source maps tables (`20260522`)
  - **Hard delete for issues** — `deleted_at` soft delete replaced with immediate CASCADE hard delete; reduces storage and simplifies queries

  ## @rustrak/client

  - **`SourceMapsResource`** — New resource class implementing the Sentry artifact bundle upload protocol: `createArtifactBundle()`, `uploadChunk()`, `assembleArtifacts()` with chunk-hash-keyed multipart fields
  - Exported from package root alongside existing resources

  ## webview-ui

  - Fix breadcrumb rendering — level badge and message display corrected after PR [#89](https://github.com/rustrak/rustrak/issues/89) review
  - Fix event display — improved titles, tags layout, and breadcrumb columns in event detail view

  ## docs

  - New `/usage/source-maps` page with upload guide and environment setup
  - Blog post: "Source Maps in Rust" covering the implementation approach
  - Updated environment reference with source map related config

## 0.2.5

### Patch Changes

- [`324cefd`](https://github.com/rustrak/rustrak/commit/324cefdfbd305d1e53e79ac10c55ca52cc8ef8a4) Thanks [@AbianS](https://github.com/AbianS)! - Fix PUBLIC_URL env var for DSN generation, replace issue soft delete with hard delete, and bump astral-tokio-tar to address RUSTSEC-2026-0145.

  - `@rustrak/server`: Add `PUBLIC_URL` environment variable support so the DSN returned by the server uses the correct public-facing host instead of the internal bind address
  - `@rustrak/server`: Replace issue soft delete with hard delete — issues and their child events/groupings are now removed permanently via CASCADE on DELETE
  - `@rustrak/server`: Bump `astral-tokio-tar` to 0.6.2 to resolve security advisory RUSTSEC-2026-0145
  - `docs`: Document `PUBLIC_URL` in environment reference, quickstart, production guide, and troubleshooting pages

## 0.2.4

### Patch Changes

- [`40ba761`](https://github.com/rustrak/rustrak/commit/40ba76136d2c455fc22fcc1b99850eb3d29769bd) Thanks [@AbianS](https://github.com/AbianS)! - **server**: migrate all alert-channel and alert-rule endpoints from `AuthenticatedUser` to `ApiAuth` extractor, enabling bearer token access to the alerts API

  **client**: remove `private` flag and add `publishConfig` for npm publishing; bump zod to 4.4.3, msw to 2.14.6, vitest to 4.1.6, @types/node to 25.8.0

  **mcp**: wire npm publish in CI pipeline for initial public release of `@rustrak/mcp`

## 0.2.3

### Patch Changes

- [`7fd41b8`](https://github.com/rustrak/rustrak/commit/7fd41b8669b24e57582673c4502c52662482b085) Thanks [@AbianS](https://github.com/AbianS)! - Bug fixes for ingest, auth, Slack alerts, and UI stability

  - fix(ingest): raise payload size limit to 100MB
  - fix(digest): delete orphaned temp files on processing error
  - fix(projects): retry slug INSERT on unique collision instead of 409
  - fix(auth): propagate DB errors from ApiAuth instead of masking as 401; accept Bearer tokens on management API endpoints
  - fix(slack): guard token redaction, reject whitespace-only channel, prevent silent data loss on bot_token channel edit
  - fix(alerts): use project id instead of slug in alert issue URL
  - fix(docker): build server with postgres feature in dev compose
  - fix(ui): remove theme-dependent syntax highlighter to fix stack trace hydration mismatch

## 0.2.2

### Patch Changes

- [`3fc4abb`](https://github.com/rustrak/rustrak/commit/3fc4abba96170c7fbbac708aeb0296c7e759818c) Thanks [@AbianS](https://github.com/AbianS)! - ## webview-ui

  ### Features

  - **Skeleton loading states** — issue and event detail routes now show skeleton UI while fetching, eliminating layout shift on navigation
  - **Full mobile responsiveness** — projects page, project detail, settings section, event detail, and global header all adapted for small screens
  - **Base UI migration** — replaced all Radix UI primitives (shadcn/ui) with Base UI equivalents; corrected data attribute selectors and dropdown widths; rewired form a11y and tabs keyboard orientation
  - **Brand icon** — replaced generic Terminal icon with the Rustrak bolt SVG logo icon across the UI

  ### Bug Fixes

  - Fixed stale state on issue dropdown actions by passing `id` directly instead of through closure capture
  - Fixed sticky event sidebar not respecting viewport height
  - Fixed API docs link in tokens settings page
  - Restored correct keyboard orientation for tab components after Base UI migration

  ## @rustrak/server

  ### Maintenance

  - Updated Rust dependencies: tokio `1.52.1 → 1.52.3`, reqwest `0.13.2 → 0.13.3`, lettre `0.11.21 → 0.11.22`, sentry `0.47.0 → 0.48.2`, utoipa `5.x → 5.5.0`

  ## docs

  ### Content

  - Added initial Sentry protocol compatibility drift report documenting deviations between Rustrak's ingestion implementation and the official Sentry envelope protocol

## 0.2.1

### Patch Changes

- [#44](https://github.com/rustrak/rustrak/pull/44) [`4a84415`](https://github.com/rustrak/rustrak/commit/4a84415d867b5a1f15f11006278527671d62b242) Thanks [@AbianS](https://github.com/AbianS)! - Upgrade all dependencies to latest versions across the monorepo.

  - TypeScript 6.0.3 + Node.js engines >=22 across all packages
  - ky 2.x migration: `prefix` (was `prefixUrl`), updated hook signatures, removed 429 from retry list to avoid `Retry-After` sleep
  - lucide-react 1.x: replaced removed `Github` brand icon with inline SVG component
  - Rust: actix-web 4.13, actix-session 0.11, tokio 1.52, sqlx 0.8.6, rand 0.10 (`RngExt`), sha2 0.11 (`hex::encode`), hmac 0.13 (`KeyInit`)

## 0.2.0

### Minor Changes

- [#39](https://github.com/rustrak/rustrak/pull/39) [`447596b`](https://github.com/rustrak/rustrak/commit/447596b77655e6c8bc24257c603d1a992fb4cb03) Thanks [@kervel](https://github.com/kervel)! - SQLite is now the default database backend

  BREAKING CHANGE: The `latest` Docker image now uses SQLite instead of PostgreSQL.

  If you are using `rustrak/rustrak-server:latest` with PostgreSQL, update your image tag:

  ```yaml
  # Before
  image: rustrak/rustrak-server:latest

  # After
  image: rustrak/rustrak-server:postgres
  ```

  No data migration required — only the image tag changes.

  New: SQLite support with zero configuration. No `DATABASE_URL` needed — data is stored automatically at `/data/rustrak.db` inside the container. Mount a volume at `/data` to persist data.

  Docker Hub now publishes two variants per release:

  - `latest` / `vX.Y.Z` → SQLite (default, no external database)
  - `postgres` / `vX.Y.Z-postgres` → PostgreSQL

  New "Database Backends" documentation page with SQLite vs PostgreSQL comparison, Docker Compose examples, and backup strategies.

## 0.1.4

### Patch Changes

- [#34](https://github.com/rustrak/rustrak/pull/34) [`54efbba`](https://github.com/rustrak/rustrak/commit/54efbba72d56130d3d3b987faf9b829c6041ab3e) Thanks [@AbianS](https://github.com/AbianS)! - chore: update dependencies

## 0.1.3

### Patch Changes

- [#23](https://github.com/rustrak/rustrak/pull/23) [`169dc0c`](https://github.com/rustrak/rustrak/commit/169dc0ce73fee276b169f403daa0ed4a00404726) Thanks [@AbianS](https://github.com/AbianS)! - feat: system alert

## 0.1.2

### Patch Changes

- [`2f7a450`](https://github.com/rustrak/rustrak/commit/2f7a450263e2fc3357c5cda614e24774810fa373) Thanks [@AbianS](https://github.com/AbianS)! - chore: second version

## 0.1.1

### Patch Changes

- [`08a1262`](https://github.com/rustrak/rustrak/commit/08a12627dbdf1a044d3a66b25b1ee113583f57f8) Thanks [@AbianS](https://github.com/AbianS)! - chore: first version
