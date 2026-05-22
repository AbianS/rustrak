---
title: 'Source Map Upload & Frame Rewriting'
type: 'feature'
created: '2026-05-22'
status: 'ready-for-dev'
context:
  - 'apps/server/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Rustrak stack traces from Next.js apps show minified bundle paths (`_next/static/chunks/app-abc.js:2:33220`) that are unreadable. Sentry events include `debug_meta.images` with debug IDs pointing to source maps, but Rustrak has no upload, storage, or frame-rewriting pipeline.

**Approach:** Add four `sentry-cli`-compatible endpoints (org probe + chunk capability + chunk upload + assemble), store source map files on the filesystem (CAS layout, DB holds metadata only), run an async assembly worker, and rewrite stack frames inside the digest phase — before fingerprinting — so all stored events display human-readable file paths, line numbers, and source context.

## Boundaries & Constraints

**Always:**
- Upload URLs follow Sentry protocol: `GET /api/0/organizations/{org_slug}/`, `GET/POST /api/0/organizations/{org_slug}/chunk-upload/`, `POST /api/0/organizations/{org_slug}/artifactbundle/assemble/`. The `org_slug` path segment is accepted but ignored for auth purposes; project is resolved exclusively from the `"projects"` array in the assemble request body.
- `GET /api/0/organizations/{org_slug}/` MUST return a valid JSON object (not 404) for any slug — sentry-cli validates this endpoint before uploading and exits early on 404.
- Capability response `accept` array MUST include both `"artifact_bundles"` and `"artifact_bundles_v2"` — required for sentry-cli v3+ pre-flight.
- `normalize_sentry_position(lineno, colno)` MUST use `saturating_sub(1)` for lineno — NEVER plain `-1`. Return `None` when `lineno` is `None` or `Some(0)` (both mean "unmapped" in Sentry protocol). `0u32 - 1` wraps to `u32::MAX` in release mode and returns a bogus-but-plausible token — a silent correctness bug.
- Tokens where `token.get_src_line() == u32::MAX` are unmapped — leave the original frame untouched.
- `source_file_metadata` scoped by `project_id` — project A's maps must never apply to project B's events.
- Use `sourcemap = "8"` (getsentry/rust-sourcemap) for all JS map parsing.
- Upload endpoints use `BearerAuth` extractor (same as all other API routes).
- `chunk` DB rows are temporary — delete after successful assembly.
- Frame-rewriting errors are non-fatal in digest: `log::warn!` and continue without rewriting.
- **All implementation follows TDD using the `/tdd` skill** — tests are written before production code for every task. No task is done without its tests passing.
- Both backends supported: PostgreSQL uses native `UUID`, `BYTEA`, `TIMESTAMPTZ`, `gen_random_uuid()`, `assembly_state` enum, and `BIGSERIAL`. SQLite uses `TEXT` for UUIDs (generated in Rust via `Uuid::new_v4()`), `BLOB` for binary data, `TEXT NOT NULL DEFAULT (datetime('now'))` for timestamps, `TEXT CHECK(state IN (...))` for enums, `TEXT` (JSON-encoded) for arrays, and `INTEGER` for IDs.
- Source map file contents stored on filesystem (CAS layout). DB holds checksum, size, and `storage_path` only — no `BYTEA`/`BLOB` for assembled files. (sqlx has no streaming reads; 50 MB BYTEA = 50 MB heap per read.)
- Assembly is **async**: HTTP returns `200 {"state": "created"}` immediately; `AssemblyWorker` background task polls `assembly_jobs`.
- ZIP extraction MUST use `zip = "2.3"` minimum — CVE-2025-29787 (symlink path traversal) affects all versions ≤ 2.2.x. Additionally check `entry.is_symlink()` and canonicalize + prefix-verify every extracted path.
- Chunk data stored in DB (`BYTEA`/`BLOB`) during upload only; bounded by `MAX_CHUNK_SIZE_BYTES` (default 10 MB, env var override). Temporary — deleted after assembly.
- `SourceMapProvider` trait required for `rewrite_frames` to be unit-testable without a real DB or filesystem.
- `SourceMapStore` trait required to decouple `LocalSourceMapStore` (filesystem) from future S3/GCS adapters.
- CI matrix: both `--features postgres` and `--features sqlite` must pass before merge.
- sourcesContent lookup MUST use `token.get_source()` + linear search to find the correct index — NEVER assume `sourcesContent[0]`. Next.js bundles contain dozens of sources per chunk; the wrong-index bug silently shows code from the wrong file.

**Ask First:**
- If `CHUNK_SIZE` or `MAX_REQUEST_SIZE` values need to differ from defaults (2 MB / 32 MB).
- If S3/GCS storage is needed alongside filesystem (out of scope; `SourceMapStore` trait makes it addable without breaking changes).

**Never:**
- No display-time / per-request frame rewriting — rewrite once at digest, store permanently.
- No legacy release-based source maps (URL matching without debug IDs).
- No `BYTEA`/`BLOB` for assembled source map file contents in the database.
- No `0u32 - 1` arithmetic on lineno — always `saturating_sub`.

## I/O & Edge-Case Matrix

### Happy Path

| Scenario | Input | Expected Behavior |
|---|---|---|
| Org probe | `GET /api/0/organizations/{org}/` | `200 {"slug": org, "name": org, "id": "1", "features": ["artifact-bundles", "artifact-bundles-v2"]}` for any slug |
| Chunk capability | `GET /api/0/organizations/{org}/chunk-upload/` | Capability JSON with `chunkSize`, `chunksPerRequest`, `accept` including `artifact_bundles_v2` |
| sentry-cli v3 pre-flight | `POST assemble` before chunks uploaded | `202 {"state": "not_found", "missingChunks": [all checksums]}` |
| Chunk upload | `POST chunk-upload` multipart, `file` fields named by SHA1 | `200`; chunk rows upserted |
| Assembly trigger | `POST assemble` after all chunks present | `200 {"state": "created", "missingChunks": []}` — job enqueued |
| sentry-cli polls assembling | `POST assemble` while worker is running | `200 {"state": "assembling", "missingChunks": []}` |
| Assembly complete | `POST assemble` after worker finishes | `200 {"state": "ok", "missingChunks": []}` |
| Duplicate upload | Same bundle uploaded again (all chunks already present + job complete) | `200 {"state": "ok", "missingChunks": []}` — idempotent |
| Frame rewrite hit | Event digested; debug_id in `source_file_metadata` for project | Frame updated: `filename`, `lineno`, `function`, `context_line`, `pre_context`, `post_context` |
| List source maps | `GET /api/0/projects/{org}/{proj}/files/source-maps/` | Paginated list with `debugId`, `fileType`, `size`, `timesUsed`, `dateUploaded` |

### Risk / Edge Cases

| Scenario | Input | Expected Behavior | Error Handling |
|---|---|---|---|
| Chunk too large | Field body > `MAX_CHUNK_SIZE_BYTES` | `400 {"detail": "chunk too large: X bytes exceeds limit Y"}` | Reject without buffering remaining bytes |
| Checksum mismatch | SHA1(joined chunks) ≠ bundle checksum | `400 {"state": "error", "detail": "checksum mismatch: expected X, got Y"}` | Assembly job not created |
| ZIP path traversal | Entry path contains `../` after join | Assembly job → `error` state | Canonicalize + prefix check; reject entire ZIP |
| ZIP symlink (CVE-2025-29787) | Entry is a symlink | Assembly job → `error` state | `zip ≥ 2.3` + `entry.is_symlink()` guard |
| `lineno = 0` | Frame with `lineno: 0` | Frame left unchanged | `normalize_sentry_position` returns `None` for `0` |
| `lineno = None` | Frame with no `lineno` | Frame left unchanged | `normalize_sentry_position` returns `None` |
| Unmapped token | `token.get_src_line() == u32::MAX` | Frame left unchanged | Guard before rewriting |
| Multi-source map | `.js.map` has 20 sources; frame → source #15 | `context_line` from `sourcesContent[15]`, not `[0]` | Linear search via `token.get_source()` |
| Frame rewrite miss | `debug_id` not in DB for this project | Original frame unchanged | Non-fatal |
| File missing on disk | DB row exists but file deleted | `warn!`, leave frame unchanged | Non-fatal |
| Worker crash mid-assembly | Job stuck in `assembling` | On restart: reset `assembling` jobs with `locked_until < NOW()` to `created` | Up to `max_retries` attempts, then `error` |
| Cross-project contamination | Project B event; project A has same `debug_id` | Project B frames NOT rewritten | `WHERE project_id = $1` scope |
| `not_found` + empty missingChunks | sentry-cli v3 probe | sentry-cli interprets as "upload everything" — respond with all chunk checksums as missing | Return full list in `missingChunks` |
| Org not in DB | sentry-cli `GET /organizations/{org}/` | Return synthetic `200` for any org slug | No DB lookup needed |
| `projects[0]` slug not found | POST assemble with unknown project slug | `404 {"detail": "project not found"}` | Look up in `projects WHERE slug = $1` |

</frozen-after-approval>

## Code Map

### New Files

- `apps/server/migrations/postgres/20260522000000_source_maps.up.sql` — `chunk`, `source_file`, `source_file_metadata`, `assembly_jobs` tables + `assembly_state` enum
- `apps/server/migrations/postgres/20260522000000_source_maps.down.sql` — rollback in reverse FK order
- `apps/server/migrations/sqlite/20260522000000_source_maps.up.sql` — same 4 tables with SQLite-compatible types
- `apps/server/migrations/sqlite/20260522000000_source_maps.down.sql` — SQLite rollback
- `apps/server/src/models/source_file.rs` — `Chunk`, `SourceFile`, `SourceFileMetadata`, `AssemblyJob` with `FromRow` + `Serialize`
- `apps/server/src/services/sourcemap_store.rs` — `SourceMapStore` trait + `LocalSourceMapStore` (CAS filesystem, atomic writes via `tempfile`)
- `apps/server/src/services/sourcemap.rs` — `SourceMapProvider` trait, `normalize_sentry_position()`, `get_missing_chunks()`, `store_chunks()`, `assemble_bundle()`, `rewrite_frames()`
- `apps/server/src/routes/sourcemaps.rs` — 5 handlers + `configure(cfg)`
- `apps/server/src/workers/sourcemap_assembly.rs` — `AssemblyWorker` polling `assembly_jobs` with CTE claim + restart recovery

### Modified Files

- `apps/server/src/models/mod.rs` — add `pub mod source_file`
- `apps/server/src/services/mod.rs` — add `pub mod sourcemap_store`, `pub mod sourcemap`
- `apps/server/src/routes/mod.rs` — add `pub mod sourcemaps`
- `apps/server/src/workers/mod.rs` — add `pub mod sourcemap_assembly` (create `workers/mod.rs` if absent)
- `apps/server/src/main.rs` — register `.configure(routes::sourcemaps::configure)` in Bearer-auth scope; spawn `AssemblyWorker`
- `apps/server/src/digest/worker.rs` — call `services::sourcemap::rewrite_frames()` after JSON parse, before `calculate_grouping_key()`
- `apps/server/Cargo.toml` — add `sourcemap = "8"`, `zip = "2.3"`, `actix-multipart = "0.7"`, `tempfile = "3"`, `async-trait = "0.1"`
- `apps/server/Dockerfile` — add `RUN mkdir -p /data/sourcemaps` + `VOLUME /data/sourcemaps`
- `docker-compose.yml` — add `sourcemap-data` named volume, mount at `/data/sourcemaps`

## Tasks & Acceptance

**Execution order:** Migrations → Models → Store → Service → Routes → Worker → Digest → Config

---

### T1 — PostgreSQL Migration
**File:** `apps/server/migrations/postgres/20260522000000_source_maps.up.sql`

```sql
CREATE TYPE assembly_state AS ENUM ('not_found', 'created', 'assembling', 'ok', 'error');

CREATE TABLE chunk (
    checksum   CHAR(40) PRIMARY KEY,
    size       INT NOT NULL,
    data       BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE source_file (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checksum     CHAR(40) UNIQUE NOT NULL,
    size         INT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE source_file_metadata (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    debug_id   UUID NOT NULL,
    file_type  TEXT NOT NULL,
    file_id    UUID NOT NULL REFERENCES source_file(id) ON DELETE CASCADE,
    times_used INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, debug_id, file_type)
);
CREATE INDEX idx_sfm_lookup ON source_file_metadata(project_id, debug_id);

CREATE TABLE assembly_jobs (
    id              BIGSERIAL PRIMARY KEY,
    bundle_checksum CHAR(40) NOT NULL,
    project_id      INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chunks          TEXT[] NOT NULL,
    state           assembly_state NOT NULL DEFAULT 'created',
    detail          TEXT,
    locked_until    TIMESTAMPTZ,
    worker_id       TEXT,
    retry_count     INT NOT NULL DEFAULT 0,
    max_retries     INT NOT NULL DEFAULT 3,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bundle_checksum, project_id)
);
```

**Down:** `DROP TABLE IF EXISTS assembly_jobs; DROP TABLE IF EXISTS source_file_metadata; DROP TABLE IF EXISTS source_file; DROP TABLE IF EXISTS chunk; DROP TYPE IF EXISTS assembly_state;`

---

### T2 — SQLite Migration
**File:** `apps/server/migrations/sqlite/20260522000000_source_maps.up.sql`

Same 4 tables with: `BLOB` for `data`, `TEXT` for UUID fields, `TEXT NOT NULL DEFAULT (datetime('now'))` for timestamps, `INTEGER` for IDs/sizes, `TEXT NOT NULL DEFAULT 'created' CHECK(state IN ('not_found','created','assembling','ok','error'))` for state, `TEXT NOT NULL DEFAULT '[]'` for chunks array (JSON-encoded string, decoded in Rust).

**Down:** same drop order as PostgreSQL.

---

### T3 — Models
**File:** `apps/server/src/models/source_file.rs`

```rust
#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct Chunk {
    pub checksum: String,
    pub size: i32,
    pub data: Vec<u8>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct SourceFile {
    pub id: uuid::Uuid,
    pub checksum: String,
    pub size: i32,
    pub storage_path: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct SourceFileMetadata {
    pub id: uuid::Uuid,
    pub project_id: i32,
    pub debug_id: uuid::Uuid,
    pub file_type: String,
    pub file_id: uuid::Uuid,
    pub times_used: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct AssemblyJob {
    pub id: i64,
    pub bundle_checksum: String,
    pub project_id: i32,
    // TEXT[] in PG (Vec<String> via FromRow); TEXT in SQLite (JSON-encoded, needs Json wrapper).
    // sqlx does NOT auto-decode JSON from TEXT in SQLite — plain Vec<String> will panic at runtime.
    #[cfg(feature = "postgres")]
    pub chunks: Vec<String>,
    #[cfg(not(feature = "postgres"))]
    pub chunks: sqlx::types::Json<Vec<String>>,
    pub state: String,
    pub detail: Option<String>,
    pub locked_until: Option<chrono::DateTime<chrono::Utc>>,
    pub worker_id: Option<String>,
    pub retry_count: i32,
    pub max_retries: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl AssemblyJob {
    /// Backend-agnostic accessor — use this everywhere instead of `.chunks` directly.
    pub fn chunk_list(&self) -> &[String] {
        #[cfg(feature = "postgres")]
        return &self.chunks;
        #[cfg(not(feature = "postgres"))]
        return &self.chunks.0;
    }
}
```

Add `pub mod source_file;` to `models/mod.rs`.

---

### T4 — SourceMapStore
**File:** `apps/server/src/services/sourcemap_store.rs`

```rust
#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("not found: {0}")]
    NotFound(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

#[async_trait::async_trait]
pub trait SourceMapStore: Send + Sync + 'static {
    async fn put(&self, key: &str, data: bytes::Bytes) -> Result<(), StoreError>;
    async fn get(&self, key: &str) -> Result<bytes::Bytes, StoreError>;
    async fn exists(&self, key: &str) -> Result<bool, StoreError>;
    async fn delete(&self, key: &str) -> Result<(), StoreError>;
}
```

**`LocalSourceMapStore`:**
- `base_path: PathBuf` from `SOURCEMAP_STORAGE_PATH` env var (default: `/data/sourcemaps`)
- CAS layout: `{base}/{key[0..2]}/{key[2..]}.map`
- `put`: create shard dir if needed; write via `tempfile::Builder::new().tempfile_in(shard_dir)?.persist(dest_path)?` (atomic); if dest already exists, skip (idempotent dedup)
- `get`: read file to `Bytes`; return `StoreError::NotFound` if missing
- `exists`: `path.exists()`
- `delete`: `fs::remove_file(path)` if exists; no-op if not

TDD tests: `put` + `get` roundtrip, `put` idempotency (no double-write), `get` on missing key returns `NotFound`, path traversal in key (key with `/` or `..`) panics or returns `Io` error.

---

### T5 — Sourcemap Service
**File:** `apps/server/src/services/sourcemap.rs`

**`SourceMapProvider` trait:**
```rust
pub struct SourceMapEntry {
    pub data: bytes::Bytes,
}

#[async_trait::async_trait]
pub trait SourceMapProvider: Send + Sync {
    async fn fetch_sourcemap(
        &self,
        project_id: i32,
        debug_id: &str,
        file_type: &str,
    ) -> AppResult<Option<SourceMapEntry>>;
}
```

The concrete `DbSourceMapProvider` holds `pool: DbPool` + `store: Arc<dyn SourceMapStore>`:
1. Query `source_file_metadata WHERE project_id=$1 AND debug_id=$2 AND file_type=$3`
2. If found: join with `source_file`, call `store.get(&sf.storage_path)` → return `SourceMapEntry`
3. Also `UPDATE source_file_metadata SET times_used = times_used + 1 WHERE id = $4`

---

**`normalize_sentry_position`:**
```rust
pub fn normalize_sentry_position(
    lineno: Option<u32>,
    colno: Option<u32>,
) -> Option<(u32, u32)> {
    match lineno {
        None | Some(0) => None,
        Some(l) => Some((l.saturating_sub(1), colno.unwrap_or(0))),
    }
}
```

---

**`get_missing_chunks`:**
```rust
// Returns checksums from the INPUT list that are NOT present in DB
pub async fn get_missing_chunks(pool: &DbPool, checksums: &[String]) -> AppResult<Vec<String>>
```
- If empty input: return `Ok(vec![])`
- PostgreSQL (`#[cfg(feature = "postgres")]`): `SELECT checksum FROM chunk WHERE checksum = ANY($1)` → compute set difference
- SQLite (`#[cfg(not(feature = "postgres"))]`): build `SELECT checksum FROM chunk WHERE checksum IN (?,?,...)` via `sqlx::QueryBuilder`, push each checksum → compute set difference

---

**`store_chunks`:**
```rust
pub async fn store_chunks(pool: &DbPool, parts: Vec<(String, Vec<u8>)>) -> AppResult<()>
```
- For each `(sha1, bytes)`: validate `bytes.len() <= MAX_CHUNK_SIZE_BYTES` → 400 if exceeded
- `INSERT INTO chunk(checksum, size, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`

---

**`assemble_bundle`:**
```rust
pub async fn assemble_bundle(
    pool: &DbPool,
    store: &dyn SourceMapStore,
    project_id: i32,
    bundle_checksum: &str,
    chunk_checksums: &[String],
) -> AppResult<()>
```
1. Fetch all chunk rows in order of `chunk_checksums`; join `data` bytes sequentially
2. Compute SHA1 of joined bytes; compare with `bundle_checksum` → `AppError::BadRequest("checksum mismatch: expected X, got Y")` if different
3. Write joined bytes to a temp file; open as `ZipArchive`
4. Validate each entry: `entry.is_symlink()` → skip; join entry name with temp dest dir to get `dest`. **Do NOT use `canonicalize()` — the file does not exist yet, so it fails and the fallback to raw dest defeats the traversal check.** Instead, resolve `..` components manually:
   ```rust
   use std::path::Component;
   let dest = temp_dir.join(file.name());
   let mut resolved = PathBuf::from(&temp_dir);
   for component in dest.components() {
       match component {
           Component::ParentDir => { resolved.pop(); }
           Component::Normal(c) => resolved.push(c),
           _ => {}
       }
   }
   if !resolved.starts_with(&temp_dir) {
       return Err(AppError::BadRequest("path traversal in archive".into()));
   }
   ```
   Extract to `resolved`, not to `dest`.
5. Parse `manifest.json`: locate files array with headers
6. For each source map entry: read bytes → `sha1_hex` → `store.put(sha1_hex, bytes)` → then **two separate queries** to get the `source_file.id`:
   ```sql
   -- Query A: insert (idempotent; ON CONFLICT DO NOTHING does NOT return id on conflict)
   INSERT INTO source_file(id, checksum, size, storage_path)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT(checksum) DO NOTHING;

   -- Query B: always fetch (works whether just inserted or pre-existing)
   SELECT id FROM source_file WHERE checksum = $1;
   ```
   Then upsert `source_file_metadata(project_id, debug_id, file_type, file_id)` ON CONFLICT DO NOTHING.
   **Do NOT use `ON CONFLICT DO NOTHING RETURNING id`** — it returns NULL on conflict, causing a runtime panic.
7. Read debug_id header: `let Some(debug_id_str) = headers.get("debug-id").or_else(|| headers.get("debug_id")) else { continue; }`. **Skip entries without a debug-id header** — no guard means an unwrap on None panics or inserts a NULL UUID into the DB. Read `file_type` from the manifest entry's `type` field (e.g. `"source_map"` for `.js.map` files, `"minified_source"` for `.js` files). **Use the `type` field value verbatim** — do NOT hardcode; `rewrite_frames` queries with `file_type = "source_map"` so assemble_bundle must insert that exact string for `.js.map` entries.
8. Delete chunk rows: `DELETE FROM chunk WHERE checksum = ANY($1)` (PostgreSQL) / dynamic IN for SQLite
9. Wrap steps 1-8 in a DB transaction; store writes can be outside transaction (idempotent CAS)

---

**`rewrite_frames`:**
```rust
pub async fn rewrite_frames(
    provider: &dyn SourceMapProvider,
    project_id: i32,
    event_data: &mut serde_json::Value,
) -> AppResult<()>
```
1. Read `debug_meta.images` → build `HashMap<code_file, debug_id_str>`. Each image object has `code_file` (the bundled JS filename matching `frame.filename`, e.g. `_next/static/chunks/app-abc.js`) and `debug_id`. Skip images missing either field. Build: `images.iter().filter_map(|img| Some((img["code_file"].as_str()?.to_string(), img["debug_id"].as_str()?.to_string()))).collect::<HashMap<_,_>>()`.
2. Get frames from `exception.values[*].stacktrace.frames`
3. For each frame:
   a. Extract `filename`, `lineno: Option<u32>`, `colno: Option<u32>`
   b. Resolve `debug_id` from map; skip if none
   c. Call `provider.fetch_sourcemap(project_id, &debug_id, "source_map")` → skip if `None`. **`file_type` is `"source_map"` — the string sentry-cli writes in the manifest for `.js.map` files. NOT `"minified"` (that is the `.js` file type). Using the wrong value here means `fetch_sourcemap` always returns `None` and no frames are ever rewritten.**
   d. Parse with `sourcemap::SourceMap::from_reader(Cursor::new(&entry.data))` → `warn!` and skip on parse error
   e. `normalize_sentry_position(lineno, colno)` → skip frame if `None`. **Use `let Some(...) else { continue }` pattern — NOT `?` operator.** `normalize_sentry_position` returns `Option`, not `Result`; `?` on `Option` in an `AppResult<()>` context does not compile in Rust stable.
   f. `sm.lookup_token(norm_lineno, norm_colno)` → skip if `None`
   g. If `token.get_src_line() == u32::MAX` → skip (unmapped)
   h. `original_file = token.get_source().unwrap_or("")`
   i. `source_idx = (0..sm.get_source_count()).find(|&i| sm.get_source(i) == Some(original_file))`
   j. `lines: Vec<&str> = source_idx.and_then(|i| sm.get_source_contents(i)).map(|s| s.lines().collect()).unwrap_or_default()`
   k. Rewrite frame fields:
      ```rust
      let l = token.get_src_line() as usize;
      // pre_context: saturating_sub required — l can be 0 for tokens at file start
      let pre_start = l.saturating_sub(3);
      frame["filename"] = original_file.into();
      frame["lineno"] = (token.get_src_line() + 1).into();  // back to 1-indexed
      frame["function"] = token.get_name().unwrap_or(existing_function).into();
      frame["context_line"] = lines.get(l).copied().unwrap_or("").into();
      frame["pre_context"] = lines[pre_start..l].to_vec().into();
      frame["post_context"] = lines[l+1..lines.len().min(l+4)].to_vec().into();
      ```
   l. Per-frame errors: `warn!` and continue (never abort the whole event)

TDD tests (required, all via `FakeSourceMapProvider`):
- `test_rewrite_hit` — debug_id matches, frame gets new filename/lineno/context_line
- `test_rewrite_miss` — debug_id not in DB, frame unchanged
- `test_rewrite_unmapped_token` — `src_line == u32::MAX`, frame unchanged
- `test_rewrite_lineno_zero` — `lineno: 0`, frame unchanged (AC8)
- `test_rewrite_lineno_none` — no `lineno` field, frame unchanged
- `test_rewrite_multi_source` — map with 20 sources, frame maps to source #15, `context_line` from `sourcesContent[15]` (AC9)
- `test_rewrite_cross_project` — provider returns `None` for wrong project_id, frame unchanged (AC5)
- `test_rewrite_null_sourcescontent_entry` — `sourcesContent[idx]` is JSON `null` → `context_line` absent, no panic
- `test_rewrite_parse_error` — corrupt source map bytes → `warn!`, frame unchanged, function returns `Ok(())`

---

### T6 — Routes
**File:** `apps/server/src/routes/sourcemaps.rs`

**`org_details`** — `GET /api/0/organizations/{org_slug}/`:
```json
{ "slug": "{org_slug}", "name": "{org_slug}", "id": "1", "features": ["artifact-bundles", "artifact-bundles-v2"] }
```
Always 200 — no DB lookup. (sentry-cli validates existence only.)

**`chunk_upload_capability`** — `GET /api/0/organizations/{org_slug}/chunk-upload/`:
```json
{
  "url": "{base_url}/api/0/organizations/{org_slug}/chunk-upload/",
  "chunkSize": 2097152,
  "chunksPerRequest": 64,
  "maxRequestSize": 33554432,
  "hashAlgorithm": "sha1",
  "accept": ["release_files", "sources", "artifact_bundles", "artifact_bundles_v2"]
}
```

**`chunk_upload`** — `POST /api/0/organizations/{org_slug}/chunk-upload/`:
- Parse `actix-multipart` stream field by field (sequential, streaming — never buffer all at once)
- For each `file` field: stream `Bytes` chunks, compute SHA1 inline (`sha1::Sha1::update(&chunk)`), accumulate bytes — abort with 400 if accumulated size > `MAX_CHUNK_SIZE_BYTES`
- Collect `Vec<(sha1_hex, bytes)>`, call `store_chunks(pool, parts)`
- 400 if no valid `file` parts found

**`artifact_bundle_assemble`** — `POST /api/0/organizations/{org_slug}/artifactbundle/assemble/`:
- Deserialize body: `{ "checksum": "...", "chunks": [...], "projects": ["slug"] }`
- Guard: `if body.projects.is_empty()` → `400 {"detail": "projects array must not be empty"}`
- Lookup project by `projects[0]` slug → `404 {"detail": "project not found"}` if not found
- Call `get_missing_chunks(pool, &body.chunks)` → if non-empty: `202 {"state": "not_found", "missingChunks": [...]}`
- Verify bundle checksum upfront (compute from chunks if all present) → `400 {"state": "error", "detail": "checksum mismatch: ..."}` if wrong
- `INSERT INTO assembly_jobs(bundle_checksum, project_id, chunks, state) VALUES (...) ON CONFLICT DO NOTHING RETURNING *` + `fetch_optional`
  - If `None` (conflict — job already exists): fetch existing row with `SELECT * FROM assembly_jobs WHERE bundle_checksum=$1 AND project_id=$2`
- Map job state to response (applies to both newly-created and fetched-existing):
  - `ok` → `200 {"state": "ok", "missingChunks": []}`
  - `error` → **`400 {"state": "error", "detail": job.detail.unwrap_or_default()}`** — return error directly, do NOT reset or reinserting the job
  - `created` / `assembling` / `not_found` → `200 {"state": job.state, "missingChunks": []}`

**`list_source_maps`** — `GET /api/0/projects/{org_slug}/{project_slug}/files/source-maps/`:
- Lookup project by `project_slug`; join `source_file_metadata` + `source_file`
- Response: `{"data": [{"debugId": "...", "fileType": "...", "size": N, "timesUsed": N, "dateUploaded": "..."}]}`

**`configure(cfg)`** — wire all five handlers. `org_details` + chunk routes under `/api/0/organizations/{org_slug}/`. List route under `/api/0/projects/{org_slug}/{project_slug}/`.

---

### T7 — Assembly Worker
**File:** `apps/server/src/workers/sourcemap_assembly.rs`

```rust
pub struct AssemblyWorker {
    pool: DbPool,
    store: Arc<dyn SourceMapStore>,
    worker_id: String,  // uuid string for lock ownership
}
```

`AssemblyWorker::run()`:

**On startup (restart recovery):**
```sql
UPDATE assembly_jobs
SET state = 'created', locked_until = NULL, worker_id = NULL, updated_at = NOW()
WHERE state = 'assembling' AND locked_until < NOW()
```

**Poll loop** (every 1 second via `tokio::time::interval`):

Claim job (PostgreSQL):
```sql
WITH candidate AS (
    SELECT id FROM assembly_jobs
    WHERE state = 'created' AND retry_count < max_retries
    ORDER BY created_at LIMIT 1
    FOR UPDATE SKIP LOCKED
)
UPDATE assembly_jobs
SET state = 'assembling',
    worker_id = $1,
    locked_until = NOW() + INTERVAL '2 minutes',
    updated_at = NOW()
FROM candidate
WHERE assembly_jobs.id = candidate.id
RETURNING assembly_jobs.*
```

SQLite: no `FOR UPDATE SKIP LOCKED`; use a `tokio::sync::Mutex<()>` to serialize worker access (single-worker mode).

On success:
```sql
UPDATE assembly_jobs SET state = 'ok', detail = NULL, updated_at = NOW() WHERE id = $1
```

On error:
```sql
UPDATE assembly_jobs
SET state = CASE WHEN retry_count + 1 >= max_retries THEN 'error' ELSE 'created' END,
    retry_count = retry_count + 1,
    detail = $2,
    locked_until = NULL,
    updated_at = NOW()
WHERE id = $1
```

Spawn in `main.rs` via `tokio::spawn(worker.run())` (not `actix_rt::spawn` — worker outlives request scope).

---

### T8 — Digest Integration
**File:** `apps/server/src/digest/worker.rs`

`process_event` is a **free function** (not a struct method). Add `sourcemap_provider: Arc<dyn SourceMapProvider>` as a new parameter — **do not refactor to a struct**:

```rust
pub async fn process_event(
    pool: DbPool,
    metadata: EventMetadata,
    ingest_dir: PathBuf,
    rate_limit_config: RateLimitConfig,
    sourcemap_provider: Arc<dyn SourceMapProvider>,   // ← new parameter
) -> Result<(), DigestError>
```

After `let mut event_data: serde_json::Value = serde_json::from_str(&raw_json)?` and before `calculate_grouping_key(&event_data)`:
```rust
if let Err(e) = services::sourcemap::rewrite_frames(
    sourcemap_provider.as_ref(),
    metadata.project_id,
    &mut event_data,
).await {
    log::warn!("source map rewriting failed for event {}: {:?}", metadata.event_id, e);
}
```

**Wiring in `main.rs`:**
```rust
let sourcemap_provider: Arc<dyn SourceMapProvider> = Arc::new(
    DbSourceMapProvider::new(pool.clone(), Arc::clone(&sourcemap_store))
);
// Add to app data:
.app_data(web::Data::new(Arc::clone(&sourcemap_provider)))
```

**Wiring in `routes/ingest.rs`** (where `tokio::spawn(process_event(...))` is called):
```rust
let provider = data.get::<web::Data<Arc<dyn SourceMapProvider>>>()
    .expect("SourceMapProvider not registered")
    .clone();
tokio::spawn(process_event(pool, metadata, ingest_dir, rate_config, Arc::clone(&provider)));
```

---

### T9 — Dependencies
**File:** `apps/server/Cargo.toml`

```toml
[dependencies]
sourcemap = "8"
zip = "2.3"          # CVE-2025-29787 fixed in 2.3+; DO NOT lower this version
actix-multipart = "0.7"
tempfile = "3"
async-trait = "0.1"
sha1 = "0.10"        # for chunk upload SHA1 verification
```

---

### T10 — Docker & Config
**File:** `apps/server/Dockerfile`
```dockerfile
RUN mkdir -p /data/sourcemaps
VOLUME /data/sourcemaps
```

**File:** `docker-compose.yml`
```yaml
services:
  server:
    volumes:
      - sourcemap-data:/data/sourcemaps
    environment:
      - SOURCEMAP_STORAGE_PATH=/data/sourcemaps
      - MAX_CHUNK_SIZE_BYTES=10485760

volumes:
  sourcemap-data:
```

---

### T11 — GC Worker (optional, post-MVP)
**File:** `apps/server/src/workers/sourcemap_gc.rs`

Daily `tokio::time::interval(Duration::from_secs(86400))` loop:
1. Find `chunk` rows with `created_at < NOW() - INTERVAL '1 hour'` → delete (orphaned from failed assemblies)
2. Find `source_file` rows with no referencing `source_file_metadata` AND `created_at < NOW() - INTERVAL '90 days'` → delete file from disk → delete DB row

*Note: Defer T11 until after T1–T10 are complete and tested.*

---

## Acceptance Criteria

- **AC1** — Given `@sentry/nextjs` with `SENTRY_URL` + `SENTRY_AUTH_TOKEN` pointing at Rustrak, when `next build` runs, source maps upload without errors and `source_file_metadata` rows appear scoped to the correct `project_id`.
- **AC2** — Given source maps stored for a project, when a Next.js error is digested, the stored event JSON (in `events.data`) has the following fields rewritten on each mapped frame: `filename` changed from `_next/static/chunks/...` to the original source path (e.g. `src/app/page.tsx`), `lineno` changed to the original 1-indexed line number in that file, and `context_line` set to a non-empty string containing the source line at that position.
- **AC3** — Given the same artifact bundle uploaded twice, `source_file` row count does not increase (SHA1 dedup).
- **AC4** — Given a frame with no matching source map in DB, the frame is stored with original minified values (no crash, no panic).
- **AC5** — Given source maps for project A and an event from project B with the same `debug_id`, project B's frames are not rewritten.
- **AC6** — Given a ZIP with a `../../../etc/passwd` path entry, assembly returns `{"state": "error"}` and no file is written outside the temp dir.
- **AC7** — Given the assembly worker crashes mid-job, on server restart: (1) `assembly_jobs` rows with `state = 'assembling'` and `locked_until < NOW()` are reset to `state = 'created'`; (2) the job is retried; (3) after `max_retries` (default `3`) total attempts, `assembly_jobs.state = 'error'` and `assembly_jobs.detail` contains the last error message; (4) subsequent `POST assemble` for the same bundle returns `400 {"state": "error", "detail": "..."}`.
- **AC8** — Given an event frame with `lineno: 0`, the frame is left unchanged (no `u32::MAX` wraparound).
- **AC9** — Given a `.js.map` with 20 sources and a frame mapping to source #15, `context_line` comes from `sourcesContent[15]` not `[0]`.
- **AC10** — All tests pass for both `--features postgres` and `--features sqlite`.

## Design Notes

**Org slug for sentry-cli compatibility:** sentry-cli issues `GET /api/0/organizations/{org}/` before any upload to validate the org exists. Return a synthetic 200 for any slug (no DB lookup needed). The meaningful project resolution happens in the assemble body via `projects[0]`.

**Assembly is async, not sync:** sentry-cli polls `POST assemble` at 1-second intervals for up to 5 minutes. Responding `{"state": "created"}` or `{"state": "assembling"}` while the background worker runs is fully protocol-compliant. Synchronous assembly would block an Actix worker thread.

**CAS storage layout:** `{base}/{sha1[0:2]}/{sha1[2:]}.map` mirrors git's object store. Content-addressable by definition — `put` is idempotent, dedup is automatic, no extra bookkeeping.

**Correct `sourcesContent` lookup:**
```rust
// normalize_sentry_position returns Option, NOT Result.
// Use 'let Some ... else { continue }' — NOT '?' — inside rewrite_frames (AppResult context).
let Some((norm_lineno, norm_colno)) = normalize_sentry_position(frame_lineno, frame_colno) else {
    continue; // lineno was None or 0 — leave frame untouched
};
let Some(token) = sm.lookup_token(norm_lineno, norm_colno) else {
    continue; // outside map bounds
};
if token.get_src_line() == u32::MAX {
    continue; // unmapped token
}
let original_file = token.get_source().unwrap_or("");
let source_idx = (0..sm.get_source_count())
    .find(|&i| sm.get_source(i) == Some(original_file));
let lines: Vec<&str> = source_idx
    .and_then(|i| sm.get_source_contents(i))
    .map(|s| s.lines().collect())
    .unwrap_or_default();
// Note: sourcesContent entries can be null in the JSON — .get_source_contents() returns None for null.
// This is handled correctly by .unwrap_or_default() → empty lines → no context_line set.
```
`sourcesContent[0]` is wrong for any real Next.js bundle (dozens of sources per chunk). Always resolve via `token.get_source()`.

**`normalize_sentry_position` full contract:**
- `None` → `None` (no lineno at all → can't look up)
- `Some(0)` → `None` (0 is Sentry's "unmapped" sentinel → don't touch)
- `Some(l)` where `l > 0` → `Some((l.saturating_sub(1), colno.unwrap_or(0)))` (1→0-indexed)
- `colno` is already 0-indexed in Sentry protocol; pass through as-is with `0` default

**manifest.json `debug-id` header:** uses a hyphen, not underscore. Parse defensively:
```rust
headers.get("debug-id").or_else(|| headers.get("debug_id"))
```

**SQLite `get_missing_chunks`:** no `ANY($1)` support; use `sqlx::QueryBuilder`:
```rust
let mut qb = QueryBuilder::new("SELECT checksum FROM chunk WHERE checksum IN (");
let mut sep = qb.separated(", ");
for c in checksums { sep.push_bind(c); }
qb.push(")");
```

**ZIP security:** `zip = "2.3"` fixes CVE-2025-29787. Additionally guard:
```rust
if file.is_symlink() { continue; }
let dest = temp_dir.join(file.name());
// Do NOT use canonicalize() — the file doesn't exist yet, so it fails.
// Falling back to the raw dest path defeats the check: Path::starts_with is
// component-based, so /tmp/abc/../../etc/passwd starts_with /tmp/abc == TRUE.
// Instead, resolve '..' manually:
use std::path::Component;
let mut resolved = PathBuf::from(&temp_dir);
for component in dest.components() {
    match component {
        Component::ParentDir => { resolved.pop(); }
        Component::Normal(c) => resolved.push(c),
        _ => {}
    }
}
if !resolved.starts_with(&temp_dir) {
    return Err(AppError::BadRequest("path traversal in archive".into()));
}
// Extract to `resolved`, not to `dest`
```

**Multipart streaming:** `actix-multipart` streams each `Field` as `Stream<Item = Result<Bytes, Error>>`. Compute SHA1 inline:
```rust
let mut hasher = sha1::Sha1::new();
let mut buf: Vec<u8> = Vec::new();
while let Some(chunk) = field.next().await {
    let data = chunk?;
    if buf.len() + data.len() > max_chunk_size {
        return Err(AppError::BadRequest(format!("chunk too large")));
    }
    hasher.update(&data);
    buf.extend_from_slice(&data);
}
let sha1_hex = hex::encode(hasher.finalize());
```
No `spawn_blocking` needed — SHA1 on 2 MB is ~1 ms.

**Concurrency model:**
- **PostgreSQL**: multi-replica safe. `FOR UPDATE SKIP LOCKED` prevents two workers from claiming the same job. Multiple server instances can run concurrently.
- **SQLite**: single-instance only. SQLite's WAL mode handles concurrent reads but not concurrent writers on `assembly_jobs`. `AssemblyWorker` uses a `tokio::sync::Mutex<()>` to serialize claims. Do NOT run more than one Rustrak process against the same SQLite database with assembly enabled.

**`SOURCEMAP_STORAGE_PATH` default:** `/data/sourcemaps`. Override via env var. The server reads this at startup and panics with a clear message if the path is not writable. Keep this path separate from `INGEST_DIR` — the GC job must not delete source map files.

**sentry-cli / `@sentry/nextjs` configuration:**
```bash
# .env.sentry-build-plugin  (NOT .sentryclirc — not read by @sentry/nextjs v2+ bundler)
SENTRY_URL=http://your-rustrak-host
SENTRY_AUTH_TOKEN=your-bearer-token
SENTRY_ORG=any-string          # accepted but ignored by Rustrak
SENTRY_PROJECT=your-project-slug  # must match slug in Rustrak DB
```

## CI Matrix

```yaml
# .github/workflows/test.yml
strategy:
  matrix:
    features: [postgres, sqlite]
steps:
  - name: Test (${{ matrix.features }})
    run: cargo test --manifest-path apps/server/Cargo.toml --features ${{ matrix.features }}
```

Both variants must pass before merge.

### Test Suite Coverage by Backend

| Test Suite | PostgreSQL | SQLite | Notes |
|---|---|---|---|
| `normalize_sentry_position` unit tests | ✅ | ✅ | Pure function, no DB |
| `SourceMapStore` roundtrip + idempotency | ✅ | ✅ | Filesystem only, no DB |
| `rewrite_frames` via `FakeSourceMapProvider` | ✅ | ✅ | No DB, tests all AC2/AC5/AC8/AC9 cases |
| `store_chunks` DB roundtrip (`sqlx::test`) | ✅ | ✅ | Must verify BYTEA vs BLOB |
| `AssemblyJob.chunks` JSON decode (`sqlx::test`) | ✅ | ✅ | **Critical for SQLite** — Vec<String> via Json wrapper |
| Assembly job state machine (`sqlx::test`) | ✅ | ✅ | Create → claim → ok/error |
| Recovery query (stuck assembling jobs) | ✅ | ✅ | Verify locked_until < NOW() resets to created |
| `source_file` two-query upsert (`sqlx::test`) | ✅ | ✅ | Verify no panic on conflict |
| HTTP endpoint contract tests | ✅ | ✅ | Verify exact JSON response shapes |
| Concurrent `POST assemble` idempotency | ✅ | ⚠️ SQLite: mutex serializes | May be skipped under SQLite (single-worker mode) |

**SQLite test setup:** use `sqlx::test` macro with in-memory SQLite (`sqlite::memory:`). No `DATABASE_URL` needed — `sqlx::test` creates an isolated test DB for each `#[sqlx::test]` function.

## Verification

**Commands:**
- `cargo check --manifest-path apps/server/Cargo.toml --features postgres` — zero errors
- `cargo check --manifest-path apps/server/Cargo.toml --features sqlite` — zero errors
- `cargo test --manifest-path apps/server/Cargo.toml --features postgres` — all tests pass
- `cargo test --manifest-path apps/server/Cargo.toml --features sqlite` — all tests pass
- `cargo sqlx migrate run --source apps/server/migrations/postgres` — 4 new tables + 1 enum
- `cargo sqlx migrate run --source apps/server/migrations/sqlite` — 4 new tables

**Manual checks:**
- Upload a Next.js artifact bundle via `@sentry/nextjs` → verify `source_file_metadata` rows in DB and `.map` files in `$SOURCEMAP_STORAGE_PATH`
- Trigger a Next.js error after upload → verify stored event JSON has `filename: "src/..."` instead of `_next/static/chunks/...`
- Upload same bundle twice → verify `source_file` row count unchanged
- Send event with `lineno: 0` → verify frame unchanged in stored event
- Kill server mid-assembly → restart → verify job retried and eventually `ok` or `error`
