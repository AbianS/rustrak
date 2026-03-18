use actix_web::{http::StatusCode, web, HttpResponse};
use serde::Serialize;
use utoipa::ToSchema;

use crate::db::{self, DbPool};

#[derive(Serialize, ToSchema)]
pub struct LivenessResponse {
    status: &'static str,
}

#[derive(Serialize, ToSchema)]
pub struct ReadinessResponse {
    status: &'static str,
    checks: ReadinessChecks,
}

#[derive(Serialize, ToSchema)]
pub struct ReadinessChecks {
    database: &'static str,
}

/// Liveness check - is the process running?
/// Returns 200 if the server is alive.
#[utoipa::path(
    get,
    path = "/health",
    tag = "health",
    responses(
        (status = 200, description = "Server is alive", body = LivenessResponse),
    ),
)]
pub async fn liveness() -> HttpResponse {
    HttpResponse::Ok().json(LivenessResponse { status: "ok" })
}

/// Readiness check - is the service ready to handle requests?
/// Returns 200 if all dependencies are available, 503 otherwise.
#[utoipa::path(
    get,
    path = "/health/ready",
    tag = "health",
    responses(
        (status = 200, description = "Service is ready", body = ReadinessResponse),
        (status = 503, description = "Service is not ready", body = ReadinessResponse),
    ),
)]
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
