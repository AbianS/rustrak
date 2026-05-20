//! Routes for the uptime monitoring API.

use actix_web::{web, HttpResponse};
use uuid::Uuid;

use crate::auth::ApiAuth;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::monitor::{CreateMonitor, UpdateMonitor};
use crate::services::monitor::MonitorService;
use crate::services::uptime::probes::{run_http_probe, run_tcp_probe};

// =============================================================================
// Handlers
// =============================================================================

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/monitors",
    tag = "Monitors",
    responses(
        (status = 200, description = "List of monitors", body = Vec<Monitor>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/monitors — list all monitors
pub async fn list_monitors(pool: web::Data<DbPool>, _auth: ApiAuth) -> AppResult<HttpResponse> {
    let monitors = MonitorService::list(pool.get_ref()).await?;
    Ok(HttpResponse::Ok().json(monitors))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/monitors/{id}",
    tag = "Monitors",
    params(("id" = Uuid, Path, description = "Monitor ID")),
    responses(
        (status = 200, description = "Monitor details", body = Monitor),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/monitors/:id — get a monitor by ID
pub async fn get_monitor(
    pool: web::Data<DbPool>,
    path: web::Path<Uuid>,
    _auth: ApiAuth,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    let monitor = MonitorService::get(pool.get_ref(), id).await?;
    Ok(HttpResponse::Ok().json(monitor))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/monitors",
    tag = "Monitors",
    request_body = CreateMonitor,
    responses(
        (status = 201, description = "Monitor created", body = Monitor),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/monitors — create a monitor
pub async fn create_monitor(
    pool: web::Data<DbPool>,
    body: web::Json<CreateMonitor>,
    _auth: ApiAuth,
) -> AppResult<HttpResponse> {
    let monitor = MonitorService::create(pool.get_ref(), body.into_inner()).await?;
    Ok(HttpResponse::Created().json(monitor))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    patch,
    path = "/api/monitors/{id}",
    tag = "Monitors",
    params(("id" = Uuid, Path, description = "Monitor ID")),
    request_body = UpdateMonitor,
    responses(
        (status = 200, description = "Monitor updated", body = Monitor),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// PATCH /api/monitors/:id — update a monitor
pub async fn update_monitor(
    pool: web::Data<DbPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateMonitor>,
    _auth: ApiAuth,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    let monitor = MonitorService::update(pool.get_ref(), id, body.into_inner()).await?;
    Ok(HttpResponse::Ok().json(monitor))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    delete,
    path = "/api/monitors/{id}",
    tag = "Monitors",
    params(("id" = Uuid, Path, description = "Monitor ID")),
    responses(
        (status = 204, description = "Monitor deleted"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// DELETE /api/monitors/:id — delete a monitor
pub async fn delete_monitor(
    pool: web::Data<DbPool>,
    path: web::Path<Uuid>,
    _auth: ApiAuth,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    MonitorService::delete(pool.get_ref(), id).await?;
    Ok(HttpResponse::NoContent().finish())
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/monitors/{id}/check",
    tag = "Monitors",
    params(("id" = Uuid, Path, description = "Monitor ID")),
    responses(
        (status = 200, description = "Probe result"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/monitors/:id/check — trigger a manual check (does NOT affect state machine)
pub async fn trigger_check(
    pool: web::Data<DbPool>,
    path: web::Path<Uuid>,
    _auth: ApiAuth,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    let monitor = MonitorService::get(pool.get_ref(), id).await?;

    let probe = match monitor.check_type.as_str() {
        "http" => {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(monitor.timeout_secs as u64))
                .build()
                .map_err(|e| crate::error::AppError::Internal(e.to_string()))?;
            run_http_probe(&client, &monitor).await
        }
        "tcp" => run_tcp_probe(&monitor).await,
        other => {
            return Err(crate::error::AppError::Validation(format!(
                "Unknown check_type: {other}"
            )))
        }
    };

    // Record in monitor_checks (status 2 = manual check)
    let check_id = uuid::Uuid::new_v4();
    let now = chrono::Utc::now();
    let status: i32 = if probe.ok { 1 } else { 0 };

    #[cfg(feature = "postgres")]
    sqlx::query(
        r#"
        INSERT INTO monitor_checks (id, monitor_id, checked_at, status, latency_ms, error_message)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(check_id)
    .bind(monitor.id)
    .bind(now)
    .bind(status)
    .bind(probe.latency_ms as i32)
    .bind(&probe.error)
    .execute(pool.get_ref())
    .await?;

    #[cfg(feature = "sqlite")]
    sqlx::query(
        r#"
        INSERT INTO monitor_checks (id, monitor_id, checked_at, status, latency_ms, error_message)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(check_id.to_string())
    .bind(monitor.id.to_string())
    .bind(now.naive_utc().to_string())
    .bind(status)
    .bind(probe.latency_ms as i32)
    .bind(&probe.error)
    .execute(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "ok": probe.ok,
        "latency_ms": probe.latency_ms,
        "error": probe.error,
    })))
}

// =============================================================================
// Route configuration
// =============================================================================

/// Configure monitor routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/monitors")
            .route("", web::get().to(list_monitors))
            .route("", web::post().to(create_monitor))
            .route("/{id}", web::get().to(get_monitor))
            .route("/{id}", web::patch().to(update_monitor))
            .route("/{id}", web::delete().to(delete_monitor))
            .route("/{id}/check", web::post().to(trigger_check)),
    );
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    // Route-level tests for validation rejection (400 responses).
    // These are integration tests that require a running app+db.
    // Unit-level validation is tested in services/monitor.rs.

    use super::*;
    use crate::models::monitor::CheckType;
    use crate::services::monitor::validate_monitor_url;

    #[tokio::test]
    async fn test_rfc1918_url_returns_validation_error() {
        let result = validate_monitor_url("http://10.0.0.1/health", &CheckType::Http).await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        // AppError::Validation maps to HTTP 400
        assert!(matches!(err, crate::error::AppError::Validation(_)));
        assert!(err.to_string().contains("reserved"));
    }

    #[tokio::test]
    async fn test_interval_too_low_returns_validation_error() {
        use crate::services::monitor::validate_monitor_bounds;
        let result = validate_monitor_bounds(10, 10, 2, 2);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err, crate::error::AppError::Validation(_)));
        assert!(err.to_string().contains("interval_secs"));
    }
}
