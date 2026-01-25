//! Alert models for the notification system.
//!
//! This module contains models for notification channels (global destinations),
//! alert rules (per-project triggers), and alert history (audit log).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;
use uuid::Uuid;

// =============================================================================
// Channel Type Enum
// =============================================================================

/// Type of notification channel
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ChannelType {
    Webhook,
    Email,
    Slack,
}

impl std::fmt::Display for ChannelType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChannelType::Webhook => write!(f, "webhook"),
            ChannelType::Email => write!(f, "email"),
            ChannelType::Slack => write!(f, "slack"),
        }
    }
}

// =============================================================================
// Alert Type Enum
// =============================================================================

/// Type of alert trigger
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
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
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum AlertStatus {
    Pending,
    Sent,
    Failed,
    Skipped,
}

// =============================================================================
// Notification Channel Model
// =============================================================================

/// Global notification channel (e.g., Slack workspace, webhook endpoint)
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct NotificationChannel {
    pub id: i32,
    pub name: String,
    pub channel_type: ChannelType,
    pub config: serde_json::Value,
    pub is_enabled: bool,
    pub failure_count: i32,
    pub last_failure_at: Option<DateTime<Utc>>,
    pub last_failure_message: Option<String>,
    pub last_success_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a notification channel
#[derive(Debug, Deserialize)]
pub struct CreateNotificationChannel {
    pub name: String,
    pub channel_type: ChannelType,
    pub config: serde_json::Value,
    #[serde(default = "default_true")]
    pub is_enabled: bool,
}

fn default_true() -> bool {
    true
}

/// DTO for updating a notification channel
#[derive(Debug, Deserialize)]
pub struct UpdateNotificationChannel {
    pub name: Option<String>,
    pub config: Option<serde_json::Value>,
    pub is_enabled: Option<bool>,
}

// =============================================================================
// Channel Configuration Types
// =============================================================================

/// Webhook channel configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    pub url: String,
    #[serde(default)]
    pub secret: Option<String>,
    #[serde(default)]
    pub headers: Option<HashMap<String, String>>,
}

/// Email channel configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailConfig {
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

/// Slack channel configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackConfig {
    pub webhook_url: String,
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub icon_emoji: Option<String>,
}

// =============================================================================
// Alert Rule Model
// =============================================================================

/// Per-project alert rule configuration
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct AlertRule {
    pub id: i32,
    pub project_id: i32,
    pub name: String,
    pub alert_type: AlertType,
    pub is_enabled: bool,
    pub conditions: serde_json::Value,
    pub cooldown_minutes: i32,
    pub last_triggered_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating an alert rule
#[derive(Debug, Deserialize)]
pub struct CreateAlertRule {
    pub name: String,
    pub alert_type: AlertType,
    #[serde(default = "default_conditions")]
    pub conditions: serde_json::Value,
    #[serde(default)]
    pub cooldown_minutes: i32,
    #[serde(default)]
    pub channel_ids: Vec<i32>,
}

fn default_conditions() -> serde_json::Value {
    serde_json::json!({})
}

/// DTO for updating an alert rule
#[derive(Debug, Deserialize)]
pub struct UpdateAlertRule {
    pub name: Option<String>,
    pub is_enabled: Option<bool>,
    pub conditions: Option<serde_json::Value>,
    pub cooldown_minutes: Option<i32>,
    pub channel_ids: Option<Vec<i32>>,
}

/// Response for alert rule including linked channel IDs
#[derive(Debug, Serialize)]
pub struct AlertRuleResponse {
    pub id: i32,
    pub project_id: i32,
    pub name: String,
    pub alert_type: AlertType,
    pub is_enabled: bool,
    pub conditions: serde_json::Value,
    pub cooldown_minutes: i32,
    pub last_triggered_at: Option<DateTime<Utc>>,
    pub channel_ids: Vec<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl AlertRule {
    /// Converts to response with channel IDs
    pub fn to_response(&self, channel_ids: Vec<i32>) -> AlertRuleResponse {
        AlertRuleResponse {
            id: self.id,
            project_id: self.project_id,
            name: self.name.clone(),
            alert_type: self.alert_type,
            is_enabled: self.is_enabled,
            conditions: self.conditions.clone(),
            cooldown_minutes: self.cooldown_minutes,
            last_triggered_at: self.last_triggered_at,
            channel_ids,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

// =============================================================================
// Alert History Model
// =============================================================================

/// Alert delivery history record (audit log and retry queue)
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct AlertHistory {
    pub id: i64,
    pub alert_rule_id: Option<i32>,
    pub channel_id: Option<i32>,
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
