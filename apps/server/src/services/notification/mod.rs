//! Notification dispatcher system using the Strategy pattern.
//!
//! This module provides a pluggable notification system that supports
//! multiple delivery channels (Webhook, Email, Slack) through a common trait.

pub mod email;
pub mod slack;
pub mod webhook;

use async_trait::async_trait;

use crate::error::AppResult;
use crate::models::{AlertPayload, ChannelType, NotificationChannel};

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
/// Each channel type (Webhook, Email, Slack) implements this trait
/// to provide channel-specific delivery logic.
#[async_trait]
pub trait NotificationDispatcher: Send + Sync {
    /// Send a notification to the channel
    async fn send(
        &self,
        channel: &NotificationChannel,
        payload: &AlertPayload,
    ) -> NotificationResult;

    /// Validate channel configuration
    ///
    /// Called before creating or updating a channel to ensure
    /// the configuration is valid for this channel type.
    fn validate_config(&self, config: &serde_json::Value) -> AppResult<()>;
}

// =============================================================================
// Dispatcher Factory
// =============================================================================

/// Creates the appropriate dispatcher for a channel type
pub fn create_dispatcher(channel_type: ChannelType) -> Box<dyn NotificationDispatcher> {
    match channel_type {
        ChannelType::Webhook => Box::new(WebhookNotifier::new()),
        ChannelType::Email => Box::new(EmailNotifier::new()),
        ChannelType::Slack => Box::new(SlackNotifier::new()),
    }
}
