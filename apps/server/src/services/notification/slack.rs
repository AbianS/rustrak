//! Slack notification dispatcher.
//!
//! Sends alerts to Slack channels using incoming webhooks.
//! Uses Slack Block Kit for rich message formatting.

use async_trait::async_trait;
use serde_json::json;

use super::{NotificationDispatcher, NotificationResult};
use crate::error::{AppError, AppResult};
use crate::models::{AlertPayload, NotificationChannel, SlackConfig};

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

    /// Formats an alert as a Slack Block Kit message
    fn format_message(config: &SlackConfig, payload: &AlertPayload) -> serde_json::Value {
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

        let mut message = json!({
            "username": config.username.as_deref().unwrap_or("Rustrak"),
            "icon_emoji": config.icon_emoji.as_deref().unwrap_or(":bug:"),
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
        });

        // Add channel override if specified
        if let Some(ref channel) = config.channel {
            message["channel"] = json!(channel);
        }

        message
    }

    /// Escapes special Slack markdown characters
    fn escape_markdown(text: &str) -> String {
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
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
        channel: &NotificationChannel,
        payload: &AlertPayload,
    ) -> NotificationResult {
        // Parse config
        let config: SlackConfig = match serde_json::from_value(channel.config.clone()) {
            Ok(c) => c,
            Err(e) => {
                return NotificationResult::failure(format!("Invalid Slack config: {}", e), None)
            }
        };

        let message = Self::format_message(&config, payload);

        // Send to Slack webhook
        match self
            .client
            .post(&config.webhook_url)
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

    fn validate_config(&self, config: &serde_json::Value) -> AppResult<()> {
        let slack_config: SlackConfig = serde_json::from_value(config.clone())
            .map_err(|e| AppError::Validation(format!("Invalid Slack config: {}", e)))?;

        if slack_config.webhook_url.is_empty() {
            return Err(AppError::Validation(
                "Slack webhook URL is required".to_string(),
            ));
        }

        // Validate URL format and extract components
        let parsed_url = url::Url::parse(&slack_config.webhook_url)
            .map_err(|_| AppError::Validation("Invalid Slack webhook URL format".to_string()))?;

        // Slack webhooks must use HTTPS
        if parsed_url.scheme() != "https" {
            return Err(AppError::Validation(
                "Slack webhook URL must use HTTPS".to_string(),
            ));
        }

        // Validate exact host match to prevent bypass via subdomains
        // e.g., hooks.slack.com.evil.com would fail this check
        if parsed_url.host_str() != Some("hooks.slack.com") {
            return Err(AppError::Validation(
                "Invalid Slack webhook URL: host must be hooks.slack.com".to_string(),
            ));
        }

        Ok(())
    }
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

    #[test]
    fn test_format_message_structure() {
        let config = SlackConfig {
            webhook_url: "https://hooks.slack.com/test".to_string(),
            channel: Some("#alerts".to_string()),
            username: Some("TestBot".to_string()),
            icon_emoji: Some(":robot:".to_string()),
        };
        let payload = create_test_payload();

        let message = SlackNotifier::format_message(&config, &payload);

        assert!(message["blocks"].is_array());
        assert_eq!(message["username"], "TestBot");
        assert_eq!(message["icon_emoji"], ":robot:");
        assert_eq!(message["channel"], "#alerts");
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
}
