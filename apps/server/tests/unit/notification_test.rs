//! Unit tests for notification integration configuration validation.
//!
//! Tests the public validate_config API for webhook, slack, and email notifiers.
//!
//! ## Two-Tier Design Impact
//!
//! After the two-tier migration:
//! - Webhook `url` is optional in credentials (can be in routing_override)
//! - Email `recipients` have moved to routing_override — no longer validated in credentials
//! - Slack bot_token `channel` has moved to routing_override — no longer validated in credentials
//!
//! validate_config only checks the credential shape, not routing fields.

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
    // url is now optional in credentials — can be supplied via routing_override.url
    let dispatcher = create_dispatcher(ChannelType::Webhook);
    let config = json!({});

    // Empty credentials are valid at integration-create time
    assert!(dispatcher.validate_config(&config).is_ok());
}

#[test]
fn test_webhook_validate_config_invalid_url() {
    // If url IS provided in credentials, it must still be a valid URL
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
    // After two-tier migration: channel is in routing_override, not credentials.
    // Valid bot_token credentials only need a valid token.
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "method": "bot_token",
        "token": "xoxb-123456789-abcdefghij"
        // channel is no longer in credentials — it's in routing_override
    });

    assert!(dispatcher.validate_config(&config).is_ok());
}

#[test]
fn test_slack_bot_token_validate_rejects_non_xoxb_prefix() {
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "method": "bot_token",
        "token": "xoxa-should-fail"
    });

    let result = dispatcher.validate_config(&config);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("xoxb-"));
}

#[test]
fn test_slack_bot_token_validate_empty_channel_in_credentials_is_ok() {
    // After migration: channel is in routing_override, not credentials.
    // validate_config no longer checks channel — that's a routing_override concern.
    let dispatcher = create_dispatcher(ChannelType::Slack);
    let config = json!({
        "method": "bot_token",
        "token": "xoxb-valid"
        // channel absent from credentials is fine (two-tier design)
    });

    let result = dispatcher.validate_config(&config);
    // Should pass — channel validation moved to routing_override at rule-create time
    assert!(result.is_ok(), "bot_token without channel in credentials must pass validate_config: {:?}", result);
}

// =============================================================================
// Email Config Validation Tests
// =============================================================================

#[test]
fn test_email_validate_config_valid() {
    // After two-tier migration: smtp_host is required (either in config or global env)
    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({
        "smtp_host": "smtp.example.com",
        "from_address": "alerts@example.com"
        // recipients are in routing_override now — not in credentials
    });

    let result = dispatcher.validate_config(&config);
    assert!(result.is_ok(), "valid email credentials must pass: {:?}", result);
}

#[test]
fn test_email_validate_config_empty_recipients_passes() {
    // Recipients are in routing_override now — not validated in credentials.
    // An empty recipients list in credentials should be fine (it's ignored).
    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({
        "smtp_host": "smtp.example.com",
        "recipients": []  // old-style field, harmless
    });

    let result = dispatcher.validate_config(&config);
    // validate_config no longer checks recipients — they're routing fields
    assert!(result.is_ok(), "empty recipients in credentials must not fail validate_config: {:?}", result);
}

#[test]
fn test_email_validate_config_invalid_email() {
    // Recipients are in routing_override — this test verifies that invalid email
    // addresses in the legacy credentials field don't cause a panic.
    // The validate_config only checks SMTP settings now.
    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({
        "smtp_host": "smtp.example.com",
        "recipients": ["not-an-email"]  // legacy field — ignored by validate_config
    });

    // validate_config should pass — recipient validation is at dispatch time
    let result = dispatcher.validate_config(&config);
    assert!(result.is_ok(), "invalid email in legacy credentials field must not block validate_config: {:?}", result);
}

#[test]
fn test_email_validate_config_requires_smtp_host() {
    // validate_config must fail when no smtp_host is in credentials AND no global env
    let dispatcher = create_dispatcher(ChannelType::Email);
    let config = json!({
        "from_address": "alerts@example.com"
        // no smtp_host, no global SMTP_HOST env var in tests
    });

    // In test environment, SMTP_HOST is not set, so this should fail
    let result = dispatcher.validate_config(&config);
    assert!(result.is_err(), "missing smtp_host must fail: {:?}", result);
}
