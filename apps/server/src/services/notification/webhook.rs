//! Webhook notification dispatcher.
//!
//! Sends alerts as HTTP POST requests with JSON payloads.
//! Supports HMAC-SHA256 signature verification for security.
//!
//! Routing override (flat struct, no provider_type discriminator — SCL-1):
//! `{"url": "https://override.example.com/hook", "extra_headers": {...}}`
//!
//! Effective URL (K5): routing.url ?? credentials.url

use async_trait::async_trait;
use chrono::Utc;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

use super::{NotificationDispatcher, NotificationResult};
use crate::error::{AppError, AppResult};
use crate::models::{AlertIntegration, AlertPayload, WebhookConfig, WebhookRoutingOverride};

type HmacSha256 = Hmac<Sha256>;

/// Webhook notification dispatcher
pub struct WebhookNotifier {
    client: reqwest::Client,
}

impl WebhookNotifier {
    /// Creates a new webhook notifier
    pub fn new() -> Self {
        Self {
            client: super::shared_http_client().clone(),
        }
    }

    /// Generates HMAC-SHA256 signature for webhook payload
    ///
    /// Shared with the custom webhook dispatcher; same `timestamp.payload`
    /// canonicalisation and `sha256=<hex>` scheme.
    pub(crate) fn generate_signature(secret: &str, timestamp: &str, payload: &[u8]) -> String {
        let signature_payload = format!("{}.{}", timestamp, String::from_utf8_lossy(payload));
        let mut mac =
            HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
        mac.update(signature_payload.as_bytes());
        let result = mac.finalize();
        hex::encode(result.into_bytes())
    }

    /// Computes the effective URL: routing.url ?? credentials.url (K5).
    pub fn effective_url<'a>(
        routing: &'a WebhookRoutingOverride,
        credentials: &'a WebhookConfig,
    ) -> Option<&'a str> {
        routing.url.as_deref().or(credentials.url.as_deref())
    }
}

impl Default for WebhookNotifier {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl NotificationDispatcher for WebhookNotifier {
    async fn send(
        &self,
        integration: &AlertIntegration,
        routing: &serde_json::Value,
        payload: &AlertPayload,
    ) -> NotificationResult {
        // is_enabled check FIRST (SCL-1)
        if !integration.is_enabled {
            log::debug!(
                "Skipping dispatch to disabled Webhook integration {} ({})",
                integration.id,
                integration.name
            );
            return NotificationResult::success(None);
        }

        // Parse credentials
        let credentials: WebhookConfig =
            match serde_json::from_value(integration.credentials.clone()) {
                Ok(c) => c,
                Err(e) => {
                    return NotificationResult::failure(
                        format!("Invalid webhook credentials: {}", e),
                        None,
                    )
                }
            };

        // Parse flat routing override (no tag — SCL-1)
        let routing_override: WebhookRoutingOverride = serde_json::from_value(routing.clone())
            .unwrap_or(WebhookRoutingOverride {
                url: None,
                extra_headers: None,
            });

        // Effective URL: routing wins over credentials (K5)
        let url = match Self::effective_url(&routing_override, &credentials) {
            Some(u) => u.to_string(),
            None => {
                return NotificationResult::failure(
                    "Webhook URL not configured in credentials or routing_override".to_string(),
                    None,
                )
            }
        };

        // Serialize payload
        let body = match serde_json::to_vec(payload) {
            Ok(b) => b,
            Err(e) => {
                return NotificationResult::failure(
                    format!("Failed to serialize payload: {}", e),
                    None,
                )
            }
        };

        let timestamp = Utc::now().timestamp().to_string();

        // Build request
        let mut request = self
            .client
            .post(url)
            .header("Content-Type", "application/json")
            .header("X-Rustrak-Timestamp", &timestamp)
            .header("X-Rustrak-Request-ID", &payload.alert_id);

        // Add HMAC signature if secret is configured
        if let Some(ref secret) = credentials.secret {
            let signature = Self::generate_signature(secret, &timestamp, &body);
            request = request.header("X-Rustrak-Signature", format!("sha256={}", signature));
        }

        // Add credential-level custom headers
        if let Some(ref headers) = credentials.headers {
            for (key, value) in headers {
                request = request.header(key.as_str(), value.as_str());
            }
        }

        // Add routing-level extra headers (override credential-level headers)
        if let Some(ref extra_headers) = routing_override.extra_headers {
            for (key, value) in extra_headers {
                request = request.header(key.as_str(), value.as_str());
            }
        }

        // Send request
        match request.body(body).send().await {
            Ok(response) => {
                let status = response.status().as_u16();
                if response.status().is_success() {
                    NotificationResult::success(Some(status))
                } else {
                    let error_body = response.text().await.unwrap_or_default();
                    let error_msg = if error_body.is_empty() {
                        format!("HTTP {}", status)
                    } else {
                        format!("HTTP {}: {}", status, error_body)
                    };
                    NotificationResult::failure(error_msg, Some(status))
                }
            }
            Err(e) => {
                let error_msg = if e.is_timeout() {
                    "Request timed out".to_string()
                } else if e.is_connect() {
                    "Connection failed".to_string()
                } else {
                    format!("Request failed: {}", e)
                };
                NotificationResult::failure(error_msg, None)
            }
        }
    }

    fn validate_config(&self, config: &serde_json::Value) -> AppResult<()> {
        let webhook_config: WebhookConfig = serde_json::from_value(config.clone())
            .map_err(|e| AppError::Validation(format!("Invalid webhook config: {}", e)))?;

        // URL in credentials is optional — webhook can rely entirely on routing_override.url
        // Validate format if present
        if let Some(ref url) = webhook_config.url {
            if url.is_empty() {
                return Err(AppError::Validation(
                    "Webhook URL cannot be empty if provided".to_string(),
                ));
            }

            let parsed_url = url::Url::parse(url)
                .map_err(|_| AppError::Validation("Invalid webhook URL format".to_string()))?;

            if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
                return Err(AppError::Validation(
                    "Webhook URL must use HTTP or HTTPS".to_string(),
                ));
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn make_webhook_integration(url: Option<&str>, is_enabled: bool) -> AlertIntegration {
        let credentials = if let Some(u) = url {
            serde_json::json!({"url": u, "secret": "my-secret"})
        } else {
            serde_json::json!({"secret": "my-secret"})
        };
        AlertIntegration {
            id: 3,
            name: "Test Webhook".to_string(),
            provider_type: crate::models::ProviderType::Webhook,
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
    // Task 4 RED→GREEN: disabled integration skipped
    // -------------------------------------------------------------------------

    #[tokio::test]
    async fn test_disabled_webhook_integration_skipped() {
        let notifier = WebhookNotifier::new();
        let integration = make_webhook_integration(Some("https://example.com/hook"), false);
        let routing = serde_json::json!({});
        let payload = create_test_payload();

        let result = notifier.send(&integration, &routing, &payload).await;

        assert!(
            result.success,
            "disabled integration must return success (skip)"
        );
    }

    // -------------------------------------------------------------------------
    // Task 4 RED→GREEN: effective_url = routing.url ?? credentials.url (K5)
    // -------------------------------------------------------------------------

    #[test]
    fn test_effective_url_routing_wins_over_credentials() {
        let routing = WebhookRoutingOverride {
            url: Some("https://routing.example.com/hook".to_string()),
            extra_headers: None,
        };
        let credentials = WebhookConfig {
            url: Some("https://creds.example.com/hook".to_string()),
            secret: None,
            headers: None,
        };
        let url = WebhookNotifier::effective_url(&routing, &credentials);
        assert_eq!(url, Some("https://routing.example.com/hook"));
    }

    #[test]
    fn test_effective_url_falls_back_to_credentials() {
        let routing = WebhookRoutingOverride {
            url: None,
            extra_headers: None,
        };
        let credentials = WebhookConfig {
            url: Some("https://creds.example.com/hook".to_string()),
            secret: None,
            headers: None,
        };
        let url = WebhookNotifier::effective_url(&routing, &credentials);
        assert_eq!(url, Some("https://creds.example.com/hook"));
    }

    #[test]
    fn test_effective_url_none_when_both_absent() {
        let routing = WebhookRoutingOverride {
            url: None,
            extra_headers: None,
        };
        let credentials = WebhookConfig {
            url: None,
            secret: None,
            headers: None,
        };
        let url = WebhookNotifier::effective_url(&routing, &credentials);
        assert!(url.is_none());
    }

    // -------------------------------------------------------------------------
    // Existing tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_generate_signature() {
        let secret = "test-secret";
        let timestamp = "1706140800";
        let payload = b"{\"test\":\"data\"}";

        let signature = WebhookNotifier::generate_signature(secret, timestamp, payload);

        assert_eq!(signature.len(), 64);
        assert!(signature.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_signature_consistency() {
        let secret = "my-secret";
        let timestamp = "1234567890";
        let payload = b"hello world";

        let sig1 = WebhookNotifier::generate_signature(secret, timestamp, payload);
        let sig2 = WebhookNotifier::generate_signature(secret, timestamp, payload);

        assert_eq!(sig1, sig2);
    }

    #[test]
    fn test_signature_changes_with_secret() {
        let timestamp = "1234567890";
        let payload = b"hello world";

        let sig1 = WebhookNotifier::generate_signature("secret1", timestamp, payload);
        let sig2 = WebhookNotifier::generate_signature("secret2", timestamp, payload);

        assert_ne!(sig1, sig2);
    }

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
                title: "Test error".to_string(),
                level: Some("error".to_string()),
                first_seen: Utc::now(),
                last_seen: Utc::now(),
                event_count: 1,
            },
            issue_url: "https://example.com/issues/abc-123".to_string(),
            actor: "Rustrak".to_string(),
        }
    }
}
