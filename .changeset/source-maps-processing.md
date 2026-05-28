---
"@rustrak/server": minor
"@rustrak/client": minor
"webview-ui": patch
"docs": patch
---

Add source map upload and stack frame rewriting support.

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

- Fix breadcrumb rendering — level badge and message display corrected after PR #89 review
- Fix event display — improved titles, tags layout, and breadcrumb columns in event detail view

## docs

- New `/usage/source-maps` page with upload guide and environment setup
- Blog post: "Source Maps in Rust" covering the implementation approach
- Updated environment reference with source map related config
