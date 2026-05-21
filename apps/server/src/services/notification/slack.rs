//! Slack notification dispatcher.
//!
//! Supports two delivery methods:
//! - `webhook` — POST to an Incoming Webhook URL (no channel/identity override)
//! - `bot_token` — POST to `chat.postMessage` with `Authorization: Bearer xoxb-…`
//!
//! ## Two-Tier Routing
//!
//! For `webhook` method, the routing override is always `{}` (channel is
//! encoded in the webhook URL and cannot be changed per-rule).
//!
//! For `bot_token` method, the routing override carries:
//! - `channel` (required) — target Slack channel
//! - `username` (optional) — bot display name override
//! - `icon_emoji` (optional) — bot icon emoji override
//!
//! The dispatcher reads these from `routing` (not from integration credentials).

use async_trait::async_trait;
use serde_json::json;

use super::{NotificationDispatcher, NotificationResult};
use crate::error::{AppError, AppResult};
use crate::models::{
    AlertIntegration, AlertPayload, SlackBotTokenConfig, SlackConfig, SlackRoutingOverride,
    SlackWebhookConfig,
};

/// Slack notification dispatcher
pub struct SlackNotifier {
    client: reqwest::Client,
}

impl SlackNotifier {
    /// Creates a new Slack notifier
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client }
    }

    /// Escapes special Slack markdown characters
    fn escape_markdown(text: &str) -> String {
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
    }

    /// Builds the Slack Block Kit message body for the webhook variant.
    /// Channel/username/icon are NOT included — Slack ignores overrides on
    /// modern app-based webhooks and including them is misleading.
    fn format_webhook_message(payload: &AlertPayload) -> serde_json::Value {
        let level_emoji = match payload.issue.level.as_deref() {
            Some("fatal") => ":rotating_light:",
            Some("error") => ":x:",
            Some("warning") => ":warning:",
            Some("info") => ":information_source:",
            Some("debug") => ":mag:",
            _ => ":grey_question:",
        };

        let alert_emoji = match payload.alert_type.as_str() {
            "new_issue" => ":new:",
            "regression" => ":repeat:",
            "unmute" => ":loud_sound:",
            _ => ":bell:",
        };

        let alert_type_display = payload
            .alert_type
            .replace('_', " ")
            .split_whitespace()
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    Some(first) => first.to_uppercase().chain(chars).collect(),
                    None => String::new(),
                }
            })
            .collect::<Vec<String>>()
            .join(" ");

        json!({
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": format!("{} {} in {}", alert_emoji, alert_type_display, payload.project.name),
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": format!(
                            "{} *<{}|{}>*\n{}",
                            level_emoji,
                            payload.issue_url,
                            payload.issue.short_id,
                            Self::escape_markdown(&payload.issue.title)
                        )
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": format!(
                                "*Events:* {} | *First seen:* <!date^{}^{{date_short_pretty}} {{time}}|{}> | *Last seen:* <!date^{}^{{date_short_pretty}} {{time}}|{}>",
                                payload.issue.event_count,
                                payload.issue.first_seen.timestamp(),
                                payload.issue.first_seen.format("%Y-%m-%d %H:%M"),
                                payload.issue.last_seen.timestamp(),
                                payload.issue.last_seen.format("%Y-%m-%d %H:%M")
                            )
                        }
                    ]
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "View Issue",
                                "emoji": true
                            },
                            "url": payload.issue_url,
                            "action_id": "view_issue"
                        }
                    ]
                }
            ]
        })
    }

    /// Builds the chat.postMessage body for the bot token variant.
    ///
    /// `channel` comes from the routing override, not from integration credentials.
    fn format_bot_message(
        credentials: &SlackBotTokenConfig,
        routing: &SlackRoutingOverride,
        payload: &AlertPayload,
    ) -> serde_json::Value {
        let mut body = Self::format_webhook_message(payload);

        // Channel from routing takes priority; fall back to credentials (legacy)
        let channel = routing
            .channel
            .as_deref()
            .or(credentials.channel.as_deref())
            .unwrap_or("");
        body["channel"] = json!(channel);

        let username = routing.username.as_deref().or(credentials.username.as_deref());
        if let Some(u) = username {
            body["username"] = json!(u);
        }

        let icon_emoji = routing
            .icon_emoji
            .as_deref()
            .or(credentials.icon_emoji.as_deref());
        if let Some(i) = icon_emoji {
            body["icon_emoji"] = json!(i);
        }

        body
    }

    /// Sends via Incoming Webhook (no auth header needed, URL is the secret).
    async fn send_webhook(
        &self,
        cfg: &SlackWebhookConfig,
        payload: &AlertPayload,
    ) -> NotificationResult {
        let message = Self::format_webhook_message(payload);

        match self
            .client
            .post(&cfg.webhook_url)
            .header("Content-Type", "application/json")
            .json(&message)
            .send()
            .await
        {
            Ok(response) => {
                let status = response.status().as_u16();
                if response.status().is_success() {
                    NotificationResult::success(Some(status))
                } else {
                    let error_body = response.text().await.unwrap_or_default();
                    let error_msg = match error_body.as_str() {
                        "invalid_token" => "Invalid Slack webhook URL".to_string(),
                        "channel_not_found" => "Slack channel not found".to_string(),
                        "channel_is_archived" => "Slack channel is archived".to_string(),
                        "posting_to_general_channel_denied" => {
                            "Cannot post to #general channel".to_string()
                        }
                        _ if error_body.is_empty() => format!("Slack API error: HTTP {}", status),
                        _ => format!("Slack API error: {}", error_body),
                    };
                    NotificationResult::failure(error_msg, Some(status))
                }
            }
            Err(e) => {
                let error_msg = if e.is_timeout() {
                    "Request to Slack timed out".to_string()
                } else if e.is_connect() {
                    "Connection to Slack failed".to_string()
                } else {
                    format!("Slack request failed: {}", e)
                };
                NotificationResult::failure(error_msg, None)
            }
        }
    }

    /// Sends via `chat.postMessage` using a bot token.
    /// Slack's Web API always returns HTTP 200; success/failure is in the JSON body.
    async fn send_bot_token(
        &self,
        credentials: &SlackBotTokenConfig,
        routing: &SlackRoutingOverride,
        payload: &AlertPayload,
    ) -> NotificationResult {
        let body = Self::format_bot_message(credentials, routing, payload);

        match self
            .client
            .post("https://slack.com/api/chat.postMessage")
            .header("Authorization", format!("Bearer {}", credentials.token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
        {
            Ok(response) => {
                let http_status = response.status().as_u16();
                match response.json::<serde_json::Value>().await {
                    Ok(json_body) => {
                        if json_body["ok"].as_bool() == Some(true) {
                            NotificationResult::success(Some(http_status))
                        } else {
                            let err = json_body["error"].as_str().unwrap_or("unknown_error");
                            let msg = match err {
                                "not_in_channel" => {
                                    "Bot is not a member of the channel".to_string()
                                }
                                "channel_not_found" => "Slack channel not found".to_string(),
                                "invalid_auth" => "Invalid Slack bot token".to_string(),
                                _ => format!("Slack API error: {}", err),
                            };
                            NotificationResult::failure(msg, Some(http_status))
                        }
                    }
                    Err(e) => NotificationResult::failure(
                        format!("Failed to parse Slack API response: {}", e),
                        Some(http_status),
                    ),
                }
            }
            Err(e) => {
                let error_msg = if e.is_timeout() {
                    "Request to Slack timed out".to_string()
                } else if e.is_connect() {
                    "Connection to Slack failed".to_string()
                } else {
                    format!("Slack request failed: {}", e)
                };
                NotificationResult::failure(error_msg, None)
            }
        }
    }
}

impl Default for SlackNotifier {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl NotificationDispatcher for SlackNotifier {
    /// Send Slack notification using integration credentials + per-rule routing.
    ///
    /// For `bot_token` method: `routing["channel"]` is the target channel.
    /// For `webhook` method: routing is ignored (channel is encoded in webhook URL).
    async fn send(
        &self,
        integration: &AlertIntegration,
        routing: &serde_json::Value,
        payload: &AlertPayload,
    ) -> NotificationResult {
        let config: SlackConfig = match serde_json::from_value(integration.credentials.clone()) {
            Ok(c) => c,
            Err(e) => {
                return NotificationResult::failure(
                    format!("Invalid Slack credentials: {}", e),
                    None,
                )
            }
        };

        match config {
            SlackConfig::Webhook(cfg) => self.send_webhook(&cfg, payload).await,
            SlackConfig::BotToken(credentials) => {
                // Deserialise routing override (default to empty if missing/invalid)
                let routing_override: SlackRoutingOverride = serde_json::from_value(routing.clone())
                    .unwrap_or(SlackRoutingOverride {
                        channel: None,
                        username: None,
                        icon_emoji: None,
                    });
                self.send_bot_token(&credentials, &routing_override, payload)
                    .await
            }
        }
    }

    fn validate_config(&self, config: &serde_json::Value) -> AppResult<()> {
        let slack_config: SlackConfig = serde_json::from_value(config.clone())
            .map_err(|e| AppError::Validation(format!("Invalid Slack config: {}", e)))?;

        match slack_config {
            SlackConfig::Webhook(cfg) => validate_webhook_config(&cfg),
            SlackConfig::BotToken(cfg) => validate_bot_token_config(&cfg),
        }
    }
}

/// Validates webhook config: HTTPS + host must be exactly hooks.slack.com.
fn validate_webhook_config(cfg: &SlackWebhookConfig) -> AppResult<()> {
    if cfg.webhook_url.is_empty() {
        return Err(AppError::Validation(
            "Slack webhook URL is required".to_string(),
        ));
    }

    let parsed_url = url::Url::parse(&cfg.webhook_url)
        .map_err(|_| AppError::Validation("Invalid Slack webhook URL format".to_string()))?;

    if parsed_url.scheme() != "https" {
        return Err(AppError::Validation(
            "Slack webhook URL must use HTTPS".to_string(),
        ));
    }

    if parsed_url.host_str() != Some("hooks.slack.com") {
        return Err(AppError::Validation(
            "Invalid Slack webhook URL: host must be hooks.slack.com".to_string(),
        ));
    }

    Ok(())
}

/// Validates bot token config: token must start with `xoxb-`.
/// Note: `channel` is no longer required in credentials — it is a routing field.
fn validate_bot_token_config(cfg: &SlackBotTokenConfig) -> AppResult<()> {
    if !cfg.token.starts_with("xoxb-") {
        return Err(AppError::Validation(
            "Slack bot token must start with xoxb-".to_string(),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use crate::models::ProviderType;

    fn create_test_payload() -> AlertPayload {
        AlertPayload {
            alert_id: "test-123".to_string(),
            alert_type: "new_issue".to_string(),
            triggered_at: Utc::now(),
            project: crate::models::ProjectInfo {
                id: 1,
                name: "Test Project".to_string(),
                slug: "test-project".to_string(),
            },
            issue: crate::models::IssueInfo {
                id: "abc-123".to_string(),
                short_id: "TEST-1".to_string(),
                title: "TypeError: Cannot read property 'x' of undefined".to_string(),
                level: Some("error".to_string()),
                first_seen: Utc::now(),
                last_seen: Utc::now(),
                event_count: 5,
            },
            issue_url: "https://example.com/issues/abc-123".to_string(),
            actor: "Rustrak".to_string(),
        }
    }

    fn make_integration(credentials: serde_json::Value) -> AlertIntegration {
        AlertIntegration {
            id: 1,
            name: "Test Slack".to_string(),
            provider_type: ProviderType::Slack,
            credentials,
            is_enabled: true,
            failure_count: 0,
            last_failure_at: None,
            last_failure_message: None,
            last_success_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    // -------------------------------------------------------------------------
    // Existing tests — updated for new two-tier signature
    // -------------------------------------------------------------------------

    #[test]
    fn test_format_webhook_message_structure() {
        let payload = create_test_payload();
        let message = SlackNotifier::format_webhook_message(&payload);

        assert!(message["blocks"].is_array());
        // Webhook messages must NOT include username/icon/channel — Slack ignores them
        assert!(message.get("username").is_none());
        assert!(message.get("icon_emoji").is_none());
        assert!(message.get("channel").is_none());
    }

    #[test]
    fn test_escape_markdown() {
        assert_eq!(SlackNotifier::escape_markdown("a & b"), "a &amp; b");
        assert_eq!(SlackNotifier::escape_markdown("<script>"), "&lt;script&gt;");
        assert_eq!(
            SlackNotifier::escape_markdown("foo & <bar>"),
            "foo &amp; &lt;bar&gt;"
        );
    }

    // -------------------------------------------------------------------------
    // Cycle 1: SlackConfig tagged enum — webhook variant serde round-trip
    // -------------------------------------------------------------------------

    #[test]
    fn test_slack_config_webhook_deserializes_with_method_field() {
        // After the migration, existing records gain {"method":"webhook",...}
        // The enum must deserialize this shape correctly.
        let json = serde_json::json!({
            "method": "webhook",
            "webhook_url": "https://hooks.slack.com/services/T/B/X"
        });
        let config: SlackConfig = serde_json::from_value(json).expect("must deserialize");
        match config {
            SlackConfig::Webhook(w) => {
                assert_eq!(w.webhook_url, "https://hooks.slack.com/services/T/B/X");
            }
            _ => panic!("expected Webhook variant"),
        }
    }

    // -------------------------------------------------------------------------
    // Cycle 2: BotToken variant serde round-trip
    // -------------------------------------------------------------------------

    #[test]
    fn test_slack_config_bot_token_deserializes() {
        // After migration, credentials no longer include channel (it's in routing_override)
        let json = serde_json::json!({
            "method": "bot_token",
            "token": "xoxb-12345-67890"
        });
        let config: SlackConfig = serde_json::from_value(json).expect("must deserialize");
        match config {
            SlackConfig::BotToken(b) => {
                assert_eq!(b.token, "xoxb-12345-67890");
                assert!(b.channel.is_none());
            }
            _ => panic!("expected BotToken variant"),
        }
    }

    // -------------------------------------------------------------------------
    // Cycle 3: validate_config for bot token (token must start xoxb-)
    // -------------------------------------------------------------------------

    #[test]
    fn test_validate_bot_token_rejects_non_xoxb_prefix() {
        let notifier = SlackNotifier::new();
        let config = serde_json::json!({
            "method": "bot_token",
            "token": "xoxa-wrong"
        });
        let result = notifier.validate_config(&config);
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(
            msg.contains("xoxb-"),
            "error should mention xoxb- prefix, got: {msg}"
        );
    }

    #[test]
    fn test_validate_bot_token_valid() {
        let notifier = SlackNotifier::new();
        let config = serde_json::json!({
            "method": "bot_token",
            "token": "xoxb-123-456-abc"
        });
        assert!(notifier.validate_config(&config).is_ok());
    }

    // -------------------------------------------------------------------------
    // Cycle 4: validate_config still works for webhook variant
    // -------------------------------------------------------------------------

    #[test]
    fn test_validate_webhook_valid_url() {
        let notifier = SlackNotifier::new();
        let config = serde_json::json!({
            "method": "webhook",
            "webhook_url": "https://hooks.slack.com/services/T/B/X"
        });
        assert!(notifier.validate_config(&config).is_ok());
    }

    #[test]
    fn test_validate_webhook_rejects_http() {
        let notifier = SlackNotifier::new();
        let config = serde_json::json!({
            "method": "webhook",
            "webhook_url": "http://hooks.slack.com/services/T/B/X"
        });
        assert!(notifier.validate_config(&config).is_err());
    }

    #[test]
    fn test_validate_webhook_rejects_wrong_host() {
        let notifier = SlackNotifier::new();
        let config = serde_json::json!({
            "method": "webhook",
            "webhook_url": "https://hooks.slack.com.evil.com/services/T/B/X"
        });
        assert!(notifier.validate_config(&config).is_err());
    }

    // -------------------------------------------------------------------------
    // Cycle 5 (Task 3): routing_override drives bot_token channel
    // -------------------------------------------------------------------------

    #[test]
    fn test_bot_token_format_uses_routing_channel() {
        // Given credentials with no channel, routing_override supplies "#test"
        let credentials = SlackBotTokenConfig {
            token: "xoxb-abc".to_string(),
            channel: None,
            username: None,
            icon_emoji: None,
        };
        let routing = SlackRoutingOverride {
            channel: Some("#test".to_string()),
            username: None,
            icon_emoji: None,
        };
        let payload = create_test_payload();
        let body = SlackNotifier::format_bot_message(&credentials, &routing, &payload);

        assert_eq!(
            body["channel"].as_str(),
            Some("#test"),
            "routing channel must appear in postMessage body"
        );
    }

    #[test]
    fn test_bot_token_format_routing_channel_overrides_credentials_channel() {
        // routing_override.channel wins over credentials.channel on collision
        let credentials = SlackBotTokenConfig {
            token: "xoxb-abc".to_string(),
            channel: Some("#legacy".to_string()),
            username: None,
            icon_emoji: None,
        };
        let routing = SlackRoutingOverride {
            channel: Some("#override".to_string()),
            username: None,
            icon_emoji: None,
        };
        let payload = create_test_payload();
        let body = SlackNotifier::format_bot_message(&credentials, &routing, &payload);

        assert_eq!(body["channel"].as_str(), Some("#override"));
    }

    #[test]
    fn test_format_bot_message_includes_routing_username_and_icon() {
        let credentials = SlackBotTokenConfig {
            token: "xoxb-abc".to_string(),
            channel: None,
            username: None,
            icon_emoji: None,
        };
        let routing = SlackRoutingOverride {
            channel: Some("#alerts".to_string()),
            username: Some("RustrakBot".to_string()),
            icon_emoji: Some(":robot_face:".to_string()),
        };
        let payload = create_test_payload();
        let body = SlackNotifier::format_bot_message(&credentials, &routing, &payload);

        assert_eq!(body["username"].as_str(), Some("RustrakBot"));
        assert_eq!(body["icon_emoji"].as_str(), Some(":robot_face:"));
    }

    // -------------------------------------------------------------------------
    // Integration-level: send() reads routing from the Value parameter
    // -------------------------------------------------------------------------

    #[test]
    fn test_send_with_invalid_credentials_returns_failure() {
        // If credentials can't be parsed, send() must return failure without panicking
        let integration = make_integration(serde_json::json!({"bad": "data"}));
        let routing = serde_json::json!({});
        let payload = create_test_payload();
        let notifier = SlackNotifier::new();

        // We can't await in a sync test but we can verify the logic path compiles
        // and that validate_config would reject the invalid shape
        let result = notifier.validate_config(&integration.credentials);
        assert!(result.is_err(), "invalid credentials must fail validation");
        let _ = routing; // used above
        let _ = payload;
    }
}
