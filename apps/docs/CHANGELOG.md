# docs

## 0.1.29

### Patch Changes

- [`d2642ba`](https://github.com/rustrak/rustrak/commit/d2642baaa51466e4fe79143113bc6c18fe241dba) Thanks [@AbianS](https://github.com/AbianS)! - Dedicated transaction and span processing pipeline added to the server with ingestion flow, migrations, models, and grouped performance UI in webview-ui featuring transaction detail, span waterfall chart, and stats table. Client and MCP packages updated with transaction API resources and tools. Documents performance protocol compatibility gaps vs the Sentry Relay pipeline.

## 0.1.28

### Patch Changes

- [`d0aa064`](https://github.com/rustrak/rustrak/commit/d0aa064b9d84d4ab86209e0d200cea51bf089ee3) Thanks [@AbianS](https://github.com/AbianS)! - Replace cursor-based pagination with offset-based pagination for the transactions API. Fix MCP package declaration output to ensure proper type exports (@jamilahmadzai). Update quinn-proto dependency and address various review feedback across the server, client, and UI packages.

## 0.1.27

### Patch Changes

- [`bd78a7e`](https://github.com/rustrak/rustrak/commit/bd78a7e8608ef6071480ab8563eef932320601de) Thanks [@AbianS](https://github.com/AbianS)! - Transaction ingestion pipeline with processor-pattern architecture, transaction detail endpoint, new performance dashboard UI with sidebar redesign, and client/MCP API wiring to support the new transaction endpoints

## 0.1.26

### Patch Changes

- [`a2b791b`](https://github.com/rustrak/rustrak/commit/a2b791b54e0db5630741c268dc1d14ec93b968cd) Thanks [@AbianS](https://github.com/AbianS)! - Release health period selector: the period parameter is now optional and configurable from the UI via a dropdown (24h, 48h, 7d). Previously the stats endpoint defaulted to 24h with no override. Also updates 35 JS and 11 Rust dependencies, removes 8 unused webview-ui packages, and fixes the Docker Rust base image version.

## 0.1.25

### Patch Changes

- [`8b9c5f3`](https://github.com/rustrak/rustrak/commit/8b9c5f3579f8c9d7dddc5f3f8e9d96ee2c19aa0f) Thanks [@AbianS](https://github.com/AbianS)! - Add changelog page documenting the v0.5.1 server release (transaction digest fix) to the documentation site

## 0.1.24

### Patch Changes

- [`8cf7a09`](https://github.com/rustrak/rustrak/commit/8cf7a09b2fa2006058dfad280cd215caf2aaa585) Thanks [@AbianS](https://github.com/AbianS)! - Session tracking and release health monitoring with full Sentry SDK compatibility, including session lifecycle management, crash-free rate aggregation, and a new release health dashboard. Added a dedicated changelog page to the documentation site. Various fixes for ingest handling of session-only envelopes, UI destructive button variants, Clippy warnings, and CI/release tooling.

## 0.1.23

### Patch Changes

- [#119](https://github.com/rustrak/rustrak/pull/119) [`4320803`](https://github.com/rustrak/rustrak/commit/4320803e527132353135686550befd825870fc72) Thanks [@AbianS](https://github.com/AbianS)! - Add changelog page with version history to documentation

## 0.1.22

### Patch Changes

- [`2567c58`](https://github.com/rustrak/rustrak/commit/2567c587691947c1b6d7ee0ab69c9e912a437c7c) Thanks [@AbianS](https://github.com/AbianS)! - Fix Docker image references: replace abians7/ with rustrak/ across all documentation pages

## 0.1.21

### Patch Changes

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

## 0.1.20

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

## 0.1.19

### Patch Changes

- [`27f6a8a`](https://github.com/rustrak/rustrak/commit/27f6a8a51e8526cc3db8f1116f8449225d5674c8) Thanks [@AbianS](https://github.com/AbianS)! - Fix non-SHA1 multipart field names in chunk upload and decrement project event counts when an issue is deleted.

## 0.1.18

### Patch Changes

- [`5a0854b`](https://github.com/rustrak/rustrak/commit/5a0854bfd62e1e7e7267b89de248bfab40707b4c) Thanks [@AbianS](https://github.com/AbianS)! - chore: migrate repository to rustrak GitHub organization and Docker Hub

## 0.1.17

### Patch Changes

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

## 0.1.16

### Patch Changes

- [`324cefd`](https://github.com/rustrak/rustrak/commit/324cefdfbd305d1e53e79ac10c55ca52cc8ef8a4) Thanks [@AbianS](https://github.com/AbianS)! - Fix PUBLIC_URL env var for DSN generation, replace issue soft delete with hard delete, and bump astral-tokio-tar to address RUSTSEC-2026-0145.

  - `@rustrak/server`: Add `PUBLIC_URL` environment variable support so the DSN returned by the server uses the correct public-facing host instead of the internal bind address
  - `@rustrak/server`: Replace issue soft delete with hard delete — issues and their child events/groupings are now removed permanently via CASCADE on DELETE
  - `@rustrak/server`: Bump `astral-tokio-tar` to 0.6.2 to resolve security advisory RUSTSEC-2026-0145
  - `docs`: Document `PUBLIC_URL` in environment reference, quickstart, production guide, and troubleshooting pages

## 0.1.15

### Patch Changes

- [#79](https://github.com/rustrak/rustrak/pull/79) [`55fa648`](https://github.com/rustrak/rustrak/commit/55fa648963cb9d9cb4055520383fa35653c53052) Thanks [@AbianS](https://github.com/AbianS)! - Add blog section to documentation site

## 0.1.14

### Patch Changes

- [`6a8b860`](https://github.com/rustrak/rustrak/commit/6a8b860eda0fa199a31089e295a102aef3da6122) Thanks [@AbianS](https://github.com/AbianS)! - Improve npm package metadata, READMEs, and official documentation.

  - Add `homepage`, `repository` (with monorepo `directory`), `bugs`, `author`, and `engines` fields to both packages
  - Expand `keywords` for better npm search discoverability
  - Add `README.md` to `@rustrak/client` published files (was missing)
  - Rewrite both package READMEs: badge row, prominent docs link, cross-references between packages, Cursor and Continue.dev config examples in `@rustrak/mcp`
  - Add new "SDKs & Integrations" section to the docs site with dedicated pages for `@rustrak/client` and `@rustrak/mcp` covering installation, full API reference, error handling, and AI client setup

## 0.1.13

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

## 0.1.12

### Patch Changes

- [#46](https://github.com/rustrak/rustrak/pull/46) [`c64ebe0`](https://github.com/rustrak/rustrak/commit/c64ebe09d1e2700faf956c757cb21402aa062e5a) Thanks [@AbianS](https://github.com/AbianS)! - Add interactive API reference powered by OpenAPI spec

## 0.1.11

### Patch Changes

- [#44](https://github.com/rustrak/rustrak/pull/44) [`4a84415`](https://github.com/rustrak/rustrak/commit/4a84415d867b5a1f15f11006278527671d62b242) Thanks [@AbianS](https://github.com/AbianS)! - Upgrade all dependencies to latest versions across the monorepo.

  - TypeScript 6.0.3 + Node.js engines >=22 across all packages
  - ky 2.x migration: `prefix` (was `prefixUrl`), updated hook signatures, removed 429 from retry list to avoid `Retry-After` sleep
  - lucide-react 1.x: replaced removed `Github` brand icon with inline SVG component
  - Rust: actix-web 4.13, actix-session 0.11, tokio 1.52, sqlx 0.8.6, rand 0.10 (`RngExt`), sha2 0.11 (`hex::encode`), hmac 0.13 (`KeyInit`)

## 0.1.10

### Patch Changes

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

## 0.1.9

### Patch Changes

- [#34](https://github.com/rustrak/rustrak/pull/34) [`54efbba`](https://github.com/rustrak/rustrak/commit/54efbba72d56130d3d3b987faf9b829c6041ab3e) Thanks [@AbianS](https://github.com/AbianS)! - chore: update dependencies

## 0.1.8

### Patch Changes

- [#23](https://github.com/rustrak/rustrak/pull/23) [`169dc0c`](https://github.com/rustrak/rustrak/commit/169dc0ce73fee276b169f403daa0ed4a00404726) Thanks [@AbianS](https://github.com/AbianS)! - feat: system alert

## 0.1.7

### Patch Changes

- [`931d8c9`](https://github.com/rustrak/rustrak/commit/931d8c96d86354ec8069ce317eef3a4426ca8cac) Thanks [@AbianS](https://github.com/AbianS)! - fix: video source github pages

## 0.1.6

### Patch Changes

- [`17291c5`](https://github.com/rustrak/rustrak/commit/17291c54ed7e41f9577588aeef29107194186199) Thanks [@AbianS](https://github.com/AbianS)! - fix: favicon

## 0.1.5

### Patch Changes

- [`433921b`](https://github.com/rustrak/rustrak/commit/433921b77a864f6974f467bc932fd943a6b908e1) Thanks [@AbianS](https://github.com/AbianS)! - fix: docs installation

## 0.1.4

### Patch Changes

- [`8a3cf61`](https://github.com/rustrak/rustrak/commit/8a3cf618d6d2cd48dbdbab4fa62cc2b8c53e4e22) Thanks [@AbianS](https://github.com/AbianS)! - fix: css

## 0.1.3

### Patch Changes

- [`1d9438d`](https://github.com/rustrak/rustrak/commit/1d9438d83f35ffe8460d7399ccc1d4c58d6b0b3a) Thanks [@AbianS](https://github.com/AbianS)! - chore: publish docs

## 0.1.2

### Patch Changes

- [`2f7a450`](https://github.com/rustrak/rustrak/commit/2f7a450263e2fc3357c5cda614e24774810fa373) Thanks [@AbianS](https://github.com/AbianS)! - chore: second version

## 0.1.1

### Patch Changes

- [`08a1262`](https://github.com/rustrak/rustrak/commit/08a12627dbdf1a044d3a66b25b1ee113583f57f8) Thanks [@AbianS](https://github.com/AbianS)! - chore: first version
