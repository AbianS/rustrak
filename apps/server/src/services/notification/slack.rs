//! Slack notification dispatcher.
//!
//! Supports two delivery methods:
//! - `webhook` — POST to an Incoming Webhook URL (no channel/identity override)
//! - `bot_token` — POST to `chat.postMessage` with `Authorization: Bearer xoxb-…`
//!
//! Routing override (flat struct, no provider_type discriminator — SCL-1):
//! - bot_token: `{"channel": "#fe", "username": "optional", "icon_emoji": "optional"}`
//! - webhook:   `{}`

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
        Self {
            client: super::shared_http_client().clone(),
        }
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
    /// Channel, username, icon_emoji come from the per-rule routing_override.
    fn format_bot_message(
        creds: &SlackBotTokenConfig,
        routing: &SlackRoutingOverride,
        payload: &AlertPayload,
    ) -> serde_json::Value {
        let mut body = Self::format_webhook_message(payload);

        // Channel: routing wins over credentials
        let channel = routing
            .channel
            .as_deref()
            .or(creds.channel.as_deref())
            .unwrap_or_default();
        body["channel"] = json!(channel);

        let username = routing.username.as_deref().or(creds.username.as_deref());
        if let Some(u) = username {
            body["username"] = json!(u);
        }

        let icon_emoji = routing
            .icon_emoji
            .as_deref()
            .or(creds.icon_emoji.as_deref());
        if let Some(e) = icon_emoji {
            body["icon_emoji"] = json!(e);
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
        cfg: &SlackBotTokenConfig,
        routing: &SlackRoutingOverride,
        payload: &AlertPayload,
    ) -> NotificationResult {
        let channel = routing
            .channel
            .as_deref()
            .or(cfg.channel.as_deref())
            .unwrap_or("");
        if channel.trim().is_empty() {
            return NotificationResult::failure(
                "Slack bot_token requires a channel in routing_override or credentials".to_string(),
                None,
            );
        }

        let body = Self::format_bot_message(cfg, routing, payload);

        match self
            .client
            .post("https://slack.com/api/chat.postMessage")
            .header("Authorization", format!("Bearer {}", cfg.token))
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
    async fn send(
        &self,
        integration: &AlertIntegration,
        routing: &serde_json::Value,
        payload: &AlertPayload,
    ) -> NotificationResult {
        // is_enabled check FIRST (SCL-1)
        if !integration.is_enabled {
            log::debug!(
                "Skipping dispatch to disabled Slack integration {} ({})",
                integration.id,
                integration.name
            );
            return NotificationResult::success(None);
        }

        // Parse credentials (tagged by method field)
        let config: SlackConfig = match serde_json::from_value(integration.credentials.clone()) {
            Ok(c) => c,
            Err(e) => {
                return NotificationResult::failure(
                    format!("Invalid Slack credentials: {}", e),
                    None,
                )
            }
        };

        // Parse flat routing override (no provider_type tag — SCL-1)
        let routing_override: SlackRoutingOverride = serde_json::from_value(routing.clone())
            .unwrap_or(SlackRoutingOverride {
                channel: None,
                username: None,
                icon_emoji: None,
            });

        match config {
            SlackConfig::Webhook(cfg) => self.send_webhook(&cfg, payload).await,
            SlackConfig::BotToken(cfg) => {
                self.send_bot_token(&cfg, &routing_override, payload).await
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

    fn make_slack_integration(method: &str, is_enabled: bool) -> AlertIntegration {
        let credentials = if method == "bot_token" {
            serde_json::json!({
                "method": "bot_token",
                "token": "xoxb-test-token-123"
            })
        } else {
            serde_json::json!({
                "method": "webhook",
                "webhook_url": "https://hooks.slack.com/services/T/B/X"
            })
        };
        AlertIntegration {
            id: 1,
            name: "Test Slack".to_string(),
            provider_type: crate::models::ProviderType::Slack,
            credentials,
            is_enabled,
            failure_count: 0,
            last_failure_at: None,
            last_failure_message: None,
            last_success_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    // -------------------------------------------------------------------------
    // Task 4 RED→GREEN: is_enabled=false returns Ok without dispatching
    // -------------------------------------------------------------------------

    #[tokio::test]
    async fn test_disabled_integration_skipped() {
        let notifier = SlackNotifier::new();
        let integration = make_slack_integration("bot_token", false);
        let routing = serde_json::json!({"channel": "#test"});
        let payload = create_test_payload();

        let result = notifier.send(&integration, &routing, &payload).await;

        // Should succeed (skip) without making any HTTP request
        assert!(
            result.success,
            "disabled integration must return success (skip)"
        );
    }

    // -------------------------------------------------------------------------
    // Task 4 RED→GREEN: bot_token reads channel from flat routing (no tag)
    // -------------------------------------------------------------------------

    #[test]
    fn test_bot_message_reads_channel_from_routing() {
        let creds = SlackBotTokenConfig {
            token: "xoxb-test".to_string(),
            channel: None,
            username: None,
            icon_emoji: None,
        };
        let routing = SlackRoutingOverride {
            channel: Some("#fe-alerts".to_string()),
            username: None,
            icon_emoji: None,
        };
        let payload = create_test_payload();
        let body = SlackNotifier::format_bot_message(&creds, &routing, &payload);
        assert_eq!(body["channel"], "#fe-alerts");
    }

    #[test]
    fn test_bot_message_routing_channel_overrides_creds_channel() {
        let creds = SlackBotTokenConfig {
            token: "xoxb-test".to_string(),
            channel: Some("#creds-channel".to_string()),
            username: None,
            icon_emoji: None,
        };
        let routing = SlackRoutingOverride {
            channel: Some("#routing-channel".to_string()),
            username: None,
            icon_emoji: None,
        };
        let payload = create_test_payload();
        let body = SlackNotifier::format_bot_message(&creds, &routing, &payload);
        assert_eq!(body["channel"], "#routing-channel");
    }

    // -------------------------------------------------------------------------
    // Existing tests — updated for new enum shape
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
        let json = serde_json::json!({
            "method": "bot_token",
            "token": "xoxb-12345-67890"
        });
        let config: SlackConfig = serde_json::from_value(json).expect("must deserialize");
        match config {
            SlackConfig::BotToken(b) => {
                assert_eq!(b.token, "xoxb-12345-67890");
                assert!(b.channel.is_none());
                assert!(b.username.is_none());
                assert!(b.icon_emoji.is_none());
            }
            _ => panic!("expected BotToken variant"),
        }
    }

    // -------------------------------------------------------------------------
    // Cycle 3: validate_config for bot token
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
}
