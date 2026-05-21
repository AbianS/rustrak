//! Alert routes for managing integrations and alert rules.
//!
//! ## Alert Integrations (Global credentials — renamed from /api/alert-channels)
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

use crate::auth::ApiAuth;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{
    AlertIntegration, AlertPayload, AlertRuleChannelInput, CreateAlertIntegration,
    CreateAlertRule, IssueInfo, ProviderType, ProjectInfo, RoutingOverride,
    UpdateAlertIntegration, UpdateAlertRule, WebhookConfig,
};
#[cfg(feature = "openapi")]
use crate::models::{AlertRuleResponse, CreateNotificationChannel, NotificationChannel, UpdateNotificationChannel};
use crate::services::{create_dispatcher, AlertService, ProjectService};

#[cfg(feature = "openapi")]
use utoipa::OpenApi;

// =============================================================================
// Token redaction
// =============================================================================

/// Redacts the bot token in a Slack integration's credentials before sending
/// over the API. Replaces `credentials.token` with `"xoxb-****"` when
/// `provider_type == slack` and `credentials.method == "bot_token"`.
///
/// This prevents live `xoxb-…` tokens from being exposed via GET responses.
pub fn redact_slack_bot_token(provider_type: ProviderType, credentials: &mut serde_json::Value) {
    if provider_type == ProviderType::Slack
        && credentials.get("method").and_then(|v| v.as_str()) == Some("bot_token")
    {
        if let Some(obj) = credentials.as_object_mut() {
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
// Integration response helpers
// =============================================================================

fn integration_to_safe_json(integration: &AlertIntegration) -> serde_json::Value {
    let mut value = serde_json::to_value(integration).unwrap_or_default();
    if let Some(credentials) = value.get_mut("credentials") {
        redact_slack_bot_token(integration.provider_type, credentials);
    }
    value
}

// =============================================================================
// Routing override validation
// =============================================================================

/// Validates a routing_override JSON value against the provider type.
///
/// Rules per spec:
/// - Slack bot_token: `channel` must be present and non-empty
/// - Slack webhook:   no validation needed (routing is always `{}`)
/// - Email:           `recipients` must be a non-empty array
/// - Webhook:         if integration has no `url` in credentials AND routing has no `url` → 422
fn validate_routing_override(
    provider_type: ProviderType,
    credentials: &serde_json::Value,
    routing: &serde_json::Value,
) -> AppResult<()> {
    match serde_json::from_value::<RoutingOverride>(routing.clone()) {
        Ok(RoutingOverride::Slack(slack_routing)) => {
            // For bot_token, channel is required in routing_override
            let is_bot_token = credentials.get("method").and_then(|v| v.as_str()) == Some("bot_token");
            if is_bot_token {
                let channel = slack_routing.channel.as_deref().unwrap_or("").trim().to_string();
                if channel.is_empty() {
                    return Err(AppError::UnprocessableEntity(
                        "Slack bot_token integration requires a non-empty 'channel' in routing_override".to_string(),
                    ));
                }
            }
        }
        Ok(RoutingOverride::Email(email_routing)) => {
            if email_routing.recipients.is_empty() {
                return Err(AppError::UnprocessableEntity(
                    "Email integration requires at least one recipient in routing_override".to_string(),
                ));
            }
        }
        Ok(RoutingOverride::Webhook(webhook_routing)) => {
            // If credentials lack a url AND routing_override also lacks url → 422
            let creds_config: WebhookConfig =
                serde_json::from_value(credentials.clone()).unwrap_or(WebhookConfig {
                    url: None,
                    secret: None,
                    headers: None,
                });
            if creds_config.url.is_none() && webhook_routing.url.is_none() {
                return Err(AppError::UnprocessableEntity(
                    "Webhook integration has no URL: set 'url' in integration credentials or in routing_override".to_string(),
                ));
            }
        }
        Err(_) => {
            // routing may be `{}` for slack/webhook methods — try to parse as empty object
            // Empty `{}` is valid for slack webhook and webhook provider_type
            if provider_type == ProviderType::Email {
                return Err(AppError::UnprocessableEntity(
                    "Email integration requires a valid routing_override with 'recipients'".to_string(),
                ));
            }
            // For slack/webhook with empty routing, that is acceptable
        }
    }
    Ok(())
}

// =============================================================================
// Alert Integration Endpoints  (/api/integrations)
// =============================================================================

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/integrations",
    tag = "Alert Integrations",
    responses(
        (status = 200, description = "List of alert integrations", body = Vec<NotificationChannel>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/integrations
pub async fn list_channels(pool: web::Data<DbPool>, _auth: ApiAuth) -> AppResult<HttpResponse> {
    let integrations = AlertService::list_channels(pool.get_ref()).await?;
    let safe: Vec<serde_json::Value> = integrations.iter().map(integration_to_safe_json).collect();
    Ok(HttpResponse::Ok().json(safe))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/integrations",
    tag = "Alert Integrations",
    request_body = CreateNotificationChannel,
    responses(
        (status = 201, description = "Integration created", body = NotificationChannel),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 422, description = "Invalid routing override", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/integrations
pub async fn create_channel(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
    body: web::Json<CreateAlertIntegration>,
) -> AppResult<HttpResponse> {
    let integration = AlertService::create_channel(pool.get_ref(), body.into_inner()).await?;
    Ok(HttpResponse::Created().json(integration_to_safe_json(&integration)))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/integrations/{id}",
    tag = "Alert Integrations",
    params(("id" = i32, Path, description = "Integration ID")),
    responses(
        (status = 200, description = "Integration details", body = NotificationChannel),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/integrations/{id}
pub async fn get_channel(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    let integration = AlertService::get_channel(pool.get_ref(), path.into_inner()).await?;
    Ok(HttpResponse::Ok().json(integration_to_safe_json(&integration)))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    patch,
    path = "/api/integrations/{id}",
    tag = "Alert Integrations",
    params(("id" = i32, Path, description = "Integration ID")),
    request_body = UpdateNotificationChannel,
    responses(
        (status = 200, description = "Integration updated", body = NotificationChannel),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// PATCH /api/integrations/{id}
pub async fn update_channel(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
    path: web::Path<i32>,
    body: web::Json<UpdateAlertIntegration>,
) -> AppResult<HttpResponse> {
    let integration =
        AlertService::update_channel(pool.get_ref(), path.into_inner(), body.into_inner()).await?;
    Ok(HttpResponse::Ok().json(integration_to_safe_json(&integration)))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    delete,
    path = "/api/integrations/{id}",
    tag = "Alert Integrations",
    params(("id" = i32, Path, description = "Integration ID")),
    responses(
        (status = 204, description = "Integration deleted"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// DELETE /api/integrations/{id}
pub async fn delete_channel(
    pool: web::Data<DbPool>,
    _auth: ApiAuth,
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    AlertService::delete_channel(pool.get_ref(), path.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// Request body for test endpoint (routing_override is optional)
#[derive(Debug, Deserialize, Default)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct TestIntegrationBody {
    #[serde(default)]
    pub routing_override: Option<serde_json::Value>,
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/integrations/{id}/test",
    tag = "Alert Integrations",
    params(("id" = i32, Path, description = "Integration ID")),
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
    _auth: ApiAuth,
    path: web::Path<i32>,
    body: Option<web::Json<TestIntegrationBody>>,
) -> AppResult<HttpResponse> {
    let integration = AlertService::get_channel(pool.get_ref(), path.into_inner()).await?;

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

    // Use routing_override from body if provided, otherwise use empty object
    let routing = body
        .and_then(|b| b.into_inner().routing_override)
        .unwrap_or_else(|| serde_json::json!({}));

    // Send test notification
    let dispatcher = create_dispatcher(integration.provider_type);
    let result = dispatcher.send(&integration, &routing, &test_payload).await;

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

    // Enrich with integration IDs
    let mut responses = Vec::new();
    for rule in rules {
        let integration_ids =
            AlertService::get_rule_integration_ids(pool.get_ref(), rule.id).await?;
        responses.push(rule.to_response(integration_ids));
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
        (status = 422, description = "Invalid routing override", body = crate::error::ErrorResponse),
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

    let input = body.into_inner();

    // Validate routing_override per integration provider_type before inserting
    validate_channels_routing(pool.get_ref(), &input.channels).await?;

    let rule = AlertService::create_rule(pool.get_ref(), project_id, input).await?;
    let integration_ids =
        AlertService::get_rule_integration_ids(pool.get_ref(), rule.id).await?;

    Ok(HttpResponse::Created().json(rule.to_response(integration_ids)))
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

    let integration_ids =
        AlertService::get_rule_integration_ids(pool.get_ref(), rule.id).await?;

    Ok(HttpResponse::Ok().json(rule.to_response(integration_ids)))
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
        (status = 422, description = "Invalid routing override", body = crate::error::ErrorResponse),
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

    let input = body.into_inner();

    // Validate routing_override if channels are being updated
    if let Some(ref channels) = input.channels {
        validate_channels_routing(pool.get_ref(), channels).await?;
    }

    let rule =
        AlertService::update_rule(pool.get_ref(), params.rule_id, input).await?;
    let integration_ids =
        AlertService::get_rule_integration_ids(pool.get_ref(), rule.id).await?;

    Ok(HttpResponse::Ok().json(rule.to_response(integration_ids)))
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
// Routing validation helper (fetches integrations and validates routing shape)
// =============================================================================

async fn validate_channels_routing(
    pool: &crate::db::DbPool,
    channels: &[AlertRuleChannelInput],
) -> AppResult<()> {
    for channel_input in channels {
        // Fetch the integration to get provider_type and credentials
        let integration =
            AlertService::get_channel(pool, channel_input.integration_id).await?;

        // Check if integration is enabled
        if !integration.is_enabled {
            return Err(AppError::UnprocessableEntity(format!(
                "Integration {} is disabled",
                channel_input.integration_id
            )));
        }

        validate_routing_override(
            integration.provider_type,
            &integration.credentials,
            &channel_input.routing_override,
        )?;
    }
    Ok(())
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
        crate::models::ProviderType,
        crate::models::AlertRuleResponse,
        crate::models::CreateAlertRule,
        crate::models::UpdateAlertRule,
        crate::models::AlertType,
        crate::models::AlertStatus,
        crate::models::AlertHistory,
    ))
)]
pub struct AlertsApi;

/// Configure alert integration routes (global credentials)
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

    // -------------------------------------------------------------------------
    // Token redaction tests (updated for ProviderType alias)
    // -------------------------------------------------------------------------

    #[test]
    fn test_redact_slack_bot_token_replaces_token() {
        let mut credentials = serde_json::json!({
            "method": "bot_token",
            "token": "xoxb-real-secret-token"
        });
        redact_slack_bot_token(ProviderType::Slack, &mut credentials);
        assert_eq!(credentials["token"], "xoxb-****");
        assert_eq!(credentials["method"], "bot_token");
    }

    #[test]
    fn test_redact_slack_bot_token_noop_for_webhook_method() {
        let mut credentials = serde_json::json!({
            "method": "webhook",
            "webhook_url": "https://hooks.slack.com/services/T/B/X"
        });
        redact_slack_bot_token(ProviderType::Slack, &mut credentials);
        // Must not touch webhook credentials at all
        assert!(credentials.get("token").is_none());
        assert_eq!(
            credentials["webhook_url"],
            "https://hooks.slack.com/services/T/B/X"
        );
    }

    #[test]
    fn test_redact_slack_bot_token_noop_when_token_key_absent() {
        let mut credentials = serde_json::json!({
            "method": "bot_token"
            // no "token" key — malformed but possible via direct DB insert
        });
        redact_slack_bot_token(ProviderType::Slack, &mut credentials);
        // must NOT synthesise a fake token key that wasn't there
        assert!(credentials.get("token").is_none());
    }

    #[test]
    fn test_redact_slack_bot_token_noop_for_non_slack_provider() {
        let mut credentials = serde_json::json!({
            "method": "bot_token",
            "token": "xoxb-real-secret"
        });
        // Using ProviderType::Webhook — should not redact
        redact_slack_bot_token(ProviderType::Webhook, &mut credentials);
        assert_eq!(credentials["token"], "xoxb-real-secret");
    }

    // -------------------------------------------------------------------------
    // Routing override validation tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_validate_routing_slack_bot_token_requires_channel() {
        let credentials = serde_json::json!({"method": "bot_token", "token": "xoxb-abc"});
        let routing_without_channel = serde_json::json!({"provider_type": "slack"});
        let result = validate_routing_override(
            ProviderType::Slack,
            &credentials,
            &routing_without_channel,
        );
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("channel"), "error must mention channel, got: {msg}");
    }

    #[test]
    fn test_validate_routing_slack_bot_token_with_channel_passes() {
        let credentials = serde_json::json!({"method": "bot_token", "token": "xoxb-abc"});
        let routing = serde_json::json!({"provider_type": "slack", "channel": "#alerts"});
        let result = validate_routing_override(ProviderType::Slack, &credentials, &routing);
        assert!(result.is_ok(), "valid routing must pass: {:?}", result);
    }

    #[test]
    fn test_validate_routing_email_requires_recipients() {
        let credentials = serde_json::json!({"smtp_host": "smtp.example.com"});
        let routing_no_recipients = serde_json::json!({"provider_type": "email", "recipients": []});
        let result = validate_routing_override(
            ProviderType::Email,
            &credentials,
            &routing_no_recipients,
        );
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("recipient"), "error must mention recipient, got: {msg}");
    }

    #[test]
    fn test_validate_routing_email_with_recipients_passes() {
        let credentials = serde_json::json!({"smtp_host": "smtp.example.com"});
        let routing = serde_json::json!({"provider_type": "email", "recipients": ["a@b.com"]});
        let result = validate_routing_override(ProviderType::Email, &credentials, &routing);
        assert!(result.is_ok(), "valid routing must pass: {:?}", result);
    }

    #[test]
    fn test_validate_routing_webhook_no_url_anywhere_fails() {
        let credentials_no_url = serde_json::json!({"secret": "abc"});
        let routing_no_url = serde_json::json!({"provider_type": "webhook"});
        let result = validate_routing_override(
            ProviderType::Webhook,
            &credentials_no_url,
            &routing_no_url,
        );
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("URL"), "error must mention URL, got: {msg}");
    }

    #[test]
    fn test_validate_routing_webhook_url_in_credentials_passes() {
        let credentials = serde_json::json!({"url": "https://hook.example.com", "secret": "abc"});
        let routing = serde_json::json!({"provider_type": "webhook"});
        let result = validate_routing_override(ProviderType::Webhook, &credentials, &routing);
        assert!(result.is_ok(), "credentials url satisfies requirement: {:?}", result);
    }

    #[test]
    fn test_validate_routing_webhook_url_in_routing_passes() {
        let credentials_no_url = serde_json::json!({"secret": "abc"});
        let routing = serde_json::json!({
            "provider_type": "webhook",
            "url": "https://routing.example.com/hook"
        });
        let result = validate_routing_override(
            ProviderType::Webhook,
            &credentials_no_url,
            &routing,
        );
        assert!(result.is_ok(), "routing url satisfies requirement: {:?}", result);
    }

    // -------------------------------------------------------------------------
    // Task 5: ChannelType alias still works (backward compat)
    // -------------------------------------------------------------------------

    #[test]
    fn test_channel_type_alias_is_provider_type() {
        use crate::models::ChannelType;
        // ChannelType is a type alias for ProviderType — they should be identical
        let ct: ChannelType = ChannelType::Slack;
        let pt: ProviderType = ProviderType::Slack;
        assert_eq!(ct, pt);
    }
}
