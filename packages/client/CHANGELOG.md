# @rustrak/client

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
