use std::collections::HashMap;
use std::io::Cursor;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

use bytes::Bytes;
use sha1::Digest as _;
use uuid::Uuid;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::services::sourcemap_store::SourceMapStore;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Default maximum size of a single chunk in bytes (10 MB).
pub const DEFAULT_MAX_CHUNK_SIZE_BYTES: usize = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// SourceMapEntry + SourceMapProvider trait
// ---------------------------------------------------------------------------

pub struct SourceMapEntry {
    pub data: Bytes,
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

// ---------------------------------------------------------------------------
// DbSourceMapProvider (concrete implementation)
// ---------------------------------------------------------------------------

pub struct DbSourceMapProvider {
    pool: DbPool,
    store: Arc<dyn SourceMapStore>,
}

impl DbSourceMapProvider {
    pub fn new(pool: DbPool, store: Arc<dyn SourceMapStore>) -> Self {
        Self { pool, store }
    }
}

#[async_trait::async_trait]
impl SourceMapProvider for DbSourceMapProvider {
    async fn fetch_sourcemap(
        &self,
        project_id: i32,
        debug_id: &str,
        file_type: &str,
    ) -> AppResult<Option<SourceMapEntry>> {
        // 1. Parse debug_id as UUID for typed query
        let debug_uuid = match Uuid::parse_str(debug_id) {
            Ok(u) => u,
            Err(_) => return Ok(None),
        };

        // 2. Query source_file_metadata joined with source_file
        // Returns (sfm_id_str, storage_path) — backend-agnostic String types
        #[cfg(feature = "postgres")]
        let row: Option<(String, String)> = sqlx::query_as(
            r#"
            SELECT sfm.id::text, sf.storage_path
            FROM source_file_metadata sfm
            JOIN source_file sf ON sf.id = sfm.file_id
            WHERE sfm.project_id = $1 AND sfm.debug_id = $2 AND sfm.file_type = $3
            "#,
        )
        .bind(project_id)
        .bind(debug_uuid)
        .bind(file_type)
        .fetch_optional(&self.pool)
        .await?;

        #[cfg(not(feature = "postgres"))]
        let row: Option<(String, String)> = sqlx::query_as(
            r#"
            SELECT sfm.id, sf.storage_path
            FROM source_file_metadata sfm
            JOIN source_file sf ON sf.id = sfm.file_id
            WHERE sfm.project_id = $1 AND sfm.debug_id = $2 AND sfm.file_type = $3
            "#,
        )
        .bind(project_id)
        .bind(debug_uuid.to_string())
        .bind(file_type)
        .fetch_optional(&self.pool)
        .await?;

        let (sfm_id, storage_path) = match row {
            Some(r) => r,
            None => return Ok(None),
        };

        // 3. Read file from store
        let data = match self.store.get(&storage_path).await {
            Ok(d) => d,
            Err(crate::services::sourcemap_store::StoreError::NotFound(_)) => {
                log::warn!(
                    "source_file_metadata row exists but file missing on disk: {}",
                    storage_path
                );
                return Ok(None);
            }
            Err(e) => {
                log::warn!("failed to read source map from store: {}", e);
                return Ok(None);
            }
        };

        // 4. Increment times_used (best-effort, fire-and-forget)
        // Parse the string sfm_id back to UUID for the UPDATE (works for both backends).
        if let Ok(sfm_uuid) = Uuid::parse_str(&sfm_id) {
            #[cfg(feature = "postgres")]
            let _ = sqlx::query(
                "UPDATE source_file_metadata SET times_used = times_used + 1 WHERE id = $1",
            )
            .bind(sfm_uuid)
            .execute(&self.pool)
            .await;

            #[cfg(not(feature = "postgres"))]
            let _ = sqlx::query(
                "UPDATE source_file_metadata SET times_used = times_used + 1 WHERE id = $1",
            )
            .bind(sfm_uuid.to_string())
            .execute(&self.pool)
            .await;
        }

        Ok(Some(SourceMapEntry { data }))
    }
}

// ---------------------------------------------------------------------------
// normalize_sentry_position
// ---------------------------------------------------------------------------

/// Convert 1-indexed Sentry (lineno, colno) to 0-indexed sourcemap (line, col).
///
/// Returns `None` when lineno is `None` or `Some(0)` — both mean "unmapped" in
/// the Sentry protocol. Never uses plain `-1` arithmetic (avoids u32 wraparound).
pub fn normalize_sentry_position(lineno: Option<u32>, colno: Option<u32>) -> Option<(u32, u32)> {
    match lineno {
        None | Some(0) => None,
        Some(l) => Some((l.saturating_sub(1), colno.unwrap_or(0))),
    }
}

// ---------------------------------------------------------------------------
// get_missing_chunks
// ---------------------------------------------------------------------------

/// Returns checksums from `checksums` that are NOT present in the `chunk` table.
pub async fn get_missing_chunks(pool: &DbPool, checksums: &[String]) -> AppResult<Vec<String>> {
    if checksums.is_empty() {
        return Ok(vec![]);
    }

    #[cfg(feature = "postgres")]
    {
        let present: Vec<String> =
            sqlx::query_scalar("SELECT checksum FROM chunk WHERE checksum = ANY($1)")
                .bind(checksums)
                .fetch_all(pool)
                .await?;
        let present_set: std::collections::HashSet<&str> =
            present.iter().map(|s| s.as_str()).collect();
        Ok(checksums
            .iter()
            .filter(|c| !present_set.contains(c.as_str()))
            .cloned()
            .collect())
    }

    #[cfg(not(feature = "postgres"))]
    {
        use sqlx::QueryBuilder;
        let mut qb = QueryBuilder::new("SELECT checksum FROM chunk WHERE checksum IN (");
        let mut sep = qb.separated(", ");
        for c in checksums {
            sep.push_bind(c);
        }
        qb.push(")");
        let present: Vec<String> = qb.build_query_scalar().fetch_all(pool).await?;
        let present_set: std::collections::HashSet<&str> =
            present.iter().map(|s| s.as_str()).collect();
        Ok(checksums
            .iter()
            .filter(|c| !present_set.contains(c.as_str()))
            .cloned()
            .collect())
    }
}

// ---------------------------------------------------------------------------
// store_chunks
// ---------------------------------------------------------------------------

/// Upsert chunk rows into the `chunk` table, enforcing the max-chunk-size limit.
pub async fn store_chunks(
    pool: &DbPool,
    parts: Vec<(String, Vec<u8>)>,
    max_chunk_size: usize,
) -> AppResult<()> {
    for (sha1, bytes) in parts {
        if bytes.len() > max_chunk_size {
            return Err(AppError::Validation(format!(
                "chunk too large: {} bytes exceeds limit {}",
                bytes.len(),
                max_chunk_size
            )));
        }
        let size = bytes.len() as i32;
        sqlx::query(
            "INSERT INTO chunk(checksum, size, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        )
        .bind(&sha1)
        .bind(size)
        .bind(&bytes)
        .execute(pool)
        .await?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// assemble_bundle
// ---------------------------------------------------------------------------

/// Assembles all chunks into a ZIP bundle, extracts source map files, and stores
/// metadata in the database.
///
/// Steps:
/// 1. Fetch chunk rows in order; join bytes (enforcing `max_bundle_size_bytes`).
/// 2. Verify SHA1 matches `bundle_checksum`.
/// 3. Write to temp file; open as ZipArchive.
/// 4. Validate each entry for symlinks and path traversal.
/// 5. Extract to temp dir.
/// 6. Parse manifest.json.
/// 7. For each source-map entry: store file + upsert DB rows.
/// 8. Delete chunk rows.
pub async fn assemble_bundle(
    pool: &DbPool,
    store: &dyn SourceMapStore,
    project_id: i32,
    bundle_checksum: &str,
    chunk_checksums: &[String],
    max_bundle_size_bytes: usize,
) -> AppResult<()> {
    // --- Step 1: fetch + join chunk bytes ---
    let mut joined: Vec<u8> = Vec::new();
    for checksum in chunk_checksums {
        let data: Vec<u8> = sqlx::query_scalar("SELECT data FROM chunk WHERE checksum = $1")
            .bind(checksum)
            .fetch_one(pool)
            .await
            .map_err(|_| AppError::Validation(format!("chunk not found: {}", checksum)))?;
        if joined.len() + data.len() > max_bundle_size_bytes {
            return Err(AppError::Validation(format!(
                "bundle too large: exceeds {} bytes limit",
                max_bundle_size_bytes
            )));
        }
        joined.extend_from_slice(&data);
    }

    // --- Step 2: verify SHA1 ---
    let mut hasher = sha1::Sha1::new();
    hasher.update(&joined);
    let computed = hex::encode(hasher.finalize());
    if computed != bundle_checksum {
        return Err(AppError::Validation(format!(
            "checksum mismatch: expected {}, got {}",
            bundle_checksum, computed
        )));
    }

    // --- Step 3: write to temp file (non-blocking) ---
    let temp_dir = tempfile::tempdir().map_err(|e| AppError::Internal(e.to_string()))?;
    let zip_path = temp_dir.path().join("bundle.zip");
    tokio::fs::write(&zip_path, &joined)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    drop(joined); // free memory

    // --- Steps 4+5: open ZIP + validate + extract (blocking I/O via spawn_blocking) ---
    let extract_dir = temp_dir.path().join("extracted");
    let zip_path_owned = zip_path.clone();
    let extract_dir_owned = extract_dir.clone();
    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        let zip_file =
            std::fs::File::open(&zip_path_owned).map_err(|e| AppError::Internal(e.to_string()))?;
        let mut archive = zip::ZipArchive::new(zip_file)
            .map_err(|e| AppError::Validation(format!("invalid ZIP archive: {}", e)))?;

        std::fs::create_dir_all(&extract_dir_owned)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| AppError::Internal(e.to_string()))?;

            // CVE-2025-29787: reject symlinks
            if file.is_symlink() {
                continue;
            }

            let name = file.name().to_string();
            // Strip the "~/" prefix used by Sentry artifact bundles so that extraction
            // and manifest lookup both resolve to the same relative path.
            let name = name.trim_start_matches("~/").to_string();
            // Path traversal guard — do NOT use canonicalize() (file doesn't exist yet).
            // Iterate the archive entry name only (not raw_dest) so extract_dir is
            // not duplicated in the resolved path.
            let mut resolved = PathBuf::from(&extract_dir_owned);
            for component in Path::new(&name).components() {
                match component {
                    Component::ParentDir => {
                        resolved.pop();
                    }
                    Component::Normal(c) => resolved.push(c),
                    _ => {}
                }
            }
            if !resolved.starts_with(&extract_dir_owned) {
                return Err(AppError::Validation(
                    "path traversal in archive".to_string(),
                ));
            }

            // Create parent dirs if needed
            if let Some(parent) = resolved.parent() {
                std::fs::create_dir_all(parent).map_err(|e| AppError::Internal(e.to_string()))?;
            }

            if !name.ends_with('/') {
                let mut out = std::fs::File::create(&resolved)
                    .map_err(|e| AppError::Internal(e.to_string()))?;
                std::io::copy(&mut file, &mut out)
                    .map_err(|e| AppError::Internal(e.to_string()))?;
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| AppError::Internal(format!("zip extraction panicked: {}", e)))??;

    // --- Step 6: parse manifest.json ---
    let manifest_path = extract_dir.join("manifest.json");
    let manifest_bytes = tokio::fs::read(&manifest_path).await.map_err(|_| {
        AppError::Validation("manifest.json not found in artifact bundle".to_string())
    })?;
    let manifest: serde_json::Value = serde_json::from_slice(&manifest_bytes)
        .map_err(|e| AppError::Validation(format!("invalid manifest.json: {}", e)))?;

    let files = match manifest.get("files").and_then(|f| f.as_object()) {
        Some(f) => f.clone(),
        None => return Ok(()), // no files to process
    };

    // --- Steps 7+8: process each file entry, then delete chunks ---
    // We run in a transaction for the DB writes; store writes are outside (idempotent CAS).
    let mut tx = pool.begin().await?;

    for (file_path, file_info) in &files {
        let headers = match file_info.get("headers").and_then(|h| h.as_object()) {
            Some(h) => h,
            None => continue,
        };

        // Step 7: skip entries without a debug-id header
        let debug_id_str = match headers
            .get("debug-id")
            .or_else(|| headers.get("debug_id"))
            .and_then(|v| v.as_str())
        {
            Some(s) => s.to_string(),
            None => continue,
        };

        // Validate debug_id is a UUID
        let debug_uuid = match Uuid::parse_str(&debug_id_str) {
            Ok(u) => u,
            Err(_) => {
                log::warn!("invalid debug_id in manifest: {}", debug_id_str);
                continue;
            }
        };

        // Read file_type from manifest entry's `type` field verbatim
        let file_type = match file_info.get("type").and_then(|t| t.as_str()) {
            Some(t) => t.to_string(),
            None => continue,
        };

        // Read file bytes from extracted dir
        // file_path in manifest may start with "~/" — strip that prefix
        let relative = file_path.trim_start_matches("~/").trim_start_matches('/');
        // Guard: reject any manifest path with traversal components
        if Path::new(relative)
            .components()
            .any(|c| matches!(c, Component::ParentDir | Component::RootDir))
        {
            return Err(AppError::Validation(format!(
                "invalid manifest file path: {}",
                file_path
            )));
        }
        let file_on_disk = extract_dir.join(relative);
        let file_bytes = match tokio::fs::read(&file_on_disk).await {
            Ok(b) => b,
            Err(e) => {
                log::warn!("cannot read extracted file {}: {}", file_path, e);
                continue;
            }
        };

        // Compute SHA1 of file bytes → storage key
        let mut fhasher = sha1::Sha1::new();
        fhasher.update(&file_bytes);
        let sha1_hex = hex::encode(fhasher.finalize());

        // Store file in CAS (outside transaction — idempotent).
        // Propagate errors: a store failure must abort the job so chunks are NOT
        // deleted and the assembly can be retried.
        store
            .put(&sha1_hex, Bytes::from(file_bytes.clone()))
            .await
            .map_err(|e| AppError::Internal(format!("failed to store source file: {}", e)))?;

        let file_size = file_bytes.len() as i32;
        let storage_key = sha1_hex.clone();
        let new_sf_id = Uuid::new_v4();

        // Two-query upsert for source_file (avoids RETURNING NULL on conflict)
        // Query A: insert (idempotent)
        #[cfg(feature = "postgres")]
        sqlx::query(
            r#"
            INSERT INTO source_file(id, checksum, size, storage_path)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT(checksum) DO NOTHING
            "#,
        )
        .bind(new_sf_id)
        .bind(&storage_key)
        .bind(file_size)
        .bind(&storage_key)
        .execute(&mut *tx)
        .await?;

        #[cfg(not(feature = "postgres"))]
        sqlx::query(
            r#"
            INSERT INTO source_file(id, checksum, size, storage_path)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT(checksum) DO NOTHING
            "#,
        )
        .bind(new_sf_id.to_string())
        .bind(&storage_key)
        .bind(file_size)
        .bind(&storage_key)
        .execute(&mut *tx)
        .await?;

        // Query B: always fetch (works whether just inserted or pre-existing)
        #[cfg(feature = "postgres")]
        let sf_id: Uuid = sqlx::query_scalar("SELECT id FROM source_file WHERE checksum = $1")
            .bind(&storage_key)
            .fetch_one(&mut *tx)
            .await?;

        #[cfg(not(feature = "postgres"))]
        let sf_id: String = sqlx::query_scalar("SELECT id FROM source_file WHERE checksum = $1")
            .bind(&storage_key)
            .fetch_one(&mut *tx)
            .await?;

        #[cfg(not(feature = "postgres"))]
        let sf_id = Uuid::parse_str(&sf_id).map_err(|e| AppError::Internal(e.to_string()))?;

        // Upsert source_file_metadata
        let new_sfm_id = Uuid::new_v4();
        #[cfg(feature = "postgres")]
        sqlx::query(
            r#"
            INSERT INTO source_file_metadata(id, project_id, debug_id, file_type, file_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT(project_id, debug_id, file_type) DO NOTHING
            "#,
        )
        .bind(new_sfm_id)
        .bind(project_id)
        .bind(debug_uuid)
        .bind(&file_type)
        .bind(sf_id)
        .execute(&mut *tx)
        .await?;

        #[cfg(not(feature = "postgres"))]
        sqlx::query(
            r#"
            INSERT INTO source_file_metadata(id, project_id, debug_id, file_type, file_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT(project_id, debug_id, file_type) DO NOTHING
            "#,
        )
        .bind(new_sfm_id.to_string())
        .bind(project_id)
        .bind(debug_uuid.to_string())
        .bind(&file_type)
        .bind(sf_id.to_string())
        .execute(&mut *tx)
        .await?;
    }

    // --- Step 8: delete chunk rows ---
    #[cfg(feature = "postgres")]
    sqlx::query("DELETE FROM chunk WHERE checksum = ANY($1)")
        .bind(chunk_checksums)
        .execute(&mut *tx)
        .await?;

    #[cfg(not(feature = "postgres"))]
    {
        use sqlx::QueryBuilder;
        if !chunk_checksums.is_empty() {
            let mut qb = QueryBuilder::new("DELETE FROM chunk WHERE checksum IN (");
            let mut sep = qb.separated(", ");
            for c in chunk_checksums {
                sep.push_bind(c);
            }
            qb.push(")");
            qb.build().execute(&mut *tx).await?;
        }
    }

    tx.commit().await?;

    Ok(())
}

// ---------------------------------------------------------------------------
// rewrite_frames
// ---------------------------------------------------------------------------

/// Rewrites stack frames in `event_data` using stored source maps.
///
/// Walks both places Sentry's protocol allows a stack trace to live:
/// `exception.values[*].stacktrace.frames` and `threads.values[*].stacktrace.frames`
/// (the latter carries crashes reported via threads instead of an exception —
/// e.g. JS worker-thread crashes). Both have the identical `values[i].stacktrace.frames`
/// shape, so the same walk works under either root key.
///
/// Frame-rewriting errors are non-fatal: we `warn!` and continue.
pub async fn rewrite_frames(
    provider: &dyn SourceMapProvider,
    project_id: i32,
    event_data: &mut serde_json::Value,
) -> AppResult<()> {
    // 1. Build code_file → debug_id_str map from debug_meta.images
    let images_map: HashMap<String, String> = event_data
        .get("debug_meta")
        .and_then(|dm| dm.get("images"))
        .and_then(|imgs| imgs.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|img| {
                    Some((
                        img.get("code_file")?.as_str()?.to_string(),
                        img.get("debug_id")?.as_str()?.to_string(),
                    ))
                })
                .collect()
        })
        .unwrap_or_default();

    if images_map.is_empty() {
        return Ok(());
    }

    rewrite_frames_under(provider, project_id, event_data, "exception", &images_map).await?;
    rewrite_frames_under(provider, project_id, event_data, "threads", &images_map).await?;

    Ok(())
}

/// Rewrites every frame under `event_data[root_key]["values"][*]["stacktrace"]["frames"]`.
/// `root_key` is `"exception"` or `"threads"` — see [`rewrite_frames`].
async fn rewrite_frames_under(
    provider: &dyn SourceMapProvider,
    project_id: i32,
    event_data: &mut serde_json::Value,
    root_key: &str,
    images_map: &HashMap<String, String>,
) -> AppResult<()> {
    // Iterate by index to avoid holding a &mut borrow across .await points.
    let value_count = event_data[root_key]["values"]
        .as_array()
        .map(|a| a.len())
        .unwrap_or(0);
    if value_count == 0 {
        return Ok(());
    }

    for value_idx in 0..value_count {
        let frame_count = event_data[root_key]["values"][value_idx]["stacktrace"]["frames"]
            .as_array()
            .map(|a| a.len())
            .unwrap_or(0);

        for frame_idx in 0..frame_count {
            // 3a. Extract frame fields as owned values (no live borrow across .await)
            let filename: Option<String> = event_data[root_key]["values"][value_idx]["stacktrace"]
                ["frames"][frame_idx]
                .get("filename")
                .and_then(|f| f.as_str())
                .map(|s| s.to_string());
            let abs_path: Option<String> = event_data[root_key]["values"][value_idx]["stacktrace"]
                ["frames"][frame_idx]
                .get("abs_path")
                .and_then(|f| f.as_str())
                .map(|s| s.to_string());
            // Skip only when both are absent — abs_path-only frames are valid
            if abs_path.is_none() && filename.is_none() {
                continue;
            }
            let frame_lineno: Option<u32> = event_data[root_key]["values"][value_idx]["stacktrace"]
                ["frames"][frame_idx]
                .get("lineno")
                .and_then(|l| l.as_u64())
                .map(|l| l as u32);
            let frame_colno: Option<u32> = event_data[root_key]["values"][value_idx]["stacktrace"]
                ["frames"][frame_idx]
                .get("colno")
                .and_then(|c| c.as_u64())
                .map(|c| c as u32);

            // 3b. Resolve debug_id from code_file map.
            // Try abs_path first (full URL matching code_file), then filename.
            let debug_id = match abs_path
                .as_deref()
                .and_then(|k| images_map.get(k))
                .or_else(|| filename.as_deref().and_then(|k| images_map.get(k)))
            {
                Some(id) => id.clone(),
                None => continue,
            };

            // 3c. Fetch source map — file_type is "source_map" (NOT "minified")
            let entry = match provider
                .fetch_sourcemap(project_id, &debug_id, "source_map")
                .await
            {
                Ok(Some(e)) => e,
                Ok(None) => continue,
                Err(e) => {
                    log::warn!("fetch_sourcemap error for {}: {:?}", debug_id, e);
                    continue;
                }
            };

            // 3d. Parse source map
            let sm = match sourcemap::SourceMap::from_reader(Cursor::new(&entry.data)) {
                Ok(sm) => sm,
                Err(e) => {
                    log::warn!("failed to parse source map for {}: {}", debug_id, e);
                    continue;
                }
            };

            // 3e. Normalize position — use let-else, NOT '?' (normalize returns Option not Result)
            let Some((norm_lineno, norm_colno)) =
                normalize_sentry_position(frame_lineno, frame_colno)
            else {
                continue;
            };

            // 3f. Lookup token
            let Some(token) = sm.lookup_token(norm_lineno, norm_colno) else {
                continue;
            };

            // 3g. Skip unmapped tokens
            if token.get_src_line() == u32::MAX {
                continue;
            }

            // 3h. Original file from token
            let original_file = token.get_source().unwrap_or("").to_string();

            // 3i. Find source index via linear search (NEVER assume sourcesContent[0])
            let source_idx = (0..sm.get_source_count())
                .find(|&i| sm.get_source(i) == Some(original_file.as_str()));

            // 3j. Get source lines as owned Strings (sm is dropped after this loop body)
            let lines: Vec<String> = source_idx
                .and_then(|i| sm.get_source_contents(i))
                .map(|s| s.lines().map(|l| l.to_string()).collect())
                .unwrap_or_default();

            // 3k. Compute context window bounds
            let l = token.get_src_line() as usize;
            let pre_start = l.saturating_sub(3);
            let post_end = lines.len().min(l + 4);

            let existing_function = event_data[root_key]["values"][value_idx]["stacktrace"]
                ["frames"][frame_idx]
                .get("function")
                .and_then(|f| f.as_str())
                .unwrap_or("")
                .to_string();

            let new_lineno = token.get_src_line() + 1; // back to 1-indexed
            let new_colno = token.get_src_col();
            let new_function = token
                .get_name()
                .map(|n| n.to_string())
                .unwrap_or(existing_function);
            let context_line = lines.get(l).cloned().unwrap_or_default();
            let pre_context: Vec<serde_json::Value> = lines
                .get(pre_start..l)
                .unwrap_or_default()
                .iter()
                .map(|s| serde_json::Value::String(s.clone()))
                .collect();
            let post_context: Vec<serde_json::Value> = lines
                .get(l + 1..post_end)
                .unwrap_or_default()
                .iter()
                .map(|s| serde_json::Value::String(s.clone()))
                .collect();

            // 3l. Write rewritten fields back by index path (fresh borrow, no cross-await alias)
            let frame =
                &mut event_data[root_key]["values"][value_idx]["stacktrace"]["frames"][frame_idx];
            // Only overwrite filename/abs_path when the token has a non-empty source name.
            // A None/empty source (malformed map) must not corrupt the original filename.
            // Reference: getsentry/symbolicator symbolication.rs L246-273 (e282ec0)
            if !original_file.is_empty() {
                frame["filename"] = original_file.into();
                // Clear abs_path — it pointed to the minified JS URL, now irrelevant
                frame["abs_path"] = serde_json::Value::Null;
            }
            // Record which source map was applied (Sentry UI observability)
            if !frame["data"].is_object() {
                frame["data"] = serde_json::json!({});
            }
            frame["data"]["sourcemap"] = debug_id.clone().into();
            frame["lineno"] = new_lineno.into();
            frame["colno"] = new_colno.into();
            frame["function"] = new_function.into();
            frame["context_line"] = context_line.into();
            frame["pre_context"] = pre_context.into();
            frame["post_context"] = post_context.into();
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockProvider {
        data: Bytes,
    }

    #[async_trait::async_trait]
    impl SourceMapProvider for MockProvider {
        async fn fetch_sourcemap(
            &self,
            _project_id: i32,
            _debug_id: &str,
            _file_type: &str,
        ) -> AppResult<Option<SourceMapEntry>> {
            Ok(Some(SourceMapEntry {
                data: self.data.clone(),
            }))
        }
    }

    fn mock_provider(sourcemap_json: &str) -> MockProvider {
        MockProvider {
            data: Bytes::from(sourcemap_json.to_string()),
        }
    }

    // Source map where sources[0] is "" (empty) — token has a valid position and
    // name but no source file name. VLQ "AAIEA" = gen_col=0, src_idx=0,
    // src_line=4, src_col=2, name_idx=0 on generated line 0.
    const SOURCEMAP_EMPTY_SOURCE: &str = r#"{
        "version": 3,
        "sources": [""],
        "sourcesContent": [null],
        "names": ["originalFunction"],
        "mappings": "AAIEA"
    }"#;

    #[tokio::test]
    async fn rewrite_preserves_filename_when_token_source_is_empty() {
        let provider = mock_provider(SOURCEMAP_EMPTY_SOURCE);
        let mut event = serde_json::json!({
            "debug_meta": {
                "images": [{"type": "sourcemap", "code_file": "app.min.js", "debug_id": "test-debug-id"}]
            },
            "exception": { "values": [{ "type": "Error", "value": "boom", "stacktrace": { "frames": [{
                "filename": "app.min.js",
                "abs_path": "https://example.com/app.min.js",
                "lineno": 1,
                "colno": 0,
                "function": "minifiedFn"
            }]}}]}
        });

        rewrite_frames(&provider, 1, &mut event).await.unwrap();

        let frame = &event["exception"]["values"][0]["stacktrace"]["frames"][0];
        // filename and abs_path must be preserved — empty source name must not corrupt them
        assert_eq!(
            frame["filename"], "app.min.js",
            "filename should not be overwritten with empty string"
        );
        assert_eq!(
            frame["abs_path"], "https://example.com/app.min.js",
            "abs_path should not be cleared when source name is empty"
        );
    }

    #[tokio::test]
    async fn rewrite_frames_also_rewrites_thread_stacktrace_frames() {
        let provider = mock_provider(SOURCEMAP_EMPTY_SOURCE);
        let mut event = serde_json::json!({
            "debug_meta": {
                "images": [{"type": "sourcemap", "code_file": "app.min.js", "debug_id": "test-debug-id"}]
            },
            "threads": { "values": [{
                "id": "0",
                "crashed": true,
                "stacktrace": { "frames": [{
                    "filename": "app.min.js",
                    "lineno": 1,
                    "colno": 0,
                    "function": "minifiedFn"
                }]}
            }]}
        });

        rewrite_frames(&provider, 1, &mut event).await.unwrap();

        let frame = &event["threads"]["values"][0]["stacktrace"]["frames"][0];
        assert_eq!(
            frame["lineno"], 5,
            "thread frame lineno should be remapped just like exception frames"
        );
        assert_eq!(
            frame["function"], "originalFunction",
            "thread frame function should be resolved from the source map, same as exception frames"
        );
    }

    #[tokio::test]
    async fn rewrite_still_updates_lineno_colno_function_when_token_source_is_empty() {
        let provider = mock_provider(SOURCEMAP_EMPTY_SOURCE);
        let mut event = serde_json::json!({
            "debug_meta": {
                "images": [{"type": "sourcemap", "code_file": "app.min.js", "debug_id": "test-debug-id"}]
            },
            "exception": { "values": [{ "type": "Error", "value": "boom", "stacktrace": { "frames": [{
                "filename": "app.min.js",
                "lineno": 1,
                "colno": 0,
                "function": "minifiedFn"
            }]}}]}
        });

        rewrite_frames(&provider, 1, &mut event).await.unwrap();

        let frame = &event["exception"]["values"][0]["stacktrace"]["frames"][0];
        // lineno/colno/function must still be remapped even without a source file name
        assert_eq!(
            frame["lineno"], 5,
            "lineno should be remapped to original (src_line 4 + 1)"
        );
        assert_eq!(frame["colno"], 2, "colno should be remapped to original");
        assert_eq!(
            frame["function"], "originalFunction",
            "function name should be resolved from names table"
        );
    }
}
