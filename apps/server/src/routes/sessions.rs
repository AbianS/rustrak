use actix_web::{web, HttpResponse};

use crate::auth::ApiActor;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::services::access::{self, Action};
use crate::services::session::SessionService;

#[cfg(feature = "openapi")]
use crate::models::session::ReleaseHealthRow;
#[cfg(feature = "openapi")]
use utoipa::OpenApi;

/// Query params for the stats endpoint.
#[derive(serde::Deserialize)]
pub struct StatsQuery {
    /// Time window in hours (default: 24).
    pub period: Option<String>,
}

impl StatsQuery {
    pub fn period_hours(&self) -> i64 {
        self.period
            .as_deref()
            .and_then(|p| {
                // Accept "24h", "48h", "7d", or bare integers (treated as hours).
                if let Some(stripped) = p.strip_suffix('h') {
                    stripped.parse::<i64>().ok()
                } else if let Some(stripped) = p.strip_suffix('d') {
                    stripped.parse::<i64>().ok().map(|d| d * 24)
                } else {
                    p.parse::<i64>().ok()
                }
            })
            .unwrap_or(24)
    }
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/sessions/stats",
    tag = "Sessions",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("period" = Option<String>, Query, description = "Time window, e.g. '24h', '7d' (default: 24h)"),
    ),
    responses(
        (status = 200, description = "Per-release health stats", body = Vec<ReleaseHealthRow>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/sessions/stats
pub async fn get_stats(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    query: web::Query<StatsQuery>,
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

    let period_hours = query.period_hours();
    let rows = SessionService::release_health(pool.get_ref(), project_id, period_hours).await?;

    Ok(HttpResponse::Ok().json(rows))
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(paths(get_stats), components(schemas(ReleaseHealthRow)))]
pub struct SessionsApi;

/// Configure session routes.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/projects/{project_id}/sessions").route("/stats", web::get().to(get_stats)),
    );
}
