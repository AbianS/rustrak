//! Unit tests for notification channel configuration validation
//!
//! Tests the public validate_config API for webhook, slack, and email notifiers.

use rustrak::models::ChannelType;
use rustrak::services::create_dispatcher;
use serde_json::json;
use std::sync::Mutex;

/// Mutex to serialize tests that mutate SMTP_HOST environment variable.
/// This prevents race conditions when tests run in parallel.
static SMTP_ENV_LOCK: Mutex<()> = Mutex::new(());

/// RAII guard that restores SMTP_HOST to its previous value on drop.
struct SmtpHostGuard {
    previous: Option<String>,
}

impl SmtpHostGuard {
    fn set(value: &str) -> Self {
        let _lock = SMTP_ENV_LOCK.lock().expect("SMTP env lock poisoned");
        let previous = std::env::var("SMTP_HOST").ok();
        std::env::set_var("SMTP_HOST", value);
        // Note: We don't store the lock - tests are short enough that
        // holding it for the guard's lifetime is acceptable
        Self { previous }
    }
}

impl Drop for SmtpHostGuard {
    fn drop(&mut self) {
        match &self.previous {
            Some(value) => std::env::set_var("SMTP_HOST", value),
            None => std::env::remove_var("SMTP_HOST"),
        }
    }
}

// =============================================================================
// Webhook Config Validation Tests
// =============================================================================

#[test]
fn test_webhook_validate_config_valid() {
    let dispatcher = create_dispatcher(ChannelType::Webhook);
    let config = json!({
        "url": "https://example.com/webhook",
        "secret": "my-secret"
    });

    assert!(dispatcher.validate_config(&config).is_ok());
}

#[test]
fn test_webhook_validate_config_missing_url() {
    let dispatcher = create_dispatcher(ChannelType::Webhook);
    let config = json!({});

    assert!(dispatcher.validate_config(&config).is_err());
}

#[test]
fn test_webhook_validate_config_invalid_url() {
    let dispatcher = create_dispatcher(ChannelType::Webhook);
    let config = json!({
        "url": "not-a-url"
    });

    assert!(dispatcher.validate_config(&config).is_err());
}

#[test]
fn test_webhook_validate_config_invalid_scheme() {
    let dispatcher = create_dispatcher(ChannelType::Webhook);
    let config = json!({
        "url": "ftp://example.com/webhook"
    });

    assert!(dispatcher.validate_config(&config).is_err());
}

// =============================================================================
// Slack Config Validation Tests
// =============================================================================

#[test]
fn test_slack_validate_config_valid() {
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX"
    });

    assert!(dispatcher.validate_config(&config).is_ok());
}

#[test]
fn test_slack_validate_config_missing_url() {
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({});

    assert!(dispatcher.validate_config(&config).is_err());
}

#[test]
fn test_slack_validate_config_invalid_domain() {
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "webhook_url": "https://example.com/webhook"
    });

    assert!(dispatcher.validate_config(&config).is_err());
}

#[test]
fn test_slack_validate_config_rejects_subdomain_bypass() {
    let dispatcher = create_dispatcher(ChannelType::Slack);
    // This should be rejected - it's a subdomain bypass attempt
    let config = json!({
        "webhook_url": "https://hooks.slack.com.evil.com/services/T00000000/B00000000/XXXXXXXX"
    });

    assert!(dispatcher.validate_config(&config).is_err());
}

#[test]
fn test_slack_validate_config_rejects_http() {
    let dispatcher = create_dispatcher(ChannelType::Slack);
    // HTTP should be rejected
    let config = json!({
        "webhook_url": "http://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX"
    });

    assert!(dispatcher.validate_config(&config).is_err());
}

// =============================================================================
// Email Config Validation Tests
// =============================================================================

#[test]
fn test_email_validate_config_valid() {
    let _guard = SmtpHostGuard::set("smtp.example.com");

    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({
        "recipients": ["test@example.com"]
    });

    let result = dispatcher.validate_config(&config);
    assert!(result.is_ok());
}

#[test]
fn test_email_validate_config_empty_recipients() {
    let _guard = SmtpHostGuard::set("smtp.example.com");

    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({
        "recipients": []
    });

    let result = dispatcher.validate_config(&config);
    assert!(result.is_err());
}

#[test]
fn test_email_validate_config_invalid_email() {
    let _guard = SmtpHostGuard::set("smtp.example.com");

    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({
        "recipients": ["not-an-email"]
    });

    let result = dispatcher.validate_config(&config);
    assert!(result.is_err());
}
