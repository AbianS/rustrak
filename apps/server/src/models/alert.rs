//! Alert models for the notification system.
//!
//! This module contains models for alert integrations (global credentials),
//! alert rules (per-project triggers), and alert history (audit log).
//!
//! ## Two-Tier Design
//!
//! - `AlertIntegration` — global credentials record (created once, reused across projects)
//! - `AlertRuleChannel` — junction row linking a rule to an integration, carrying per-rule routing
//! - `RoutingOverride` — typed envelope for the per-rule routing JSON

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;
use uuid::Uuid;

// =============================================================================
// Provider Type Enum
// =============================================================================

/// Type of integration provider (formerly ChannelType)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    Webhook,
    Email,
    Slack,
}

impl std::fmt::Display for ProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProviderType::Webhook => write!(f, "webhook"),
            ProviderType::Email => write!(f, "email"),
            ProviderType::Slack => write!(f, "slack"),
        }
    }
}

/// Backward-compatible alias: existing code using `ChannelType` continues to compile.
pub type ChannelType = ProviderType;

// =============================================================================
// Alert Type Enum
// =============================================================================

/// Type of alert trigger
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AlertType {
    NewIssue,
    Regression,
    Unmute,
}

impl std::fmt::Display for AlertType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AlertType::NewIssue => write!(f, "new_issue"),
            AlertType::Regression => write!(f, "regression"),
            AlertType::Unmute => write!(f, "unmute"),
        }
    }
}

// =============================================================================
// Alert Status Enum
// =============================================================================

/// Status of an alert delivery attempt
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum AlertStatus {
    Pending,
    Sent,
    Failed,
    Skipped,
}

// =============================================================================
// Alert Integration Model  (renamed from NotificationChannel)
// =============================================================================

/// Global alert integration — stores provider credentials only.
///
/// Routing information (target Slack channel, email recipients, webhook URL
/// overrides) lives in `AlertRuleChannel.routing_override` so a single
/// integration can be reused across multiple projects with different routing.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AlertIntegration {
    pub id: i32,
    pub name: String,
    pub provider_type: ProviderType,
    /// Provider credentials (bot token, SMTP settings, webhook URL, etc.)
    /// Routing fields (channel, recipients) are intentionally absent here.
    #[cfg_attr(feature = "openapi", schema(value_type = Object))]
    pub credentials: serde_json::Value,
    pub is_enabled: bool,
    pub failure_count: i32,
    pub last_failure_at: Option<DateTime<Utc>>,
    pub last_failure_message: Option<String>,
    pub last_success_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Backward-compatible alias so existing code referencing `NotificationChannel` compiles.
///
/// The DB column is now named `credentials` (not `config`), and the type column is
/// `provider_type` (not `channel_type`). All new code should use `AlertIntegration`.
pub type NotificationChannel = AlertIntegration;

/// DTO for creating an alert integration
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateAlertIntegration {
    pub name: String,
    pub provider_type: ProviderType,
    #[cfg_attr(feature = "openapi", schema(value_type = Object))]
    pub credentials: serde_json::Value,
    #[serde(default = "default_true")]
    pub is_enabled: bool,
}

/// Backward-compatible alias
pub type CreateNotificationChannel = CreateAlertIntegration;

/// DTO for updating an alert integration
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateAlertIntegration {
    pub name: Option<String>,
    #[cfg_attr(feature = "openapi", schema(value_type = Option<Object>))]
    pub credentials: Option<serde_json::Value>,
    pub is_enabled: Option<bool>,
}

/// Backward-compatible alias
pub type UpdateNotificationChannel = UpdateAlertIntegration;

fn default_true() -> bool {
    true
}

// =============================================================================
// Routing Override Types
// =============================================================================

/// Per-rule routing override — replaces or supplements integration credentials
/// with routing-specific values (target channel, recipients, URL).
///
/// Serialised with `"provider_type"` tag so the outer JSON looks like:
/// `{"provider_type":"slack","channel":"#fe"}`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "provider_type", rename_all = "snake_case")]
pub enum RoutingOverride {
    Slack(SlackRoutingOverride),
    Email(EmailRoutingOverride),
    Webhook(WebhookRoutingOverride),
}

/// Slack-specific routing override fields (bot_token method only).
/// Slack webhook routing is always empty `{}` — the channel is baked into
/// the webhook URL and cannot be overridden.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackRoutingOverride {
    /// Target Slack channel (required for bot_token; e.g. "#alerts" or "C1234567")
    #[serde(default)]
    pub channel: Option<String>,
    /// Bot display name override (optional)
    #[serde(default)]
    pub username: Option<String>,
    /// Bot icon emoji override (optional; e.g. ":robot_face:")
    #[serde(default)]
    pub icon_emoji: Option<String>,
}

/// Email-specific routing override.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailRoutingOverride {
    /// Target email recipients (at least one required)
    pub recipients: Vec<String>,
}

/// Webhook-specific routing override.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookRoutingOverride {
    /// Override the URL from integration credentials (required when credentials lacks a URL)
    #[serde(default)]
    pub url: Option<String>,
    /// Extra HTTP headers merged on top of integration credential headers
    /// (routing headers take precedence on key collision)
    #[serde(default)]
    pub extra_headers: Option<HashMap<String, String>>,
}

// =============================================================================
// Channel Configuration Types  (credentials shapes — still used by dispatchers)
// =============================================================================

/// Webhook integration credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    /// Default webhook URL (optional — can be supplied via routing_override.url)
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub secret: Option<String>,
    #[serde(default)]
    pub headers: Option<HashMap<String, String>>,
}

/// Email integration credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailConfig {
    // Recipients no longer live here — they are in routing_override
    // (kept for backward compat with validate_config path during transition)
    #[serde(default)]
    pub recipients: Vec<String>,
    #[serde(default)]
    pub smtp_host: Option<String>,
    #[serde(default)]
    pub smtp_port: Option<u16>,
    #[serde(default)]
    pub smtp_username: Option<String>,
    #[serde(default)]
    pub smtp_password: Option<String>,
    #[serde(default)]
    pub from_address: Option<String>,
}

/// Slack integration credentials — tagged enum over delivery method.
///
/// Serialises as `{"method":"webhook",...}` or `{"method":"bot_token",...}`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "method", rename_all = "snake_case")]
pub enum SlackConfig {
    Webhook(SlackWebhookConfig),
    BotToken(SlackBotTokenConfig),
}

/// Config for the Incoming Webhook delivery method.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackWebhookConfig {
    pub webhook_url: String,
}

/// Config for the Bot Token (chat.postMessage) delivery method.
/// Note: `channel`/`username`/`icon_emoji` are now routing fields stored in
/// `routing_override` — they are kept here only for the `validate_config` helper
/// which checks the shape of the credentials JSONB when creating an integration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackBotTokenConfig {
    pub token: String,
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub icon_emoji: Option<String>,
}

// =============================================================================
// Alert Rule Channel (junction)
// =============================================================================

/// Junction row linking an alert rule to an integration with per-rule routing.
///
/// This replaces the old `(alert_rule_id, channel_id)` pair — `channel_id` is
/// renamed `integration_id` and the new `routing_override` column carries the
/// routing fields that were previously embedded in `notification_channels.config`.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AlertRuleChannel {
    pub alert_rule_id: i32,
    pub integration_id: i32,
    /// Provider-specific routing JSON (e.g. `{"channel":"#fe"}` for Slack bot_token)
    pub routing_override: serde_json::Value,
}

/// Input DTO for one channel entry when creating/updating an alert rule
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AlertRuleChannelInput {
    pub integration_id: i32,
    #[cfg_attr(feature = "openapi", schema(value_type = Object))]
    #[serde(default = "empty_object")]
    pub routing_override: serde_json::Value,
}

fn empty_object() -> serde_json::Value {
    serde_json::json!({})
}

// =============================================================================
// Alert Rule Model
// =============================================================================

/// Per-project alert rule configuration
#[derive(Debug, Clone, Serialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AlertRule {
    pub id: i32,
    pub project_id: i32,
    pub name: String,
    pub alert_type: AlertType,
    pub is_enabled: bool,
    #[cfg_attr(feature = "openapi", schema(value_type = Object))]
    pub conditions: serde_json::Value,
    pub cooldown_minutes: i32,
    pub last_triggered_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating an alert rule
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateAlertRule {
    pub name: String,
    pub alert_type: AlertType,
    #[serde(default = "default_conditions")]
    #[cfg_attr(feature = "openapi", schema(value_type = Object))]
    pub conditions: serde_json::Value,
    #[serde(default)]
    pub cooldown_minutes: i32,
    /// Per-channel routing overrides — replaces the old `channel_ids: Vec<i32>`
    #[serde(default)]
    pub channels: Vec<AlertRuleChannelInput>,
}

fn default_conditions() -> serde_json::Value {
    serde_json::json!({})
}

/// DTO for updating an alert rule
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateAlertRule {
    pub name: Option<String>,
    pub is_enabled: Option<bool>,
    #[cfg_attr(feature = "openapi", schema(value_type = Option<Object>))]
    pub conditions: Option<serde_json::Value>,
    pub cooldown_minutes: Option<i32>,
    /// If provided, replaces the full set of channel-integration links for this rule
    pub channels: Option<Vec<AlertRuleChannelInput>>,
}

/// Response for alert rule including linked integration IDs
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AlertRuleResponse {
    pub id: i32,
    pub project_id: i32,
    pub name: String,
    pub alert_type: AlertType,
    pub is_enabled: bool,
    #[cfg_attr(feature = "openapi", schema(value_type = Object))]
    pub conditions: serde_json::Value,
    pub cooldown_minutes: i32,
    pub last_triggered_at: Option<DateTime<Utc>>,
    /// Integration IDs linked to this rule (without routing details)
    pub integration_ids: Vec<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl AlertRule {
    /// Converts to response with integration IDs
    pub fn to_response(&self, integration_ids: Vec<i32>) -> AlertRuleResponse {
        AlertRuleResponse {
            id: self.id,
            project_id: self.project_id,
            name: self.name.clone(),
            alert_type: self.alert_type,
            is_enabled: self.is_enabled,
            conditions: self.conditions.clone(),
            cooldown_minutes: self.cooldown_minutes,
            last_triggered_at: self.last_triggered_at,
            integration_ids,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

// =============================================================================
// Alert History Model
// =============================================================================

/// Alert delivery history record (audit log and retry queue)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AlertHistory {
    pub id: i64,
    pub alert_rule_id: Option<i32>,
    /// FK to alert_integrations (nullable — SET NULL on integration delete)
    pub integration_id: Option<i32>,
    pub issue_id: Option<Uuid>,
    pub project_id: Option<i32>,
    pub alert_type: String,
    pub channel_type: String,
    pub channel_name: String,
    pub status: AlertStatus,
    pub attempt_count: i32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub http_status_code: Option<i32>,
    pub idempotency_key: String,
    pub created_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
}

// =============================================================================
// Alert Payload (for notifications)
// =============================================================================

/// Payload sent to notification channels
#[derive(Debug, Clone, Serialize)]
pub struct AlertPayload {
    /// Unique alert ID for idempotency
    pub alert_id: String,
    /// Type of alert (new_issue, regression, unmute)
    pub alert_type: String,
    /// Timestamp when alert was triggered
    pub triggered_at: DateTime<Utc>,
    /// Project information
    pub project: ProjectInfo,
    /// Issue information
    pub issue: IssueInfo,
    /// URL to view the issue in the dashboard
    pub issue_url: String,
    /// Actor that triggered the alert
    pub actor: String,
}

/// Project information for alert payload
#[derive(Debug, Clone, Serialize)]
pub struct ProjectInfo {
    pub id: i32,
    pub name: String,
    pub slug: String,
}

/// Issue information for alert payload
#[derive(Debug, Clone, Serialize)]
pub struct IssueInfo {
    pub id: String,
    pub short_id: String,
    pub title: String,
    pub level: Option<String>,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub event_count: i32,
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // AlertIntegration deserialization
    // -------------------------------------------------------------------------

    #[test]
    fn test_alert_integration_provider_type_field_name() {
        // The DB column is provider_type — verify the serde mapping
        let json = serde_json::json!({
            "id": 1,
            "name": "Slack Prod",
            "provider_type": "slack",
            "credentials": {"method": "bot_token", "token": "xoxb-123"},
            "is_enabled": true,
            "failure_count": 0,
            "last_failure_at": null,
            "last_failure_message": null,
            "last_success_at": null,
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z"
        });
        let integration: AlertIntegration =
            serde_json::from_value(json).expect("must deserialize AlertIntegration");
        assert_eq!(integration.provider_type, ProviderType::Slack);
        assert_eq!(integration.name, "Slack Prod");
    }

    // -------------------------------------------------------------------------
    // RoutingOverride — Slack
    // -------------------------------------------------------------------------

    #[test]
    fn test_routing_override_slack_all_optional_fields() {
        // channel, username, icon_emoji are all optional
        let json = serde_json::json!({
            "provider_type": "slack",
            "channel": "#fe",
            "username": "Rustrak Bot",
            "icon_emoji": ":robot_face:"
        });
        let override_val: RoutingOverride =
            serde_json::from_value(json).expect("must deserialize Slack routing override");
        match override_val {
            RoutingOverride::Slack(s) => {
                assert_eq!(s.channel.as_deref(), Some("#fe"));
                assert_eq!(s.username.as_deref(), Some("Rustrak Bot"));
                assert_eq!(s.icon_emoji.as_deref(), Some(":robot_face:"));
            }
            _ => panic!("expected Slack variant"),
        }
    }

    #[test]
    fn test_routing_override_slack_only_channel() {
        let json = serde_json::json!({
            "provider_type": "slack",
            "channel": "#alerts"
        });
        let override_val: RoutingOverride =
            serde_json::from_value(json).expect("must deserialize");
        match override_val {
            RoutingOverride::Slack(s) => {
                assert_eq!(s.channel.as_deref(), Some("#alerts"));
                assert!(s.username.is_none());
                assert!(s.icon_emoji.is_none());
            }
            _ => panic!("expected Slack variant"),
        }
    }

    // -------------------------------------------------------------------------
    // RoutingOverride — Email
    // -------------------------------------------------------------------------

    #[test]
    fn test_routing_override_email_requires_recipients_field() {
        let json = serde_json::json!({
            "provider_type": "email",
            "recipients": ["a@b.com", "c@d.com"]
        });
        let override_val: RoutingOverride =
            serde_json::from_value(json).expect("must deserialize Email routing override");
        match override_val {
            RoutingOverride::Email(e) => {
                assert_eq!(e.recipients, vec!["a@b.com", "c@d.com"]);
            }
            _ => panic!("expected Email variant"),
        }
    }

    #[test]
    fn test_routing_override_email_missing_recipients_fails() {
        // recipients is required — missing key should fail deserialization
        let json = serde_json::json!({"provider_type": "email"});
        let result: Result<RoutingOverride, _> = serde_json::from_value(json);
        assert!(
            result.is_err(),
            "missing recipients should fail deserialization"
        );
    }

    // -------------------------------------------------------------------------
    // RoutingOverride — Webhook
    // -------------------------------------------------------------------------

    #[test]
    fn test_routing_override_webhook_with_url_and_extra_headers() {
        let json = serde_json::json!({
            "provider_type": "webhook",
            "url": "https://example.com/hook",
            "extra_headers": {"X-Token": "abc123"}
        });
        let override_val: RoutingOverride =
            serde_json::from_value(json).expect("must deserialize Webhook routing override");
        match override_val {
            RoutingOverride::Webhook(w) => {
                assert_eq!(w.url.as_deref(), Some("https://example.com/hook"));
                let headers = w.extra_headers.unwrap();
                assert_eq!(headers.get("X-Token").map(|s| s.as_str()), Some("abc123"));
            }
            _ => panic!("expected Webhook variant"),
        }
    }

    #[test]
    fn test_routing_override_webhook_all_optional() {
        // url and extra_headers are both optional for webhook routing
        let json = serde_json::json!({"provider_type": "webhook"});
        let override_val: RoutingOverride =
            serde_json::from_value(json).expect("must deserialize empty webhook routing override");
        match override_val {
            RoutingOverride::Webhook(w) => {
                assert!(w.url.is_none());
                assert!(w.extra_headers.is_none());
            }
            _ => panic!("expected Webhook variant"),
        }
    }

    // -------------------------------------------------------------------------
    // AlertRuleChannel struct
    // -------------------------------------------------------------------------

    #[test]
    fn test_alert_rule_channel_fields() {
        let json = serde_json::json!({
            "alert_rule_id": 1,
            "integration_id": 5,
            "routing_override": {"channel": "#fe"}
        });
        let arc: AlertRuleChannel =
            serde_json::from_value(json).expect("must deserialize AlertRuleChannel");
        assert_eq!(arc.alert_rule_id, 1);
        assert_eq!(arc.integration_id, 5);
        assert_eq!(arc.routing_override["channel"], "#fe");
    }

    // -------------------------------------------------------------------------
    // AlertHistory integration_id field
    // -------------------------------------------------------------------------

    #[test]
    fn test_alert_history_has_integration_id_not_channel_id() {
        // Verify serde uses integration_id (not channel_id)
        let json = serde_json::json!({
            "id": 1_i64,
            "alert_rule_id": null,
            "integration_id": 3,
            "issue_id": null,
            "project_id": null,
            "alert_type": "new_issue",
            "channel_type": "slack",
            "channel_name": "Slack Prod",
            "status": "sent",
            "attempt_count": 1,
            "next_retry_at": null,
            "error_message": null,
            "http_status_code": null,
            "idempotency_key": "key-123",
            "created_at": "2026-01-01T00:00:00Z",
            "sent_at": null
        });
        let history: AlertHistory =
            serde_json::from_value(json).expect("must deserialize AlertHistory");
        assert_eq!(history.integration_id, Some(3));
    }
}
