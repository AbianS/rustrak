use actix_web::{web, HttpResponse};
use serde::Serialize;

use crate::auth::ApiActor;
use crate::db::DbPool;
use crate::error::AppResult;
#[cfg(feature = "openapi")]
use crate::models::CheckInResponse;
use crate::models::MonitorResponse;
use crate::pagination::{ListCheckInsQuery, OffsetPaginatedResponse};
use crate::services::access::{self, Action};
use crate::services::monitor::MonitorService;

#[cfg(feature = "openapi")]
use utoipa::OpenApi;

/// Wrapper for the (unpaginated) monitor list response.
#[derive(Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MonitorsListResponse {
    pub monitors: Vec<MonitorResponse>,
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/monitors",
    tag = "Monitors",
    params(("project_id" = i32, Path, description = "Project ID")),
    responses(
        (status = 200, description = "List of monitors", body = MonitorsListResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/monitors
/// Lists all monitors (Sentry Crons) for a project, most-recently-active first.
pub async fn list_monitors(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();

    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ViewProject,
    )
    .await?;

    let monitors = MonitorService::list_monitors(pool.get_ref(), project_id).await?;
    Ok(HttpResponse::Ok().json(MonitorsListResponse { monitors }))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/monitors/{slug}/checkins",
    tag = "Monitors",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("slug" = String, Path, description = "Monitor slug"),
        ListCheckInsQuery,
    ),
    responses(
        (status = 200, description = "Paginated check-in list", body = inline(crate::pagination::OffsetPaginatedResponse<CheckInResponse>)),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/monitors/{slug}/checkins
/// Lists check-ins for one monitor with offset pagination (newest first).
pub async fn list_check_ins(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, String)>,
    query: web::Query<ListCheckInsQuery>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, slug) = path.into_inner();

    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ViewProject,
    )
    .await?;

    let page = query.page.max(1);
    let per_page = query.per_page.clamp(1, 100);

    let (check_ins, total_count) =
        MonitorService::list_check_ins(pool.get_ref(), project_id, &slug, page, per_page).await?;

    Ok(HttpResponse::Ok().json(OffsetPaginatedResponse::new(
        check_ins,
        total_count,
        page,
        per_page,
    )))
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(paths(list_monitors, list_check_ins))]
pub struct MonitorsApi;

/// Configure monitor routes.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/projects/{project_id}/monitors")
            .route("", web::get().to(list_monitors))
            .route("/{slug}/checkins", web::get().to(list_check_ins)),
    );
}
