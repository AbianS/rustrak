use actix_web::{web, HttpResponse};

use crate::auth::ApiActor;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::services::access::{self, Action};
use crate::services::session::SessionService;

#[cfg(feature = "openapi")]
use crate::models::session::{ReleaseHealthRow, SessionSummary, SessionTimeseriesPoint};
#[cfg(feature = "openapi")]
use utoipa::OpenApi;

/// Query params for the stats endpoint.
#[derive(serde::Deserialize)]
pub struct StatsQuery {
    /// Time window in hours (default: 24).
    pub period: Option<String>,
}

impl StatsQuery {
    pub fn period_hours(&self) -> Option<i64> {
        self.period
            .as_deref()
            .and_then(|p| {
                // Accept "24h", "48h", "7d", or bare integers (treated as hours).
                if let Some(stripped) = p.strip_suffix('h') {
                    stripped.parse::<i64>().ok()
                } else if let Some(stripped) = p.strip_suffix('d') {
                    stripped.parse::<i64>().ok().and_then(|d| d.checked_mul(24))
                } else {
                    p.parse::<i64>().ok()
                }
            })
            // Clamp to 1 hour – 90 days to prevent negative intervals and table scans
            .map(|h| h.clamp(1, 90 * 24))
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

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/sessions/summary",
    tag = "Sessions",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("period" = Option<String>, Query, description = "Time window, e.g. '24h', '7d' (default: 24h)"),
    ),
    responses(
        (status = 200, description = "Project-wide session health summary", body = SessionSummary),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/sessions/summary
pub async fn get_summary(
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
    let summary = SessionService::project_summary(pool.get_ref(), project_id, period_hours).await?;

    Ok(HttpResponse::Ok().json(summary))
}

/// Query params for the timeseries endpoint.
#[derive(serde::Deserialize)]
pub struct TimeseriesQuery {
    /// Time window in hours (default: 24).
    pub period: Option<String>,
    /// Bucket width in hours (default: 1, clamped to 1-24).
    pub interval: Option<i64>,
}

impl TimeseriesQuery {
    fn period_hours(&self) -> Option<i64> {
        StatsQuery {
            period: self.period.clone(),
        }
        .period_hours()
    }

    fn interval_hours(&self) -> i64 {
        self.interval.unwrap_or(1).clamp(1, 24)
    }
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/sessions/timeseries",
    tag = "Sessions",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("period" = Option<String>, Query, description = "Time window, e.g. '24h', '7d' (default: 24h)"),
        ("interval" = Option<i64>, Query, description = "Bucket width in hours (default: 1, max: 24)"),
    ),
    responses(
        (status = 200, description = "Time-bucketed session trend, project-wide", body = Vec<SessionTimeseriesPoint>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/sessions/timeseries
pub async fn get_timeseries(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    query: web::Query<TimeseriesQuery>,
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

    let points = SessionService::session_timeseries(
        pool.get_ref(),
        project_id,
        query.period_hours(),
        query.interval_hours(),
    )
    .await?;

    Ok(HttpResponse::Ok().json(points))
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(
    paths(get_stats, get_summary, get_timeseries),
    components(schemas(ReleaseHealthRow, SessionSummary, SessionTimeseriesPoint))
)]
pub struct SessionsApi;

/// Configure session routes.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/projects/{project_id}/sessions")
            .route("/stats", web::get().to(get_stats))
            .route("/summary", web::get().to(get_summary))
            .route("/timeseries", web::get().to(get_timeseries)),
    );
}
