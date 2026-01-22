use actix_web::{http::StatusCode, web, HttpResponse};
use serde::Serialize;

use crate::db::{self, DbPool};

#[derive(Serialize)]
pub struct LivenessResponse {
    status: &'static str,
}

#[derive(Serialize)]
pub struct ReadinessResponse {
    status: &'static str,
    checks: ReadinessChecks,
}

#[derive(Serialize)]
pub struct ReadinessChecks {
    database: &'static str,
}

/// Liveness check - is the process running?
/// Returns 200 if the server is alive.
pub async fn liveness() -> HttpResponse {
    HttpResponse::Ok().json(LivenessResponse { status: "ok" })
}

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
