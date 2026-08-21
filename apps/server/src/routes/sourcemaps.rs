use actix_multipart::Multipart;
use actix_web::{web, HttpResponse};
use futures_util::StreamExt as _;
use serde::{Deserialize, Serialize};
use sha1::Digest as _;
use std::sync::Arc;

use crate::auth::ApiActor;
use crate::config::Config;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::services::access::{self, Action};
use crate::services::sourcemap::{get_missing_chunks, store_chunks, SourceMapProvider};

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

/// Multipart chunk upload.
/// Each part's **field name** may be the SHA-1 hex digest of that part's binary content
/// (sentry-cli v2 protocol, e.g. `da39a3ee5e6b4b0d3255bfef95601890afd80709`) or an arbitrary
/// name like `file` (sentry-cli v3.x). Up to 64 parts per request; each part body is raw binary.
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[allow(dead_code)]
struct ChunkUploadBody {}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AssembleBody {
    pub checksum: String,
    pub chunks: Vec<String>,
    pub projects: Vec<String>,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AssembleResponse {
    pub state: String,
    #[serde(rename = "missingChunks")]
    pub missing_chunks: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/0/organizations/{org_slug}/",
    tag = "Source Maps",
    params(("org_slug" = String, Path, description = "Organization slug")),
    responses(
        (status = 200, description = "Synthetic org metadata accepted by sentry-cli"),
    ),
))]
/// GET /api/0/organizations/{org_slug}/
/// Always returns 200 with synthetic org data — sentry-cli validates this before uploading.
pub async fn org_details(path: web::Path<String>) -> AppResult<HttpResponse> {
    let org_slug = path.into_inner();
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "slug": org_slug,
        "name": org_slug,
        "id": "1",
        "features": ["artifact-bundles", "artifact-bundles-v2"]
    })))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/0/organizations/{org_slug}/chunk-upload/",
    tag = "Source Maps",
    params(("org_slug" = String, Path, description = "Organization slug")),
    responses(
        (status = 200, description = "Chunk upload capabilities and URL"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/0/organizations/{org_slug}/chunk-upload/
pub async fn chunk_upload_capability(
    path: web::Path<String>,
    _actor: ApiActor,
    config: web::Data<Config>,
) -> AppResult<HttpResponse> {
    let org_slug = path.into_inner();

    let base_url = config
        .public_url
        .clone()
        .unwrap_or_else(|| format!("http://{}:{}", config.host, config.port));

    let chunk_size = config.max_chunk_size_bytes as u64;
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "url": format!("{}/api/0/organizations/{}/chunk-upload/", base_url, org_slug),
        "chunkSize": chunk_size,
        "chunksPerRequest": 64u64,
        "maxRequestSize": chunk_size * 64,
        "hashAlgorithm": "sha1",
        "accept": ["release_files", "sources", "artifact_bundles", "artifact_bundles_v2"],
        "concurrency": 8u64
    })))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/0/organizations/{org_slug}/chunk-upload/",
    tag = "Source Maps",
    params(("org_slug" = String, Path, description = "Organization slug")),
    request_body(
        content_type = "multipart/form-data",
        description = "One or more binary chunk files. Field names may be SHA-1 hashes (v2 protocol) or arbitrary names like 'file' (v3.x protocol).",
        content = ChunkUploadBody,
    ),
    responses(
        (status = 200, description = "Chunks stored successfully"),
        (status = 400, description = "Invalid multipart or chunk too large", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/0/organizations/{org_slug}/chunk-upload/
pub async fn chunk_upload(
    _path: web::Path<String>,
    _actor: ApiActor,
    pool: web::Data<DbPool>,
    config: web::Data<Config>,
    mut payload: Multipart,
) -> AppResult<HttpResponse> {
    let max_chunk_size = config.max_chunk_size_bytes;
    const MAX_PARTS: usize = 64;
    let max_total_bytes = max_chunk_size.saturating_mul(MAX_PARTS);
    let mut parts: Vec<(String, Vec<u8>)> = Vec::new();
    let mut total_bytes: usize = 0;

    while let Some(field_result) = payload.next().await {
        let mut field =
            field_result.map_err(|e| AppError::Validation(format!("multipart error: {}", e)))?;

        let field_name = field
            .content_disposition()
            .and_then(|cd| cd.get_name().map(|s| s.to_string()))
            .unwrap_or_default();

        // Skip unnamed fields; named fields are validated by chunk_storage_key()
        if field_name.is_empty() {
            continue;
        }

        if parts.len() >= MAX_PARTS {
            return Err(AppError::Validation(format!(
                "too many parts: request has more than {} chunks",
                MAX_PARTS
            )));
        }

        let mut hasher = sha1::Sha1::new();
        let mut buf: Vec<u8> = Vec::new();

        while let Some(chunk) = field.next().await {
            let data =
                chunk.map_err(|e| AppError::Validation(format!("multipart chunk error: {}", e)))?;
            if buf.len() + data.len() > max_chunk_size {
                return Err(AppError::Validation(format!(
                    "chunk too large: {} bytes exceeds limit {}",
                    buf.len() + data.len(),
                    max_chunk_size
                )));
            }
            hasher.update(&data);
            buf.extend_from_slice(&data);
        }

        total_bytes += buf.len();
        if total_bytes > max_total_bytes {
            return Err(AppError::Validation(format!(
                "request too large: {} bytes exceeds maximum {} bytes",
                total_bytes, max_total_bytes
            )));
        }

        let sha1_hex = hex::encode(hasher.finalize());
        let key = chunk_storage_key(&field_name, &sha1_hex)?;
        parts.push((key, buf));
    }

    if parts.is_empty() {
        return Err(AppError::Validation(
            "no valid file parts found in multipart request".to_string(),
        ));
    }

    store_chunks(pool.get_ref(), parts, max_chunk_size).await?;

    Ok(HttpResponse::Ok().finish())
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/0/organizations/{org_slug}/artifactbundle/assemble/",
    tag = "Source Maps",
    params(("org_slug" = String, Path, description = "Organization slug")),
    request_body = AssembleBody,
    responses(
        (status = 200, description = "Assembly job state (not_found / created / assembling / ok / error). Missing chunks are listed in missingChunks.", body = AssembleResponse),
        (status = 400, description = "Bad request or checksum mismatch", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Project not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/0/organizations/{org_slug}/artifactbundle/assemble/
pub async fn artifact_bundle_assemble(
    _path: web::Path<String>,
    actor: ApiActor,
    pool: web::Data<DbPool>,
    _provider: web::Data<Arc<dyn SourceMapProvider>>,
    body: web::Json<AssembleBody>,
) -> AppResult<HttpResponse> {
    // Guard: projects array must not be empty
    if body.projects.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "detail": "projects array must not be empty"
        })));
    }

    // Lookup project by slug first, then fall back to numeric ID (sentry-cli may send either).
    let project_ref = &body.projects[0];
    let project: Option<(i32,)> = sqlx::query_as("SELECT id FROM projects WHERE slug = $1")
        .bind(project_ref)
        .fetch_optional(pool.get_ref())
        .await?;
    let project_id = match project {
        Some((id,)) => id,
        None => {
            if let Ok(numeric_id) = project_ref.parse::<i32>() {
                let by_id: Option<(i32,)> = sqlx::query_as("SELECT id FROM projects WHERE id = $1")
                    .bind(numeric_id)
                    .fetch_optional(pool.get_ref())
                    .await?;
                match by_id {
                    Some((id,)) => id,
                    None => {
                        return Ok(HttpResponse::NotFound().json(serde_json::json!({
                            "detail": "project not found"
                        })));
                    }
                }
            } else {
                return Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "detail": "project not found"
                })));
            }
        }
    };

    // Enforce mutation access on the resolved project.
    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::UpdateProject,
    )
    .await?;

    // A finished (or in-flight) job answers the poll before the chunk check:
    // the assembly worker deletes the consumed chunk rows on success, so a
    // sentry-cli `--wait` poll after completion would otherwise see its own
    // chunks as missing forever. Error jobs fall through so a re-submit with
    // corrected chunks can re-queue via the ON CONFLICT below.
    let existing_job: Option<crate::models::source_file::AssemblyJob> = sqlx::query_as(
        "SELECT * FROM assembly_jobs WHERE bundle_checksum = $1 AND project_id = $2",
    )
    .bind(&body.checksum)
    .bind(project_id)
    .fetch_optional(pool.get_ref())
    .await?;
    if let Some(job) = existing_job {
        if job.state != "error" {
            return Ok(assembly_state_response(job.state.as_str(), job.detail));
        }
    }

    // Check for missing chunks
    let missing = get_missing_chunks(pool.get_ref(), &body.chunks).await?;
    if !missing.is_empty() {
        return Ok(HttpResponse::Ok().json(AssembleResponse {
            state: "not_found".to_string(),
            missing_chunks: missing,
            detail: None,
        }));
    }

    // INSERT ... ON CONFLICT: re-queue if the existing job errored, otherwise leave it.
    // Keep ownership rows in the same transaction so a worker cannot complete
    // between the job update and the reference insert.
    let mut tx = pool.begin().await?;

    #[cfg(feature = "postgres")]
    let job: Option<crate::models::source_file::AssemblyJob> = sqlx::query_as(
        r#"
        INSERT INTO assembly_jobs(bundle_checksum, project_id, chunks, state)
        VALUES ($1, $2, $3, 'created')
        ON CONFLICT(bundle_checksum, project_id) DO UPDATE
          SET state = 'created', detail = NULL, chunks = EXCLUDED.chunks, retry_count = 0
          WHERE assembly_jobs.state = 'error'
        RETURNING *
        "#,
    )
    .bind(&body.checksum)
    .bind(project_id)
    .bind(&body.chunks as &Vec<String>)
    .fetch_optional(&mut *tx)
    .await?;

    #[cfg(not(feature = "postgres"))]
    let job: Option<crate::models::source_file::AssemblyJob> = {
        let chunks_json =
            serde_json::to_string(&body.chunks).map_err(|e| AppError::Internal(e.to_string()))?;
        sqlx::query_as(
            r#"
            INSERT INTO assembly_jobs(bundle_checksum, project_id, chunks, state)
            VALUES ($1, $2, $3, 'created')
            ON CONFLICT(bundle_checksum, project_id) DO UPDATE
              SET state = 'created', detail = NULL, chunks = EXCLUDED.chunks, retry_count = 0
              WHERE assembly_jobs.state = 'error'
            RETURNING *
            "#,
        )
        .bind(&body.checksum)
        .bind(project_id)
        .bind(&chunks_json)
        .fetch_optional(&mut *tx)
        .await?
    };

    // If None (conflict — job already exists): fetch existing
    let inserted_job = job.is_some();
    let job = match job {
        Some(j) => j,
        None => {
            sqlx::query_as(
                "SELECT * FROM assembly_jobs WHERE bundle_checksum = $1 AND project_id = $2",
            )
            .bind(&body.checksum)
            .bind(project_id)
            .fetch_one(&mut *tx)
            .await?
        }
    };

    if inserted_job {
        sqlx::query("DELETE FROM assembly_job_chunks WHERE job_id = $1")
            .bind(job.id)
            .execute(&mut *tx)
            .await?;
        for checksum in &body.chunks {
            sqlx::query(
                "INSERT INTO assembly_job_chunks(job_id, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(job.id)
            .bind(checksum)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    Ok(assembly_state_response(
        job.state.as_str(),
        job.detail.clone(),
    ))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/0/projects/{org_slug}/{project_slug}/files/source-maps/",
    tag = "Source Maps",
    params(
        ("org_slug" = String, Path, description = "Organization slug"),
        ("project_slug" = String, Path, description = "Project slug"),
    ),
    responses(
        (status = 200, description = "List of uploaded source map files"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Project not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/0/projects/{org_slug}/{project_slug}/files/source-maps/
pub async fn list_source_maps(
    path: web::Path<(String, String)>,
    actor: ApiActor,
    pool: web::Data<DbPool>,
) -> AppResult<HttpResponse> {
    let (_, project_slug) = path.into_inner();

    let project: Option<(i32,)> = sqlx::query_as("SELECT id FROM projects WHERE slug = $1")
        .bind(&project_slug)
        .fetch_optional(pool.get_ref())
        .await?;
    let project_id = match project {
        Some((id,)) => id,
        None => {
            return Err(AppError::NotFound(format!(
                "project not found: {}",
                project_slug
            )));
        }
    };

    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ViewProject,
    )
    .await?;

    #[derive(sqlx::FromRow)]
    struct Row {
        debug_id: String,
        file_type: String,
        size: i32,
        times_used: i32,
        date_uploaded: String,
    }

    #[cfg(feature = "postgres")]
    let rows: Vec<Row> = sqlx::query_as(
        r#"
        SELECT
            sfm.debug_id::text AS debug_id,
            sfm.file_type,
            sf.size,
            sfm.times_used,
            sfm.created_at::text AS date_uploaded
        FROM source_file_metadata sfm
        JOIN source_file sf ON sf.id = sfm.file_id
        WHERE sfm.project_id = $1
        ORDER BY sfm.created_at DESC
        "#,
    )
    .bind(project_id)
    .fetch_all(pool.get_ref())
    .await?;

    #[cfg(not(feature = "postgres"))]
    let rows: Vec<Row> = sqlx::query_as(
        r#"
        SELECT
            sfm.debug_id AS debug_id,
            sfm.file_type,
            sf.size,
            sfm.times_used,
            sfm.created_at AS date_uploaded
        FROM source_file_metadata sfm
        JOIN source_file sf ON sf.id = sfm.file_id
        WHERE sfm.project_id = $1
        ORDER BY sfm.created_at DESC
        "#,
    )
    .bind(project_id)
    .fetch_all(pool.get_ref())
    .await?;

    let data: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "debugId": r.debug_id,
                "fileType": r.file_type,
                "size": r.size,
                "timesUsed": r.times_used,
                "dateUploaded": r.date_uploaded,
            })
        })
        .collect();

    Ok(HttpResponse::Ok().json(serde_json::json!({ "data": data })))
}

// ---------------------------------------------------------------------------
// configure
// ---------------------------------------------------------------------------

/// Returns the storage key for a chunk given the multipart field name and computed SHA1.
///
/// sentry-cli v2 uses the SHA1 hash as the field name (verifiable).
/// sentry-cli v3.x uses "file" or other arbitrary names — in that case we accept the
/// chunk and key it by the computed SHA1 to stay idempotent with the assemble flow.
fn chunk_storage_key(field_name: &str, computed_sha1: &str) -> Result<String, AppError> {
    let is_sha1_name = field_name.len() == 40 && field_name.bytes().all(|b| b.is_ascii_hexdigit());

    if is_sha1_name && !computed_sha1.eq_ignore_ascii_case(field_name) {
        return Err(AppError::Validation(format!(
            "checksum mismatch for field '{}': content SHA1 is {}",
            field_name, computed_sha1
        )));
    }

    Ok(computed_sha1.to_string())
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg
        // Organization endpoints
        .route(
            "/api/0/organizations/{org_slug}/",
            web::get().to(org_details),
        )
        .route(
            "/api/0/organizations/{org_slug}/chunk-upload/",
            web::get().to(chunk_upload_capability),
        )
        .route(
            "/api/0/organizations/{org_slug}/chunk-upload/",
            web::post().to(chunk_upload),
        )
        .route(
            "/api/0/organizations/{org_slug}/artifactbundle/assemble/",
            web::post().to(artifact_bundle_assemble),
        )
        // Project source-maps listing
        .route(
            "/api/0/projects/{org_slug}/{project_slug}/files/source-maps/",
            web::get().to(list_source_maps),
        );
}

/// Maps an assembly job state to the appropriate HTTP response.
/// All terminal states return HTTP 200; the state field in the body signals outcome.
fn assembly_state_response(state: &str, detail: Option<String>) -> HttpResponse {
    match state {
        "ok" => HttpResponse::Ok().json(AssembleResponse {
            state: "ok".to_string(),
            missing_chunks: vec![],
            detail: None,
        }),
        "error" => HttpResponse::Ok().json(AssembleResponse {
            state: "error".to_string(),
            missing_chunks: vec![],
            detail,
        }),
        other => HttpResponse::Ok().json(AssembleResponse {
            state: other.to_string(),
            missing_chunks: vec![],
            detail: None,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::body::to_bytes;

    #[actix_web::test]
    async fn test_assemble_error_state_returns_200_with_missing_chunks() {
        let resp = assembly_state_response("error", Some("zip extraction failed".to_string()));
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
        let body = to_bytes(resp.into_body()).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["state"], "error");
        assert_eq!(json["missingChunks"], serde_json::json!([]));
    }

    // sentry-cli v2 / old protocol: field name IS the SHA1 hash
    #[test]
    fn test_chunk_storage_key_sha1_field_name_matching_accepted() {
        let sha1 = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
        let result = chunk_storage_key(sha1, sha1);
        assert_eq!(result.unwrap(), sha1);
    }

    // field name looks like SHA1 but content is different → corruption, reject
    #[test]
    fn test_chunk_storage_key_sha1_field_name_mismatch_rejected() {
        let field_name = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
        let actual_sha1 = "aabbccdd5e6b4b0d3255bfef95601890afd80709";
        let result = chunk_storage_key(field_name, actual_sha1);
        assert!(result.is_err());
        let err = format!("{:?}", result.unwrap_err());
        assert!(err.contains("checksum mismatch"));
        assert!(err.contains(field_name));
        assert!(err.contains(actual_sha1));
    }

    // sentry-cli v3.4.2: field name is "file", not SHA1 → accept, key by computed SHA1
    #[test]
    fn test_chunk_storage_key_file_field_name_accepted_keyed_by_sha1() {
        let computed_sha1 = "612d44793ab6d1b3d311b9e1b73785e805ef239a";
        let result = chunk_storage_key("file", computed_sha1);
        assert_eq!(result.unwrap(), computed_sha1);
    }

    // any non-SHA1 field name → accept, key by computed SHA1
    #[test]
    fn test_chunk_storage_key_arbitrary_field_name_accepted_keyed_by_sha1() {
        let computed_sha1 = "612d44793ab6d1b3d311b9e1b73785e805ef239a";
        let result = chunk_storage_key("chunk_0", computed_sha1);
        assert_eq!(result.unwrap(), computed_sha1);
    }

    // uppercase SHA1 field name with matching content → accept, return lowercase canonical SHA1
    #[test]
    fn test_chunk_storage_key_uppercase_sha1_field_name_accepted() {
        let lowercase_sha1 = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
        let uppercase_field = "DA39A3EE5E6B4B0D3255BFEF95601890AFD80709";
        let result = chunk_storage_key(uppercase_field, lowercase_sha1);
        assert_eq!(result.unwrap(), lowercase_sha1);
    }

    // uppercase SHA1 field name with mismatched content → reject
    #[test]
    fn test_chunk_storage_key_uppercase_sha1_field_name_mismatch_rejected() {
        let uppercase_field = "DA39A3EE5E6B4B0D3255BFEF95601890AFD80709";
        let actual_sha1 = "aabbccdd5e6b4b0d3255bfef95601890afd80709";
        let result = chunk_storage_key(uppercase_field, actual_sha1);
        assert!(result.is_err());
        let err = format!("{:?}", result.unwrap_err());
        assert!(err.contains("checksum mismatch"));
    }
}
