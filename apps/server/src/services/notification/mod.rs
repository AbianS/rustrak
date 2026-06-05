//! Notification dispatcher system using the Strategy pattern.
//!
//! This module provides a pluggable notification system that supports
//! multiple delivery integrations (Webhook, Email, Slack) through a common trait.

pub mod email;
pub mod slack;
pub mod webhook;

use async_trait::async_trait;

use crate::error::AppResult;
use crate::models::{AlertIntegration, AlertPayload, ProviderType};

pub use email::EmailNotifier;
pub use slack::SlackNotifier;
pub use webhook::WebhookNotifier;

// =============================================================================
// Notification Result
// =============================================================================

/// Result of a notification delivery attempt
#[derive(Debug)]
pub struct NotificationResult {
    /// Whether the notification was delivered successfully
    pub success: bool,
    /// HTTP status code (if applicable)
    pub http_status: Option<u16>,
    /// Error message (if failed)
    pub error_message: Option<String>,
}

impl NotificationResult {
    /// Creates a successful result
    pub fn success(http_status: Option<u16>) -> Self {
        Self {
            success: true,
            http_status,
            error_message: None,
        }
    }

    /// Creates a failed result
    pub fn failure(error_message: String, http_status: Option<u16>) -> Self {
        Self {
            success: false,
            http_status,
            error_message: Some(error_message),
        }
    }
}

// =============================================================================
// Notification Dispatcher Trait
// =============================================================================

/// Trait for notification dispatchers (Strategy pattern)
///
/// Each provider type (Webhook, Email, Slack) implements this trait
/// to provide provider-specific delivery logic.
#[async_trait]
pub trait NotificationDispatcher: Send + Sync {
    /// Send a notification to the integration.
    ///
    /// `routing` is the flat JSON routing_override from alert_rule_channels.
    /// Each dispatcher deserializes it into its own routing struct (no tag needed —
    /// the provider type is already known from the integration).
    ///
    /// Dispatchers MUST check `integration.is_enabled` first and return
    /// `Ok(NotificationResult::success(None))` immediately if disabled.
    async fn send(
        &self,
        integration: &AlertIntegration,
        routing: &serde_json::Value,
        payload: &AlertPayload,
    ) -> NotificationResult;

    /// Validate integration credentials.
    ///
    /// Called before creating or updating an integration to ensure
    /// the credentials are valid for this provider type.
    fn validate_config(&self, config: &serde_json::Value) -> AppResult<()>;
}

// =============================================================================
// Dispatcher Factory
// =============================================================================

/// Creates the appropriate dispatcher for a provider type
pub fn create_dispatcher(provider_type: ProviderType) -> Box<dyn NotificationDispatcher> {
    match provider_type {
        ProviderType::Webhook => Box::new(WebhookNotifier::new()),
        ProviderType::Email => Box::new(EmailNotifier::new()),
        ProviderType::Slack => Box::new(SlackNotifier::new()),
    }
}
