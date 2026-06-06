//! Alert routes for managing notification channels and alert rules.
//!
//! ## Alert Integrations (Global)
//! - GET /api/integrations - List all integrations
//! - POST /api/integrations - Create integration
//! - GET /api/integrations/{id} - Get integration
//! - PATCH /api/integrations/{id} - Update integration
//! - DELETE /api/integrations/{id} - Delete integration
//! - POST /api/integrations/{id}/test - Test integration
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

use crate::auth::ApiActor;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::ChannelType;
use crate::models::{
    AlertPayload, CreateAlertRule, CreateNotificationChannel, EmailRoutingOverride, IssueInfo,
    ProjectInfo, ProviderType, SlackRoutingOverride, UpdateAlertRule, UpdateNotificationChannel,
    WebhookRoutingOverride,
};
#[cfg(feature = "openapi")]
use crate::models::{AlertRuleResponse, NotificationChannel};
use crate::services::access::{self, Action};
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
// Routing Override Validation
// =============================================================================

/// Validates routing_override for a given provider type and credentials.
///
/// Dispatches to provider-specific rules using the known `provider_type` —
/// NO serde-tagged enum, flat structs only (SCL-1/SCL-2).
pub fn validate_routing_override(
    provider_type: ProviderType,
    credentials: &serde_json::Value,
    routing: &serde_json::Value,
) -> AppResult<()> {
    match provider_type {
        ProviderType::Slack => {
            let method = credentials
                .get("method")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if method == "bot_token" {
                let r: SlackRoutingOverride =
                    serde_json::from_value(routing.clone()).map_err(|e| {
                        AppError::Validation(format!("Invalid Slack routing_override: {e}"))
                    })?;
                // Mirror send_bot_token's fallback: routing.channel ?? credentials.channel
                let cred_channel = credentials
                    .get("channel")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let effective_channel = r.channel.as_deref().unwrap_or(cred_channel);
                if effective_channel.trim().is_empty() {
                    return Err(AppError::Validation(
                        "Slack bot_token requires a non-empty 'channel' in routing_override or credentials"
                            .to_string(),
                    ));
                }
            }
            // webhook method: no routing constraints
        }
        ProviderType::Email => {
            let r: EmailRoutingOverride = serde_json::from_value(routing.clone()).map_err(|e| {
                AppError::Validation(format!("Invalid Email routing_override: {e}"))
            })?;
            if r.recipients.is_empty() {
                return Err(AppError::Validation(
                    "Email routing_override must include at least one recipient".to_string(),
                ));
            }
            for addr in &r.recipients {
                if !addr.contains('@') {
                    return Err(AppError::Validation(format!(
                        "Invalid email address '{addr}': must contain '@'"
                    )));
                }
            }
        }
        ProviderType::Webhook => {
            let cred_url = credentials.get("url").and_then(|v| v.as_str());
            let r: WebhookRoutingOverride =
                serde_json::from_value(routing.clone()).map_err(|e| {
                    AppError::Validation(format!("Invalid Webhook routing_override: {e}"))
                })?;
            if cred_url.is_none() && r.url.is_none() {
                return Err(AppError::Validation(
                    "Webhook requires a URL in credentials or routing_override".to_string(),
                ));
            }
            if let Some(url) = &r.url {
                if !url.starts_with("http://") && !url.starts_with("https://") {
                    return Err(AppError::Validation(format!(
                        "routing_override.url must be http or https, got: {url}"
                    )));
                }
            }
        }
    }
    Ok(())
}

/// Request body for the test-integration endpoint.
#[derive(Deserialize, Default)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct TestIntegrationBody {
    #[serde(default)]
    pub routing_override: Option<serde_json::Value>,
}

// =============================================================================
// Notification Channel Endpoints
// =============================================================================

fn channel_to_safe_json(channel: &crate::models::AlertIntegration) -> serde_json::Value {
    let mut value = serde_json::to_value(channel).unwrap_or_default();
    if let Some(config) = value.get_mut("credentials") {
        redact_slack_bot_token(channel.provider_type, config);
    }
    value
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/integrations",
    tag = "Alert Channels",
    responses(
        (status = 200, description = "List of notification channels", body = Vec<NotificationChannel>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/alert-channels
pub async fn list_channels(pool: web::Data<DbPool>, _actor: ApiActor) -> AppResult<HttpResponse> {
    let channels = AlertService::list_channels(pool.get_ref()).await?;
    let safe: Vec<serde_json::Value> = channels.iter().map(channel_to_safe_json).collect();
    Ok(HttpResponse::Ok().json(safe))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/integrations",
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
    _actor: ApiActor,
    body: web::Json<CreateNotificationChannel>,
) -> AppResult<HttpResponse> {
    let channel = AlertService::create_channel(pool.get_ref(), body.into_inner()).await?;
    Ok(HttpResponse::Created().json(channel_to_safe_json(&channel)))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/integrations/{id}",
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
    _actor: ApiActor,
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    let channel = AlertService::get_channel(pool.get_ref(), path.into_inner()).await?;
    Ok(HttpResponse::Ok().json(channel_to_safe_json(&channel)))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    patch,
    path = "/api/integrations/{id}",
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
    _actor: ApiActor,
    path: web::Path<i32>,
    body: web::Json<UpdateNotificationChannel>,
) -> AppResult<HttpResponse> {
    let channel =
        AlertService::update_channel(pool.get_ref(), path.into_inner(), body.into_inner()).await?;
    Ok(HttpResponse::Ok().json(channel_to_safe_json(&channel)))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    delete,
    path = "/api/integrations/{id}",
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
    _actor: ApiActor,
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    AlertService::delete_channel(pool.get_ref(), path.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/integrations/{id}/test",
    tag = "Alert Channels",
    params(("id" = i32, Path, description = "Channel ID")),
    responses(
        (status = 200, description = "Test notification sent"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/integrations/{id}/test
pub async fn test_channel(
    pool: web::Data<DbPool>,
    _actor: ApiActor,
    path: web::Path<i32>,
    body: Option<web::Json<TestIntegrationBody>>,
) -> AppResult<HttpResponse> {
    let channel = AlertService::get_channel(pool.get_ref(), path.into_inner()).await?;

    let routing = body
        .and_then(|b| b.into_inner().routing_override)
        .unwrap_or_else(|| serde_json::json!({}));

    validate_routing_override(channel.provider_type, &channel.credentials, &routing)?;

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
    let dispatcher = create_dispatcher(channel.provider_type);
    let result = dispatcher.send(&channel, &routing, &test_payload).await;

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
    actor: ApiActor,
    path: web::Path<i32>,
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

    // Verify project exists
    let _ = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

    let rules = AlertService::list_rules(pool.get_ref(), project_id).await?;

    let mut responses = Vec::new();
    for rule in rules {
        let records = AlertService::get_all_rule_channel_records(pool.get_ref(), rule.id).await?;
        let channels = records
            .into_iter()
            .map(|r| crate::models::AlertRuleChannelInput {
                integration_id: r.integration_id,
                routing_override: r.routing_override,
            })
            .collect();
        responses.push(rule.to_response(channels));
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
    actor: ApiActor,
    path: web::Path<i32>,
    body: web::Json<CreateAlertRule>,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();

    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::UpdateProject,
    )
    .await?;

    // Verify project exists
    let _ = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

    let body = body.into_inner();

    // Validate routing_override for each channel before linking
    for ch in &body.channels {
        let integration = AlertService::get_channel(pool.get_ref(), ch.integration_id).await?;
        validate_routing_override(
            integration.provider_type,
            &integration.credentials,
            &ch.routing_override,
        )?;
    }

    let rule = AlertService::create_rule(pool.get_ref(), project_id, body).await?;
    let records = AlertService::get_all_rule_channel_records(pool.get_ref(), rule.id).await?;
    let channels = records
        .into_iter()
        .map(|r| crate::models::AlertRuleChannelInput {
            integration_id: r.integration_id,
            routing_override: r.routing_override,
        })
        .collect();

    Ok(HttpResponse::Created().json(rule.to_response(channels)))
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
    actor: ApiActor,
    path: web::Path<RulePath>,
) -> AppResult<HttpResponse> {
    let params = path.into_inner();

    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        params.project_id,
        Action::ViewProject,
    )
    .await?;

    // Verify project exists
    let _ = ProjectService::get_by_id(pool.get_ref(), params.project_id).await?;

    let rule = AlertService::get_rule(pool.get_ref(), params.rule_id).await?;

    // Verify rule belongs to project
    if rule.project_id != params.project_id {
        return Err(crate::error::AppError::NotFound(
            "Alert rule not found in this project".to_string(),
        ));
    }

    let records = AlertService::get_all_rule_channel_records(pool.get_ref(), rule.id).await?;
    let channels = records
        .into_iter()
        .map(|r| crate::models::AlertRuleChannelInput {
            integration_id: r.integration_id,
            routing_override: r.routing_override,
        })
        .collect();

    Ok(HttpResponse::Ok().json(rule.to_response(channels)))
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
    actor: ApiActor,
    path: web::Path<RulePath>,
    body: web::Json<UpdateAlertRule>,
) -> AppResult<HttpResponse> {
    let params = path.into_inner();

    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        params.project_id,
        Action::UpdateProject,
    )
    .await?;

    // Verify project exists
    let _ = ProjectService::get_by_id(pool.get_ref(), params.project_id).await?;

    // Verify rule belongs to project
    let existing = AlertService::get_rule(pool.get_ref(), params.rule_id).await?;
    if existing.project_id != params.project_id {
        return Err(crate::error::AppError::NotFound(
            "Alert rule not found in this project".to_string(),
        ));
    }

    let body = body.into_inner();

    // Validate routing_override for updated channels
    if let Some(channels) = &body.channels {
        for ch in channels {
            let integration = AlertService::get_channel(pool.get_ref(), ch.integration_id).await?;
            validate_routing_override(
                integration.provider_type,
                &integration.credentials,
                &ch.routing_override,
            )?;
        }
    }

    let rule = AlertService::update_rule(pool.get_ref(), params.rule_id, body).await?;
    let records = AlertService::get_all_rule_channel_records(pool.get_ref(), rule.id).await?;
    let channels = records
        .into_iter()
        .map(|r| crate::models::AlertRuleChannelInput {
            integration_id: r.integration_id,
            routing_override: r.routing_override,
        })
        .collect();

    Ok(HttpResponse::Ok().json(rule.to_response(channels)))
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
    actor: ApiActor,
    path: web::Path<RulePath>,
) -> AppResult<HttpResponse> {
    let params = path.into_inner();

    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        params.project_id,
        Action::UpdateProject,
    )
    .await?;

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
    actor: ApiActor,
    path: web::Path<i32>,
    query: web::Query<HistoryQuery>,
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
        web::scope("/api/integrations")
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

    // -------------------------------------------------------------------------
    // validate_routing_override tests (SCL-2)
    // -------------------------------------------------------------------------

    #[test]
    fn test_validate_routing_slack_bot_token_with_channel_ok() {
        let creds = serde_json::json!({"method": "bot_token", "token": "xoxb-123"});
        let routing = serde_json::json!({"channel": "#fe"});
        assert!(validate_routing_override(ProviderType::Slack, &creds, &routing).is_ok());
    }

    #[test]
    fn test_validate_routing_slack_bot_token_missing_channel_fails() {
        let creds = serde_json::json!({"method": "bot_token", "token": "xoxb-123"});
        let routing = serde_json::json!({});
        assert!(validate_routing_override(ProviderType::Slack, &creds, &routing).is_err());
    }

    #[test]
    fn test_validate_routing_slack_bot_token_blank_channel_fails() {
        let creds = serde_json::json!({"method": "bot_token", "token": "xoxb-123"});
        let routing = serde_json::json!({"channel": "   "});
        assert!(validate_routing_override(ProviderType::Slack, &creds, &routing).is_err());
    }

    #[test]
    fn test_validate_routing_slack_webhook_empty_routing_ok() {
        // webhook method has no routing constraints
        let creds = serde_json::json!({"method": "webhook", "webhook_url": "https://hooks.slack.com/services/T/B/X"});
        let routing = serde_json::json!({});
        assert!(validate_routing_override(ProviderType::Slack, &creds, &routing).is_ok());
    }

    #[test]
    fn test_validate_routing_email_with_recipients_ok() {
        let creds = serde_json::json!({"smtp_host": "smtp.example.com"});
        let routing = serde_json::json!({"recipients": ["a@b.com"]});
        assert!(validate_routing_override(ProviderType::Email, &creds, &routing).is_ok());
    }

    #[test]
    fn test_validate_routing_email_empty_recipients_fails() {
        let creds = serde_json::json!({"smtp_host": "smtp.example.com"});
        let routing = serde_json::json!({"recipients": []});
        assert!(validate_routing_override(ProviderType::Email, &creds, &routing).is_err());
    }

    #[test]
    fn test_validate_routing_email_missing_at_fails() {
        let creds = serde_json::json!({"smtp_host": "smtp.example.com"});
        let routing = serde_json::json!({"recipients": ["not-an-email"]});
        assert!(validate_routing_override(ProviderType::Email, &creds, &routing).is_err());
    }

    #[test]
    fn test_validate_routing_webhook_cred_url_only_ok() {
        let creds = serde_json::json!({"url": "https://example.com/hook"});
        let routing = serde_json::json!({});
        assert!(validate_routing_override(ProviderType::Webhook, &creds, &routing).is_ok());
    }

    #[test]
    fn test_validate_routing_webhook_routing_url_only_ok() {
        let creds = serde_json::json!({});
        let routing = serde_json::json!({"url": "https://svc.io/hook"});
        assert!(validate_routing_override(ProviderType::Webhook, &creds, &routing).is_ok());
    }

    #[test]
    fn test_validate_routing_webhook_no_url_anywhere_fails() {
        let creds = serde_json::json!({"secret": "abc"});
        let routing = serde_json::json!({});
        assert!(validate_routing_override(ProviderType::Webhook, &creds, &routing).is_err());
    }

    #[test]
    fn test_validate_routing_webhook_invalid_scheme_fails() {
        let creds = serde_json::json!({});
        let routing = serde_json::json!({"url": "ftp://bad.example.com"});
        assert!(validate_routing_override(ProviderType::Webhook, &creds, &routing).is_err());
    }

    #[test]
    fn test_validate_routing_webhook_http_scheme_ok() {
        let creds = serde_json::json!({});
        let routing = serde_json::json!({"url": "http://internal.example.com/hook"});
        assert!(validate_routing_override(ProviderType::Webhook, &creds, &routing).is_ok());
    }
}
