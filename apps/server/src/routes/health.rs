use actix_web::{http::StatusCode, web, HttpResponse};
use serde::Serialize;

use crate::db::{self, DbPool};

#[cfg(feature = "openapi")]
use utoipa::OpenApi;

#[derive(Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct LivenessResponse {
    status: &'static str,
}

#[derive(Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ReadinessResponse {
    status: &'static str,
    checks: ReadinessChecks,
}

#[derive(Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ReadinessChecks {
    database: &'static str,
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/health",
    tag = "Health",
    responses(
        (status = 200, description = "Server is alive", body = LivenessResponse),
    ),
))]
/// Liveness check - is the process running?
/// Returns 200 if the server is alive.
pub async fn liveness() -> HttpResponse {
    HttpResponse::Ok().json(LivenessResponse { status: "ok" })
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/health/ready",
    tag = "Health",
    responses(
        (status = 200, description = "Service is ready", body = ReadinessResponse),
        (status = 503, description = "Service unavailable", body = ReadinessResponse),
    ),
))]
/// Readiness check - is the service ready to handle requests?
/// Returns 200 if all dependencies are available, 503 otherwise.
pub async fn readiness(pool: web::Data<DbPool>) -> HttpResponse {
    let db_healthy = db::health_check(pool.get_ref()).await;

    let (status, db_status, http_status) = if db_healthy {
        ("ready", "ok", StatusCode::OK)
    } else {
        ("not_ready", "error", StatusCode::SERVICE_UNAVAILABLE)
    };

    let response = ReadinessResponse {
        status,
        checks: ReadinessChecks {
            database: db_status,
        },
    };

    HttpResponse::build(http_status).json(response)
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(
    paths(liveness, readiness),
    components(schemas(LivenessResponse, ReadinessResponse, ReadinessChecks))
)]
pub struct HealthApi;
