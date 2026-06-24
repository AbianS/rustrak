//! Admin-only Storage API: usage visibility + retention/cleanup.
//!
//! Every endpoint is gated to global admins — usage exposes the whole instance
//! and cleanup is destructive, so neither is project-scoped RBAC territory.

use std::sync::Arc;

use actix_web::{web, HttpResponse};

use crate::auth::ApiActor;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::CleanupRequest;
#[cfg(feature = "openapi")]
use crate::models::{
    CleanupCounts, ProjectStorage, SourceMapGcResult, SourceMapStorage, StorageSummary,
};
use crate::services::sourcemap_store::SourceMapStore;
use crate::services::StorageService;

#[cfg(feature = "openapi")]
use utoipa::OpenApi;

/// Ensures the actor is a global admin, else 403.
fn require_admin(actor: &ApiActor) -> AppResult<()> {
    if actor.is_admin() {
        Ok(())
    } else {
        Err(AppError::Forbidden("Admin privileges required".to_string()))
    }
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/storage/summary",
    tag = "Storage",
    responses(
        (status = 200, description = "Instance-wide storage summary", body = StorageSummary),
        (status = 403, description = "Forbidden", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/storage/summary — row counts, DB size, and source-map weight.
pub async fn get_summary(pool: web::Data<DbPool>, actor: ApiActor) -> AppResult<HttpResponse> {
    require_admin(&actor)?;
    let summary = StorageService::global_summary(pool.get_ref()).await?;
    Ok(HttpResponse::Ok().json(summary))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/storage/projects",
    tag = "Storage",
    responses(
        (status = 200, description = "Per-project storage breakdown", body = inline(Vec<ProjectStorage>)),
        (status = 403, description = "Forbidden", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/storage/projects — per-project counts and estimated weight.
pub async fn get_projects(pool: web::Data<DbPool>, actor: ApiActor) -> AppResult<HttpResponse> {
    require_admin(&actor)?;
    let rows = StorageService::by_project(pool.get_ref()).await?;
    Ok(HttpResponse::Ok().json(rows))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/storage/cleanup/preview",
    tag = "Storage",
    request_body = CleanupRequest,
    responses(
        (status = 200, description = "Dry-run: rows a cleanup would remove", body = CleanupCounts),
        (status = 403, description = "Forbidden", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/storage/cleanup/preview — dry-run count, mutates nothing.
pub async fn preview_cleanup(
    pool: web::Data<DbPool>,
    actor: ApiActor,
    body: web::Json<CleanupRequest>,
) -> AppResult<HttpResponse> {
    require_admin(&actor)?;
    let counts =
        StorageService::preview_cleanup(pool.get_ref(), body.older_than_days, body.project_id)
            .await?;
    Ok(HttpResponse::Ok().json(counts))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/storage/cleanup",
    tag = "Storage",
    request_body = CleanupRequest,
    responses(
        (status = 200, description = "Cleanup executed; rows removed", body = CleanupCounts),
        (status = 403, description = "Forbidden", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/storage/cleanup — deletes old data and removes emptied issues.
pub async fn execute_cleanup(
    pool: web::Data<DbPool>,
    actor: ApiActor,
    body: web::Json<CleanupRequest>,
) -> AppResult<HttpResponse> {
    require_admin(&actor)?;
    let counts =
        StorageService::execute_cleanup(pool.get_ref(), body.older_than_days, body.project_id)
            .await?;
    Ok(HttpResponse::Ok().json(counts))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/storage/source-maps/gc/preview",
    tag = "Storage",
    responses(
        (status = 200, description = "Dry-run: orphaned source maps a GC would remove", body = SourceMapGcResult),
        (status = 403, description = "Forbidden", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/storage/source-maps/gc/preview — dry-run orphan count, deletes nothing.
pub async fn preview_source_map_gc(
    pool: web::Data<DbPool>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    require_admin(&actor)?;
    let result = StorageService::preview_source_map_gc(pool.get_ref()).await?;
    Ok(HttpResponse::Ok().json(result))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/storage/source-maps/gc",
    tag = "Storage",
    responses(
        (status = 200, description = "Orphaned source maps removed", body = SourceMapGcResult),
        (status = 403, description = "Forbidden", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/storage/source-maps/gc — delete orphaned source maps (DB + disk).
pub async fn gc_source_maps(
    pool: web::Data<DbPool>,
    store: web::Data<Arc<dyn SourceMapStore>>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    require_admin(&actor)?;
    let result = StorageService::gc_source_maps(pool.get_ref(), store.get_ref().as_ref()).await?;
    Ok(HttpResponse::Ok().json(result))
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(
    paths(
        get_summary,
        get_projects,
        preview_cleanup,
        execute_cleanup,
        preview_source_map_gc,
        gc_source_maps
    ),
    components(schemas(
        StorageSummary,
        SourceMapStorage,
        ProjectStorage,
        CleanupCounts,
        CleanupRequest,
        SourceMapGcResult,
    ))
)]
pub struct StorageApi;

/// Configure storage routes.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/storage")
            .route("/summary", web::get().to(get_summary))
            .route("/projects", web::get().to(get_projects))
            .route("/cleanup/preview", web::post().to(preview_cleanup))
            .route("/cleanup", web::post().to(execute_cleanup))
            .route(
                "/source-maps/gc/preview",
                web::post().to(preview_source_map_gc),
            )
            .route("/source-maps/gc", web::post().to(gc_source_maps)),
    );
}
