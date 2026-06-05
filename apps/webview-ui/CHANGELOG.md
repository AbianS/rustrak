# webview-ui

## 0.2.5

### Patch Changes

- [`5a0854b`](https://github.com/rustrak/rustrak/commit/5a0854bfd62e1e7e7267b89de248bfab40707b4c) Thanks [@AbianS](https://github.com/AbianS)! - chore: migrate repository to rustrak GitHub organization and Docker Hub

- Updated dependencies [[`5a0854b`](https://github.com/rustrak/rustrak/commit/5a0854bfd62e1e7e7267b89de248bfab40707b4c)]:
  - @rustrak/client@0.2.1

## 0.2.4

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

- Updated dependencies [[`fd768de`](https://github.com/rustrak/rustrak/commit/fd768de0816ba6eeeaa26ed8893d82bd6224fd2b)]:
  - @rustrak/client@0.2.0

## 0.2.3

### Patch Changes

- Updated dependencies [[`6a8b860`](https://github.com/rustrak/rustrak/commit/6a8b860eda0fa199a31089e295a102aef3da6122)]:
  - @rustrak/client@0.1.3

## 0.2.2

### Patch Changes

- Updated dependencies [[`40ba761`](https://github.com/rustrak/rustrak/commit/40ba76136d2c455fc22fcc1b99850eb3d29769bd)]:
  - @rustrak/client@0.1.2

## 0.2.1

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

## 0.2.0

### Minor Changes

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

## 0.1.6

### Patch Changes

- [#44](https://github.com/rustrak/rustrak/pull/44) [`4a84415`](https://github.com/rustrak/rustrak/commit/4a84415d867b5a1f15f11006278527671d62b242) Thanks [@AbianS](https://github.com/AbianS)! - Upgrade all dependencies to latest versions across the monorepo.

  - TypeScript 6.0.3 + Node.js engines >=22 across all packages
  - ky 2.x migration: `prefix` (was `prefixUrl`), updated hook signatures, removed 429 from retry list to avoid `Retry-After` sleep
  - lucide-react 1.x: replaced removed `Github` brand icon with inline SVG component
  - Rust: actix-web 4.13, actix-session 0.11, tokio 1.52, sqlx 0.8.6, rand 0.10 (`RngExt`), sha2 0.11 (`hex::encode`), hmac 0.13 (`KeyInit`)

- Updated dependencies [[`4a84415`](https://github.com/rustrak/rustrak/commit/4a84415d867b5a1f15f11006278527671d62b242)]:
  - @rustrak/client@0.1.1

## 0.1.5

### Patch Changes

- [#34](https://github.com/rustrak/rustrak/pull/34) [`54efbba`](https://github.com/rustrak/rustrak/commit/54efbba72d56130d3d3b987faf9b829c6041ab3e) Thanks [@AbianS](https://github.com/AbianS)! - chore: update dependencies

## 0.1.4

### Patch Changes

- [#23](https://github.com/rustrak/rustrak/pull/23) [`169dc0c`](https://github.com/rustrak/rustrak/commit/169dc0ce73fee276b169f403daa0ed4a00404726) Thanks [@AbianS](https://github.com/AbianS)! - feat: system alert

## 0.1.3

### Patch Changes

- [`17291c5`](https://github.com/rustrak/rustrak/commit/17291c54ed7e41f9577588aeef29107194186199) Thanks [@AbianS](https://github.com/AbianS)! - fix: favicon

## 0.1.2

### Patch Changes

- [`2f7a450`](https://github.com/rustrak/rustrak/commit/2f7a450263e2fc3357c5cda614e24774810fa373) Thanks [@AbianS](https://github.com/AbianS)! - chore: second version

## 0.1.1

### Patch Changes

- [`08a1262`](https://github.com/rustrak/rustrak/commit/08a12627dbdf1a044d3a66b25b1ee113583f57f8) Thanks [@AbianS](https://github.com/AbianS)! - chore: first version
