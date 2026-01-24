//! Alert routes for managing notification channels and alert rules.
//!
//! ## Notification Channels (Global)
//! - GET /api/alert-channels - List all channels
//! - POST /api/alert-channels - Create channel
//! - GET /api/alert-channels/{id} - Get channel
//! - PATCH /api/alert-channels/{id} - Update channel
//! - DELETE /api/alert-channels/{id} - Delete channel
//! - POST /api/alert-channels/{id}/test - Test channel
//!
//! ## Alert Rules (Per-Project)
//! - GET /api/projects/{project_id}/alert-rules - List rules
//! - POST /api/projects/{project_id}/alert-rules - Create rule
//! - GET /api/projects/{project_id}/alert-rules/{rule_id} - Get rule
//! - PATCH /api/projects/{project_id}/alert-rules/{rule_id} - Update rule
//! - DELETE /api/projects/{project_id}/alert-rules/{rule_id} - Delete rule
//!
//! ## Alert History
//! - GET /api/projects/{project_id}/alert-history - List history

use actix_web::{web, HttpResponse};
use chrono::Utc;
use serde::Deserialize;

use crate::auth::AuthenticatedUser;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::{
    AlertPayload, CreateAlertRule, CreateNotificationChannel, IssueInfo, ProjectInfo,
    UpdateAlertRule, UpdateNotificationChannel,
};
use crate::services::{create_dispatcher, AlertService, ProjectService};

// =============================================================================
// Notification Channel Endpoints
// =============================================================================

/// GET /api/alert-channels
pub async fn list_channels(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser,
) -> AppResult<HttpResponse> {
    let channels = AlertService::list_channels(pool.get_ref()).await?;
    Ok(HttpResponse::Ok().json(channels))
}

/// POST /api/alert-channels
pub async fn create_channel(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser,
    body: web::Json<CreateNotificationChannel>,
) -> AppResult<HttpResponse> {
    let channel = AlertService::create_channel(pool.get_ref(), body.into_inner()).await?;
    Ok(HttpResponse::Created().json(channel))
}

/// GET /api/alert-channels/{id}
pub async fn get_channel(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser,
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    let channel = AlertService::get_channel(pool.get_ref(), path.into_inner()).await?;
    Ok(HttpResponse::Ok().json(channel))
}

/// PATCH /api/alert-channels/{id}
pub async fn update_channel(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser,
    path: web::Path<i32>,
    body: web::Json<UpdateNotificationChannel>,
) -> AppResult<HttpResponse> {
    let channel =
        AlertService::update_channel(pool.get_ref(), path.into_inner(), body.into_inner()).await?;
    Ok(HttpResponse::Ok().json(channel))
}

/// DELETE /api/alert-channels/{id}
pub async fn delete_channel(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser,
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    AlertService::delete_channel(pool.get_ref(), path.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// POST /api/alert-channels/{id}/test
pub async fn test_channel(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser,
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    let channel = AlertService::get_channel(pool.get_ref(), path.into_inner()).await?;

    // Create a test payload
    let test_payload = AlertPayload {
        alert_id: format!("test-{}", Utc::now().timestamp_millis()),
        alert_type: "test".to_string(),
        triggered_at: Utc::now(),
        project: ProjectInfo {
            id: 0,
            name: "Test Project".to_string(),
            slug: "test-project".to_string(),
        },
        issue: IssueInfo {
            id: "00000000-0000-0000-0000-000000000000".to_string(),
            short_id: "TEST-1".to_string(),
            title: "This is a test alert from Rustrak".to_string(),
            level: Some("info".to_string()),
            first_seen: Utc::now(),
            last_seen: Utc::now(),
            event_count: 1,
        },
        issue_url: "https://example.com/test".to_string(),
        actor: "Rustrak Test".to_string(),
    };

    // Send test notification
    let dispatcher = create_dispatcher(channel.channel_type);
    let result = dispatcher.send(&channel, &test_payload).await;

    if result.success {
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "Test notification sent successfully"
        })))
    } else {
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": false,
            "message": result.error_message.unwrap_or_else(|| "Unknown error".to_string())
        })))
    }
}

// =============================================================================
// Alert Rule Endpoints
// =============================================================================

/// GET /api/projects/{project_id}/alert-rules
pub async fn list_rules(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser,
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();

    // Verify project exists
    let _ = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

    let rules = AlertService::list_rules(pool.get_ref(), project_id).await?;

    // Enrich with channel IDs
    let mut responses = Vec::new();
    for rule in rules {
        let channel_ids = AlertService::get_rule_channels(pool.get_ref(), rule.id).await?;
        responses.push(rule.to_response(channel_ids));
    }

    Ok(HttpResponse::Ok().json(responses))
}

/// POST /api/projects/{project_id}/alert-rules
pub async fn create_rule(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser,
    path: web::Path<i32>,
    body: web::Json<CreateAlertRule>,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();

    // Verify project exists
    let _ = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

    let rule = AlertService::create_rule(pool.get_ref(), project_id, body.into_inner()).await?;
    let channel_ids = AlertService::get_rule_channels(pool.get_ref(), rule.id).await?;

    Ok(HttpResponse::Created().json(rule.to_response(channel_ids)))
}

#[derive(Deserialize)]
pub struct RulePath {
    pub project_id: i32,
    pub rule_id: i32,
}

/// GET /api/projects/{project_id}/alert-rules/{rule_id}
pub async fn get_rule(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser,
    path: web::Path<RulePath>,
) -> AppResult<HttpResponse> {
    let params = path.into_inner();

    // Verify project exists
    let _ = ProjectService::get_by_id(pool.get_ref(), params.project_id).await?;

    let rule = AlertService::get_rule(pool.get_ref(), params.rule_id).await?;

    // Verify rule belongs to project
    if rule.project_id != params.project_id {
        return Err(crate::error::AppError::NotFound(
            "Alert rule not found in this project".to_string(),
        ));
    }

    let channel_ids = AlertService::get_rule_channels(pool.get_ref(), rule.id).await?;

    Ok(HttpResponse::Ok().json(rule.to_response(channel_ids)))
}

/// PATCH /api/projects/{project_id}/alert-rules/{rule_id}
pub async fn update_rule(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser,
    path: web::Path<RulePath>,
    body: web::Json<UpdateAlertRule>,
) -> AppResult<HttpResponse> {
    let params = path.into_inner();

    // Verify project exists
    let _ = ProjectService::get_by_id(pool.get_ref(), params.project_id).await?;

    // Verify rule belongs to project
    let existing = AlertService::get_rule(pool.get_ref(), params.rule_id).await?;
    if existing.project_id != params.project_id {
        return Err(crate::error::AppError::NotFound(
            "Alert rule not found in this project".to_string(),
        ));
    }

    let rule = AlertService::update_rule(pool.get_ref(), params.rule_id, body.into_inner()).await?;
    let channel_ids = AlertService::get_rule_channels(pool.get_ref(), rule.id).await?;

    Ok(HttpResponse::Ok().json(rule.to_response(channel_ids)))
}

/// DELETE /api/projects/{project_id}/alert-rules/{rule_id}
pub async fn delete_rule(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser,
    path: web::Path<RulePath>,
) -> AppResult<HttpResponse> {
    let params = path.into_inner();

    // Verify project exists
    let _ = ProjectService::get_by_id(pool.get_ref(), params.project_id).await?;

    // Verify rule belongs to project
    let existing = AlertService::get_rule(pool.get_ref(), params.rule_id).await?;
    if existing.project_id != params.project_id {
        return Err(crate::error::AppError::NotFound(
            "Alert rule not found in this project".to_string(),
        ));
    }

    AlertService::delete_rule(pool.get_ref(), params.rule_id).await?;

    Ok(HttpResponse::NoContent().finish())
}

// =============================================================================
// Alert History Endpoints
// =============================================================================

#[derive(Deserialize)]
pub struct HistoryQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

/// GET /api/projects/{project_id}/alert-history
pub async fn list_history(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser,
    path: web::Path<i32>,
    query: web::Query<HistoryQuery>,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();

    // Verify project exists
    let _ = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

    let limit = query.limit.min(100).max(1);
    let history = AlertService::list_history(pool.get_ref(), project_id, limit).await?;

    Ok(HttpResponse::Ok().json(history))
}

// =============================================================================
// Route Configuration
// =============================================================================

/// Configure alert channel routes (global)
pub fn configure_channels(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/alert-channels")
            .route("", web::get().to(list_channels))
            .route("", web::post().to(create_channel))
            .route("/{id}", web::get().to(get_channel))
            .route("/{id}", web::patch().to(update_channel))
            .route("/{id}", web::delete().to(delete_channel))
            .route("/{id}/test", web::post().to(test_channel)),
    );
}

/// Configure alert rule routes (per-project)
pub fn configure_rules(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/projects/{project_id}/alert-rules")
            .route("", web::get().to(list_rules))
            .route("", web::post().to(create_rule))
            .route("/{rule_id}", web::get().to(get_rule))
            .route("/{rule_id}", web::patch().to(update_rule))
            .route("/{rule_id}", web::delete().to(delete_rule)),
    );
}

/// Configure alert history routes
pub fn configure_history(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/projects/{project_id}/alert-history")
            .route(web::get().to(list_history)),
    );
}

/// Configure all alert routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    configure_channels(cfg);
    configure_rules(cfg);
    configure_history(cfg);
}
