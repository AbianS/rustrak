use actix_multipart::Multipart;
use actix_web::{web, HttpRequest, HttpResponse};
use futures_util::StreamExt as _;
use serde::{Deserialize, Serialize};
use sha1::Digest as _;
use std::sync::Arc;

use crate::auth::BearerAuth;
use crate::config::Config;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::services::sourcemap::{get_missing_chunks, store_chunks, SourceMapProvider};

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

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
    req: HttpRequest,
    _auth: BearerAuth,
) -> AppResult<HttpResponse> {
    let org_slug = path.into_inner();

    // Build base URL from request
    let conn = req.connection_info();
    let base_url = format!("{}://{}", conn.scheme(), conn.host());

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "url": format!("{}/api/0/organizations/{}/chunk-upload/", base_url, org_slug),
        "chunkSize": 2_097_152u64,
        "chunksPerRequest": 64,
        "maxRequestSize": 33_554_432u64,
        "hashAlgorithm": "sha1",
        "accept": ["release_files", "sources", "artifact_bundles", "artifact_bundles_v2"],
        "concurrency": 8
    })))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/0/organizations/{org_slug}/chunk-upload/",
    tag = "Source Maps",
    params(("org_slug" = String, Path, description = "Organization slug")),
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
    _auth: BearerAuth,
    pool: web::Data<DbPool>,
    config: web::Data<Config>,
    mut payload: Multipart,
) -> AppResult<HttpResponse> {
    let max_chunk_size = config.max_chunk_size_bytes;
    let mut parts: Vec<(String, Vec<u8>)> = Vec::new();

    while let Some(field_result) = payload.next().await {
        let mut field =
            field_result.map_err(|e| AppError::Validation(format!("multipart error: {}", e)))?;

        let field_name = field
            .content_disposition()
            .and_then(|cd| cd.get_name().map(|s| s.to_string()))
            .unwrap_or_default();

        // Only process "file" fields
        if field_name != "file" {
            continue;
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

        let sha1_hex = hex::encode(hasher.finalize());
        parts.push((sha1_hex, buf));
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
        (status = 200, description = "Assembly job state (ok / created / processing)", body = AssembleResponse),
        (status = 202, description = "Missing chunks — upload required", body = AssembleResponse),
        (status = 400, description = "Bad request or checksum mismatch", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Project not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/0/organizations/{org_slug}/artifactbundle/assemble/
pub async fn artifact_bundle_assemble(
    _path: web::Path<String>,
    _auth: BearerAuth,
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

    // Lookup project by slug
    let project_slug = &body.projects[0];
    let project: Option<(i32,)> = sqlx::query_as("SELECT id FROM projects WHERE slug = $1")
        .bind(project_slug)
        .fetch_optional(pool.get_ref())
        .await?;
    let project_id = match project {
        Some((id,)) => id,
        None => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "detail": "project not found"
            })));
        }
    };

    // Check for missing chunks
    let missing = get_missing_chunks(pool.get_ref(), &body.chunks).await?;
    if !missing.is_empty() {
        return Ok(HttpResponse::Accepted().json(AssembleResponse {
            state: "not_found".to_string(),
            missing_chunks: missing,
            detail: None,
        }));
    }

    // INSERT ... ON CONFLICT DO NOTHING RETURNING *
    #[cfg(feature = "postgres")]
    let job: Option<crate::models::source_file::AssemblyJob> = sqlx::query_as(
        r#"
        INSERT INTO assembly_jobs(bundle_checksum, project_id, chunks, state)
        VALUES ($1, $2, $3, 'created')
        ON CONFLICT(bundle_checksum, project_id) DO NOTHING
        RETURNING *
        "#,
    )
    .bind(&body.checksum)
    .bind(project_id)
    .bind(&body.chunks as &Vec<String>)
    .fetch_optional(pool.get_ref())
    .await?;

    #[cfg(not(feature = "postgres"))]
    let job: Option<crate::models::source_file::AssemblyJob> = {
        let chunks_json =
            serde_json::to_string(&body.chunks).map_err(|e| AppError::Internal(e.to_string()))?;
        sqlx::query_as(
            r#"
            INSERT INTO assembly_jobs(bundle_checksum, project_id, chunks, state)
            VALUES ($1, $2, $3, 'created')
            ON CONFLICT(bundle_checksum, project_id) DO NOTHING
            RETURNING *
            "#,
        )
        .bind(&body.checksum)
        .bind(project_id)
        .bind(&chunks_json)
        .fetch_optional(pool.get_ref())
        .await?
    };

    // If None (conflict — job already exists): fetch existing
    let job = match job {
        Some(j) => j,
        None => {
            sqlx::query_as(
                "SELECT * FROM assembly_jobs WHERE bundle_checksum = $1 AND project_id = $2",
            )
            .bind(&body.checksum)
            .bind(project_id)
            .fetch_one(pool.get_ref())
            .await?
        }
    };

    // Map job state to response
    match job.state.as_str() {
        "ok" => Ok(HttpResponse::Ok().json(AssembleResponse {
            state: "ok".to_string(),
            missing_chunks: vec![],
            detail: None,
        })),
        "error" => Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "state": "error",
            "detail": job.detail.unwrap_or_default()
        }))),
        state => Ok(HttpResponse::Ok().json(AssembleResponse {
            state: state.to_string(),
            missing_chunks: vec![],
            detail: None,
        })),
    }
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
    _auth: BearerAuth,
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
