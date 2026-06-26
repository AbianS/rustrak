# @rustrak/client

## 0.3.8

### Patch Changes

- [`6286fd4`](https://github.com/rustrak/rustrak/commit/6286fd43b77bd4edd954fbd3254abf77c5dea15c) Thanks [@AbianS](https://github.com/AbianS)! - Added GET /api/tokens/{id} endpoint to reveal full token values. Updated client SDK tokens resource and MCP server tools accordingly. Fixed performance pages to use internal table scroll like the issues page, added password visibility toggle on login form, adapted storage settings layout for mobile, and updated GitHub links from personal to rustrak organization.

## 0.3.7

### Patch Changes

- [`8d4547e`](https://github.com/rustrak/rustrak/commit/8d4547e719c5fd683349e492f3065e792bca5145) Thanks [@AbianS](https://github.com/AbianS)! - Add storage usage tracking and data retention.

  The server now reports storage usage and supports configurable data retention, including manual storage cleanup and source-map garbage collection. A new storage settings page in webview-ui surfaces usage and cleanup controls. The TypeScript client and MCP package gain a storage resource/tool for programmatic access.

  Fixes:

  - SQLite: enable WAL mode and use BEGIN IMMEDIATE for digest writes to prevent dropped events under concurrent writes ([#131](https://github.com/rustrak/rustrak/issues/131), [#141](https://github.com/rustrak/rustrak/issues/141))
  - Support clipboard copying over HTTP, with improved fallback positioning (@WahidinAji, [#146](https://github.com/rustrak/rustrak/issues/146))
  - Correct local PostgreSQL development setup instructions (@WahidinAji, [#147](https://github.com/rustrak/rustrak/issues/147))

## 0.3.6

### Patch Changes

- [`d2642ba`](https://github.com/rustrak/rustrak/commit/d2642baaa51466e4fe79143113bc6c18fe241dba) Thanks [@AbianS](https://github.com/AbianS)! - Dedicated transaction and span processing pipeline added to the server with ingestion flow, migrations, models, and grouped performance UI in webview-ui featuring transaction detail, span waterfall chart, and stats table. Client and MCP packages updated with transaction API resources and tools. Documents performance protocol compatibility gaps vs the Sentry Relay pipeline.

## 0.3.5

### Patch Changes

- [`d0aa064`](https://github.com/rustrak/rustrak/commit/d0aa064b9d84d4ab86209e0d200cea51bf089ee3) Thanks [@AbianS](https://github.com/AbianS)! - Replace cursor-based pagination with offset-based pagination for the transactions API. Fix MCP package declaration output to ensure proper type exports (@jamilahmadzai). Update quinn-proto dependency and address various review feedback across the server, client, and UI packages.

## 0.3.4

### Patch Changes

- [`bd78a7e`](https://github.com/rustrak/rustrak/commit/bd78a7e8608ef6071480ab8563eef932320601de) Thanks [@AbianS](https://github.com/AbianS)! - Transaction ingestion pipeline with processor-pattern architecture, transaction detail endpoint, new performance dashboard UI with sidebar redesign, and client/MCP API wiring to support the new transaction endpoints

## 0.3.3

### Patch Changes

- [`a2b791b`](https://github.com/rustrak/rustrak/commit/a2b791b54e0db5630741c268dc1d14ec93b968cd) Thanks [@AbianS](https://github.com/AbianS)! - Release health period selector: the period parameter is now optional and configurable from the UI via a dropdown (24h, 48h, 7d). Previously the stats endpoint defaulted to 24h with no override. Also updates 35 JS and 11 Rust dependencies, removes 8 unused webview-ui packages, and fixes the Docker Rust base image version.

## 0.3.2

### Patch Changes

- [`8cf7a09`](https://github.com/rustrak/rustrak/commit/8cf7a09b2fa2006058dfad280cd215caf2aaa585) Thanks [@AbianS](https://github.com/AbianS)! - Session tracking and release health monitoring with full Sentry SDK compatibility, including session lifecycle management, crash-free rate aggregation, and a new release health dashboard. Added a dedicated changelog page to the documentation site. Various fixes for ingest handling of session-only envelopes, UI destructive button variants, Clippy warnings, and CI/release tooling.

## 0.3.1

### Patch Changes

- [#112](https://github.com/rustrak/rustrak/pull/112) [`174f439`](https://github.com/rustrak/rustrak/commit/174f4396749cac04fa2b07e0f90d3a76b67b0bd5) Thanks [@AbianS](https://github.com/AbianS)! - Add `/health/version` endpoint and display server version in About page. Expose version via client SDK and MCP tool.

## 0.3.0

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

## 0.2.2

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

## 0.2.1

### Patch Changes

- [`5a0854b`](https://github.com/rustrak/rustrak/commit/5a0854bfd62e1e7e7267b89de248bfab40707b4c) Thanks [@AbianS](https://github.com/AbianS)! - chore: migrate repository to rustrak GitHub organization and Docker Hub

## 0.2.0

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

## 0.1.3

### Patch Changes

- [`6a8b860`](https://github.com/rustrak/rustrak/commit/6a8b860eda0fa199a31089e295a102aef3da6122) Thanks [@AbianS](https://github.com/AbianS)! - Improve npm package metadata, READMEs, and official documentation.

  - Add `homepage`, `repository` (with monorepo `directory`), `bugs`, `author`, and `engines` fields to both packages
  - Expand `keywords` for better npm search discoverability
  - Add `README.md` to `@rustrak/client` published files (was missing)
  - Rewrite both package READMEs: badge row, prominent docs link, cross-references between packages, Cursor and Continue.dev config examples in `@rustrak/mcp`
  - Add new "SDKs & Integrations" section to the docs site with dedicated pages for `@rustrak/client` and `@rustrak/mcp` covering installation, full API reference, error handling, and AI client setup

## 0.1.2

### Patch Changes

- [`40ba761`](https://github.com/rustrak/rustrak/commit/40ba76136d2c455fc22fcc1b99850eb3d29769bd) Thanks [@AbianS](https://github.com/AbianS)! - **server**: migrate all alert-channel and alert-rule endpoints from `AuthenticatedUser` to `ApiAuth` extractor, enabling bearer token access to the alerts API

  **client**: remove `private` flag and add `publishConfig` for npm publishing; bump zod to 4.4.3, msw to 2.14.6, vitest to 4.1.6, @types/node to 25.8.0

  **mcp**: wire npm publish in CI pipeline for initial public release of `@rustrak/mcp`

## 0.1.1

### Patch Changes

- [#44](https://github.com/rustrak/rustrak/pull/44) [`4a84415`](https://github.com/rustrak/rustrak/commit/4a84415d867b5a1f15f11006278527671d62b242) Thanks [@AbianS](https://github.com/AbianS)! - Upgrade all dependencies to latest versions across the monorepo.

  - TypeScript 6.0.3 + Node.js engines >=22 across all packages
  - ky 2.x migration: `prefix` (was `prefixUrl`), updated hook signatures, removed 429 from retry list to avoid `Retry-After` sleep
  - lucide-react 1.x: replaced removed `Github` brand icon with inline SVG component
  - Rust: actix-web 4.13, actix-session 0.11, tokio 1.52, sqlx 0.8.6, rand 0.10 (`RngExt`), sha2 0.11 (`hex::encode`), hmac 0.13 (`KeyInit`)
