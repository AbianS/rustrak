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

use crate::auth::ApiAuth;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::ChannelType;
use crate::models::{
    AlertPayload, CreateAlertRule, CreateNotificationChannel, IssueInfo, ProjectInfo,
    UpdateAlertRule, UpdateNotificationChannel,
};
#[cfg(feature = "openapi")]
use crate::models::{AlertRuleResponse, NotificationChannel};
use crate::services::{create_dispatcher, AlertService, ProjectService};

#[cfg(feature = "openapi")]
use utoipa::OpenApi;

// =============================================================================
// Token redaction
// =============================================================================

/// Redacts the bot token in a Slack channel's config before sending the
/// channel over the API. Replaces `config.token` with `"xoxb-****"` when
/// `channel_type == slack` and `config.method == "bot_token"`.
///
/// This prevents live `xoxb-…` tokens from being exposed via GET responses.
pub fn redact_slack_bot_token(channel_type: ChannelType, config: &mut serde_json::Value) {
    if channel_type == ChannelType::Slack
        && config.get("method").and_then(|v| v.as_str()) == Some("bot_token")
    {
        if let Some(obj) = config.as_object_mut() {
            if obj.contains_key("token") {
                obj.insert(
                    "token".to_string(),
                    serde_json::Value::String("xoxb-****".to_string()),
                );
            }
        }
    }
}

// =============================================================================
// Notification Channel Endpoints
// =============================================================================

fn channel_to_safe_json(channel: &crate::models::NotificationChannel) -> serde_json::Value {
    let mut value = serde_json::to_value(channel).unwrap_or_default();
    if let Some(config) = value.get_mut("config") {
        redact_slack_bot_token(channel.channel_type, config);
    }
    value
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/alert-channels",
    tag = "Alert Channels",
    responses(
        (status = 200, description = "List of notification channels", body = Vec<NotificationChannel>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/alert-channels
pub async fn list_channels(pool: web::Data<DbPool>, _auth: ApiAuth) -> AppResult<HttpResponse> {
    let channels = AlertService::list_channels(pool.get_ref()).await?;
    let safe: Vec<serde_json::Value> = channels.iter().map(channel_to_safe_json).collect();
    Ok(HttpResponse::Ok().json(safe))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/alert-channels",
    tag = "Alert Channels",
    request_body = CreateNotificationChannel,
    responses(
        (status = 201, description = "Channel created", body = NotificationChannel),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/alert-channels
pub async fn create_channel(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
    body: web::Json<CreateNotificationChannel>,
) -> AppResult<HttpResponse> {
    let channel = AlertService::create_channel(pool.get_ref(), body.into_inner()).await?;
    Ok(HttpResponse::Created().json(channel_to_safe_json(&channel)))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/alert-channels/{id}",
    tag = "Alert Channels",
    params(("id" = i32, Path, description = "Channel ID")),
    responses(
        (status = 200, description = "Channel details", body = NotificationChannel),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/alert-channels/{id}
pub async fn get_channel(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    let channel = AlertService::get_channel(pool.get_ref(), path.into_inner()).await?;
    Ok(HttpResponse::Ok().json(channel_to_safe_json(&channel)))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    patch,
    path = "/api/alert-channels/{id}",
    tag = "Alert Channels",
    params(("id" = i32, Path, description = "Channel ID")),
    request_body = UpdateNotificationChannel,
    responses(
        (status = 200, description = "Channel updated", body = NotificationChannel),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// PATCH /api/alert-channels/{id}
pub async fn update_channel(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
    path: web::Path<i32>,
    body: web::Json<UpdateNotificationChannel>,
) -> AppResult<HttpResponse> {
    let channel =
        AlertService::update_channel(pool.get_ref(), path.into_inner(), body.into_inner()).await?;
    Ok(HttpResponse::Ok().json(channel_to_safe_json(&channel)))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    delete,
    path = "/api/alert-channels/{id}",
    tag = "Alert Channels",
    params(("id" = i32, Path, description = "Channel ID")),
    responses(
        (status = 204, description = "Channel deleted"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// DELETE /api/alert-channels/{id}
pub async fn delete_channel(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    AlertService::delete_channel(pool.get_ref(), path.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/alert-channels/{id}/test",
    tag = "Alert Channels",
    params(("id" = i32, Path, description = "Channel ID")),
    responses(
        (status = 200, description = "Test notification sent"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/alert-channels/{id}/test
pub async fn test_channel(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
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

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/alert-rules",
    tag = "Alert Rules",
    params(("project_id" = i32, Path, description = "Project ID")),
    responses(
        (status = 200, description = "List of alert rules", body = Vec<AlertRuleResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Project not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/alert-rules
pub async fn list_rules(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
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

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/projects/{project_id}/alert-rules",
    tag = "Alert Rules",
    params(("project_id" = i32, Path, description = "Project ID")),
    request_body = CreateAlertRule,
    responses(
        (status = 201, description = "Alert rule created", body = AlertRuleResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Project not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/projects/{project_id}/alert-rules
pub async fn create_rule(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
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

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/alert-rules/{rule_id}",
    tag = "Alert Rules",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("rule_id" = i32, Path, description = "Alert rule ID"),
    ),
    responses(
        (status = 200, description = "Alert rule details", body = AlertRuleResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/alert-rules/{rule_id}
pub async fn get_rule(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
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

#[cfg_attr(feature = "openapi", utoipa::path(
    patch,
    path = "/api/projects/{project_id}/alert-rules/{rule_id}",
    tag = "Alert Rules",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("rule_id" = i32, Path, description = "Alert rule ID"),
    ),
    request_body = UpdateAlertRule,
    responses(
        (status = 200, description = "Alert rule updated", body = AlertRuleResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// PATCH /api/projects/{project_id}/alert-rules/{rule_id}
pub async fn update_rule(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
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

#[cfg_attr(feature = "openapi", utoipa::path(
    delete,
    path = "/api/projects/{project_id}/alert-rules/{rule_id}",
    tag = "Alert Rules",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("rule_id" = i32, Path, description = "Alert rule ID"),
    ),
    responses(
        (status = 204, description = "Alert rule deleted"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// DELETE /api/projects/{project_id}/alert-rules/{rule_id}
pub async fn delete_rule(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
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

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/alert-history",
    tag = "Alert Rules",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("limit" = Option<i64>, Query, description = "Max records to return (default 50, max 100)"),
    ),
    responses(
        (status = 200, description = "Alert history", body = Vec<crate::models::AlertHistory>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Project not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/alert-history
pub async fn list_history(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
    path: web::Path<i32>,
    query: web::Query<HistoryQuery>,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();

    // Verify project exists
    let _ = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

    let limit = query.limit.clamp(1, 100);
    let history = AlertService::list_history(pool.get_ref(), project_id, limit).await?;

    Ok(HttpResponse::Ok().json(history))
}

// =============================================================================
// Route Configuration
// =============================================================================

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(
    paths(
        list_channels,
        create_channel,
        get_channel,
        update_channel,
        delete_channel,
        test_channel,
        list_rules,
        create_rule,
        get_rule,
        update_rule,
        delete_rule,
        list_history,
    ),
    components(schemas(
        crate::models::NotificationChannel,
        crate::models::CreateNotificationChannel,
        crate::models::UpdateNotificationChannel,
        crate::models::ChannelType,
        crate::models::AlertRuleResponse,
        crate::models::CreateAlertRule,
        crate::models::UpdateAlertRule,
        crate::models::AlertType,
        crate::models::AlertStatus,
        crate::models::AlertHistory,
    ))
)]
pub struct AlertsApi;

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

#[cfg(test)]
mod tests {
    use super::*;

    // Cycle 5 RED: redact_slack_bot_token replaces token value for bot_token method
    #[test]
    fn test_redact_slack_bot_token_replaces_token() {
        let mut config = serde_json::json!({
            "method": "bot_token",
            "token": "xoxb-real-secret-token",
            "channel": "#alerts"
        });
        redact_slack_bot_token(ChannelType::Slack, &mut config);
        assert_eq!(config["token"], "xoxb-****");
        // Other fields untouched
        assert_eq!(config["channel"], "#alerts");
        assert_eq!(config["method"], "bot_token");
    }

    #[test]
    fn test_redact_slack_bot_token_noop_for_webhook_method() {
        let mut config = serde_json::json!({
            "method": "webhook",
            "webhook_url": "https://hooks.slack.com/services/T/B/X"
        });
        redact_slack_bot_token(ChannelType::Slack, &mut config);
        // Must not touch webhook config at all
        assert!(config.get("token").is_none());
        assert_eq!(
            config["webhook_url"],
            "https://hooks.slack.com/services/T/B/X"
        );
    }

    #[test]
    fn test_redact_slack_bot_token_noop_when_token_key_absent() {
        let mut config = serde_json::json!({
            "method": "bot_token",
            "channel": "#alerts"
            // no "token" key — malformed but possible via direct DB insert
        });
        redact_slack_bot_token(ChannelType::Slack, &mut config);
        // must NOT synthesise a fake token key that wasn't there
        assert!(config.get("token").is_none());
    }

    #[test]
    fn test_redact_slack_bot_token_noop_for_non_slack_channel() {
        let mut config = serde_json::json!({
            "method": "bot_token",
            "token": "xoxb-real-secret"
        });
        // Using ChannelType::Webhook — should not redact
        redact_slack_bot_token(ChannelType::Webhook, &mut config);
        assert_eq!(config["token"], "xoxb-real-secret");
    }
}
