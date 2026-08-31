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

/// RAII guard that serializes SMTP_HOST mutation across parallel tests.
/// Owns the MutexGuard so the lock is held for the guard's entire lifetime.
struct SmtpHostGuard {
    previous: Option<String>,
    _lock: std::sync::MutexGuard<'static, ()>,
}

impl SmtpHostGuard {
    fn set(value: &str) -> Self {
        let lock = SMTP_ENV_LOCK.lock().expect("SMTP env lock poisoned");
        let previous = std::env::var("SMTP_HOST").ok();
        std::env::set_var("SMTP_HOST", value);
        Self {
            previous,
            _lock: lock,
        }
    }

    fn unset() -> Self {
        let lock = SMTP_ENV_LOCK.lock().expect("SMTP env lock poisoned");
        let previous = std::env::var("SMTP_HOST").ok();
        std::env::remove_var("SMTP_HOST");
        Self {
            previous,
            _lock: lock,
        }
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
fn test_webhook_validate_config_empty_credentials_ok() {
    // In two-tier model, URL is optional in credentials — it can come from routing_override.
    // Empty credentials are valid; URL presence is enforced at rule-create time.
    let dispatcher = create_dispatcher(ChannelType::Webhook);
    let config = json!({});

    assert!(dispatcher.validate_config(&config).is_ok());
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
// Custom Webhook Config Validation Tests
// =============================================================================

/// A template body the dispatcher can render for every test here.
const VALID_TEMPLATE: &str = r#"{"msgtype":"text","text":{"content":"{{ issue.title }}"}}"#;

#[test]
fn test_custom_webhook_factory_returns_dispatcher() {
    // create_dispatcher must know the variant or this panics on None behavior
    let dispatcher = create_dispatcher(ChannelType::CustomWebhook);
    assert!(dispatcher
        .validate_config(&json!({"url": "https://example.com/hook", "template": VALID_TEMPLATE}))
        .is_ok());
}

#[test]
fn test_custom_webhook_validate_config_requires_template() {
    let dispatcher = create_dispatcher(ChannelType::CustomWebhook);
    assert!(dispatcher
        .validate_config(&json!({"url": "https://example.com/hook"}))
        .is_err());
    assert!(dispatcher
        .validate_config(&json!({"url": "https://example.com/hook", "template": "  "}))
        .is_err());
}

#[test]
fn test_custom_webhook_validate_config_rejects_bad_template_syntax() {
    let dispatcher = create_dispatcher(ChannelType::CustomWebhook);
    let result = dispatcher.validate_config(&json!({"template": "{% if %}"}));
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Invalid template syntax"));
}

#[test]
fn test_custom_webhook_validate_config_rejects_bad_url() {
    let dispatcher = create_dispatcher(ChannelType::CustomWebhook);
    assert!(dispatcher
        .validate_config(&json!({"url": "ftp://example.com/hook", "template": VALID_TEMPLATE}))
        .is_err());
    assert!(dispatcher
        .validate_config(&json!({"url": "not-a-url", "template": VALID_TEMPLATE}))
        .is_err());
}

#[test]
fn test_custom_webhook_validate_config_url_optional_but_template_not() {
    // URL may be absent (routing_override supplies it) but the template is required.
    let dispatcher = create_dispatcher(ChannelType::CustomWebhook);
    assert!(dispatcher
        .validate_config(&json!({"template": VALID_TEMPLATE}))
        .is_ok());
}

// =============================================================================
// Slack Config Validation Tests
// =============================================================================

// =============================================================================
// Slack Config Validation Tests — webhook method
// =============================================================================

#[test]
fn test_slack_validate_config_valid() {
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "method": "webhook",
        "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX"
    });

    assert!(dispatcher.validate_config(&config).is_ok());
}

#[test]
fn test_slack_validate_config_missing_url() {
    let dispatcher = create_dispatcher(ChannelType::Slack);
    // method field present but webhook_url missing — serde should fail
    let config = json!({ "method": "webhook" });

    assert!(dispatcher.validate_config(&config).is_err());
}

#[test]
fn test_slack_validate_config_missing_method_field_is_err() {
    // Legacy shape without method field — should fail after migration
    // (migration adds the field; configs missing it are invalid at validate time)
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX"
    });

    assert!(dispatcher.validate_config(&config).is_err());
}

#[test]
fn test_slack_validate_config_invalid_domain() {
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "method": "webhook",
        "webhook_url": "https://example.com/webhook"
    });

    assert!(dispatcher.validate_config(&config).is_err());
}

#[test]
fn test_slack_validate_config_rejects_subdomain_bypass() {
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "method": "webhook",
        "webhook_url": "https://hooks.slack.com.evil.com/services/T00000000/B00000000/XXXXXXXX"
    });

    assert!(dispatcher.validate_config(&config).is_err());
}

#[test]
fn test_slack_validate_config_rejects_http() {
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "method": "webhook",
        "webhook_url": "http://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX"
    });

    assert!(dispatcher.validate_config(&config).is_err());
}

// =============================================================================
// Slack Config Validation Tests — bot_token method
// =============================================================================

#[test]
fn test_slack_bot_token_validate_config_valid() {
    // In two-tier model, channel is in routing_override (not credentials).
    // validate_config only checks the token prefix.
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "method": "bot_token",
        "token": "xoxb-123456789-abcdefghij"
    });

    assert!(dispatcher.validate_config(&config).is_ok());
}

#[test]
fn test_slack_bot_token_validate_rejects_non_xoxb_prefix() {
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "method": "bot_token",
        "token": "xoxa-should-fail",
        "channel": "#alerts"
    });

    let result = dispatcher.validate_config(&config);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("xoxb-"));
}

#[test]
fn test_slack_bot_token_validate_config_channel_is_routing_concern() {
    // In two-tier model, channel moves to routing_override — not validated in credentials.
    // validate_config only checks the token prefix; channel (empty or absent) is accepted.
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "method": "bot_token",
        "token": "xoxb-valid"
    });

    assert!(dispatcher.validate_config(&config).is_ok());
}

// =============================================================================
// Email Config Validation Tests
// =============================================================================

// In two-tier model, email credentials are SMTP config only; recipients live in
// routing_override and are validated by validate_routing_override at rule-create time.

#[test]
fn test_email_validate_config_valid() {
    let _guard = SmtpHostGuard::set("smtp.example.com");

    // Valid: SMTP host is set (globally via guard), credentials may be empty
    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({});

    let result = dispatcher.validate_config(&config);
    assert!(result.is_ok());
}

#[test]
fn test_email_validate_config_no_smtp_host_fails() {
    let _guard = SmtpHostGuard::unset();
    // No global SMTP and no integration SMTP should fail validation
    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({});

    let result = dispatcher.validate_config(&config);
    assert!(result.is_err());
}

#[test]
fn test_email_validate_config_recipients_are_routing_concern() {
    // recipients in credentials are silently ignored — they belong in routing_override
    let _guard = SmtpHostGuard::set("smtp.example.com");
    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({ "smtp_host": "smtp.example.com" });

    // Extra fields or missing recipients: validate_config still returns Ok
    assert!(dispatcher.validate_config(&config).is_ok());
}
