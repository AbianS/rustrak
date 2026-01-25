//! Unit tests for notification channel configuration validation
//!
//! Tests the public validate_config API for webhook, slack, and email notifiers.

use rustrak::models::ChannelType;
use rustrak::services::create_dispatcher;
use serde_json::json;

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
    // Set global SMTP for test
    std::env::set_var("SMTP_HOST", "smtp.example.com");

    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({
        "recipients": ["test@example.com"]
    });

    let result = dispatcher.validate_config(&config);
    assert!(result.is_ok());

    std::env::remove_var("SMTP_HOST");
}

#[test]
fn test_email_validate_config_empty_recipients() {
    std::env::set_var("SMTP_HOST", "smtp.example.com");

    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({
        "recipients": []
    });

    let result = dispatcher.validate_config(&config);
    assert!(result.is_err());

    std::env::remove_var("SMTP_HOST");
}

#[test]
fn test_email_validate_config_invalid_email() {
    std::env::set_var("SMTP_HOST", "smtp.example.com");

    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({
        "recipients": ["not-an-email"]
    });

    let result = dispatcher.validate_config(&config);
    assert!(result.is_err());

    std::env::remove_var("SMTP_HOST");
}
