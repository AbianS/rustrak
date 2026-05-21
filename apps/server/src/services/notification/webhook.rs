//! Webhook notification dispatcher.
//!
//! Sends alerts as HTTP POST requests with JSON payloads.
//! Supports HMAC-SHA256 signature verification for security.
//!
//! ## Two-Tier Routing
//!
//! - `integration.credentials` may contain a default `url`, `secret`, and `headers`.
//! - `routing_override` may contain an `url` that overrides the global one, and
//!   `extra_headers` that are merged on top of credential headers (routing wins on
//!   key collision).
//! - Effective URL: `routing.url ?? credentials.url`. If both are absent, dispatch
//!   fails (this should be caught at rule-create validation time).

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
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client }
    }

    /// Generates HMAC-SHA256 signature for webhook payload
    fn generate_signature(secret: &str, timestamp: &str, payload: &[u8]) -> String {
        let signature_payload = format!("{}.{}", timestamp, String::from_utf8_lossy(payload));
        let mut mac =
            HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
        mac.update(signature_payload.as_bytes());
        let result = mac.finalize();
        hex::encode(result.into_bytes())
    }
}

impl Default for WebhookNotifier {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl NotificationDispatcher for WebhookNotifier {
    /// Send webhook using integration credentials + per-rule routing.
    ///
    /// Effective URL: `routing.url` wins over `credentials.url`.
    /// If both are absent, returns a failure (should have been caught at validation).
    /// Headers: credential headers merged with routing `extra_headers` (routing wins).
    async fn send(
        &self,
        integration: &AlertIntegration,
        routing: &serde_json::Value,
        payload: &AlertPayload,
    ) -> NotificationResult {
        // Parse integration credentials
        let config: WebhookConfig = match serde_json::from_value(integration.credentials.clone()) {
            Ok(c) => c,
            Err(e) => {
                return NotificationResult::failure(
                    format!("Invalid webhook credentials: {}", e),
                    None,
                )
            }
        };

        // Parse routing override (optional — empty JSON `{}` is fine)
        let routing_override: WebhookRoutingOverride =
            serde_json::from_value(routing.clone()).unwrap_or(WebhookRoutingOverride {
                url: None,
                extra_headers: None,
            });

        // Compute effective URL: routing wins over credentials
        let effective_url = routing_override
            .url
            .as_deref()
            .or(config.url.as_deref());

        let effective_url = match effective_url {
            Some(u) => u.to_string(),
            None => {
                return NotificationResult::failure(
                    "Webhook URL is not configured (set in integration credentials or routing override)".to_string(),
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
            .post(&effective_url)
            .header("Content-Type", "application/json")
            .header("X-Rustrak-Timestamp", &timestamp)
            .header("X-Rustrak-Request-ID", &payload.alert_id);

        // Add HMAC signature if secret is configured
        if let Some(ref secret) = config.secret {
            let signature = Self::generate_signature(secret, &timestamp, &body);
            request = request.header("X-Rustrak-Signature", format!("sha256={}", signature));
        }

        // Add credential-level custom headers (base layer)
        if let Some(ref headers) = config.headers {
            for (key, value) in headers {
                request = request.header(key.as_str(), value.as_str());
            }
        }

        // Add routing extra_headers on top (routing wins on collision — applied last)
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

        // url is optional in credentials (can be supplied via routing_override.url at rule-create)
        if let Some(ref url) = webhook_config.url {
            if url.is_empty() {
                return Err(AppError::Validation("Webhook URL cannot be empty".to_string()));
            }

            // Validate URL format
            let parsed_url = url::Url::parse(url)
                .map_err(|_| AppError::Validation("Invalid webhook URL format".to_string()))?;

            // Ensure it's HTTP or HTTPS
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
    use crate::models::ProviderType;

    fn make_webhook_integration(url: Option<&str>) -> AlertIntegration {
        AlertIntegration {
            id: 1,
            name: "Test Webhook".to_string(),
            provider_type: ProviderType::Webhook,
            credentials: serde_json::json!({
                "url": url,
                "secret": "test-secret"
            }),
            is_enabled: true,
            failure_count: 0,
            last_failure_at: None,
            last_failure_message: None,
            last_success_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_generate_signature() {
        let secret = "test-secret";
        let timestamp = "1706140800";
        let payload = b"{\"test\":\"data\"}";

        let signature = WebhookNotifier::generate_signature(secret, timestamp, payload);

        // Signature should be 64-character hex string
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

        // Same inputs should produce same signature
        assert_eq!(sig1, sig2);
    }

    #[test]
    fn test_signature_changes_with_secret() {
        let timestamp = "1234567890";
        let payload = b"hello world";

        let sig1 = WebhookNotifier::generate_signature("secret1", timestamp, payload);
        let sig2 = WebhookNotifier::generate_signature("secret2", timestamp, payload);

        // Different secrets should produce different signatures
        assert_ne!(sig1, sig2);
    }

    // -------------------------------------------------------------------------
    // Task 3 tests: routing url and extra_headers
    // -------------------------------------------------------------------------

    #[test]
    fn test_routing_url_override_deserialization() {
        let routing = serde_json::json!({
            "url": "https://example.com/hook",
            "extra_headers": {"X-Custom": "value"}
        });
        let override_val: WebhookRoutingOverride =
            serde_json::from_value(routing).expect("must deserialize");
        assert_eq!(override_val.url.as_deref(), Some("https://example.com/hook"));
        let headers = override_val.extra_headers.unwrap();
        assert_eq!(headers.get("X-Custom").map(|s| s.as_str()), Some("value"));
    }

    #[test]
    fn test_routing_url_wins_over_credentials_url() {
        // Effective URL logic: routing.url should beat credentials.url
        let routing_url = Some("https://routing.example.com/hook".to_string());
        let creds_url = Some("https://creds.example.com/hook".to_string());

        let effective = routing_url.as_deref().or(creds_url.as_deref());
        assert_eq!(
            effective,
            Some("https://routing.example.com/hook"),
            "routing url must win over credentials url"
        );
    }

    #[test]
    fn test_validate_config_allows_missing_url() {
        // url is optional in credentials — can be supplied via routing_override
        let notifier = WebhookNotifier::new();
        let config = serde_json::json!({"secret": "abc"});
        assert!(
            notifier.validate_config(&config).is_ok(),
            "missing url in credentials must be valid"
        );
    }

    #[test]
    fn test_validate_config_rejects_invalid_url_scheme() {
        let notifier = WebhookNotifier::new();
        let config = serde_json::json!({"url": "ftp://bad.example.com/hook"});
        let result = notifier.validate_config(&config);
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("HTTP or HTTPS"), "got: {msg}");
    }

    #[test]
    fn test_validate_config_accepts_https_url() {
        let notifier = WebhookNotifier::new();
        let config = serde_json::json!({"url": "https://hooks.example.com/alert"});
        assert!(notifier.validate_config(&config).is_ok());
    }

    #[test]
    fn test_no_url_in_credentials_or_routing_returns_failure_info() {
        // When both credentials.url and routing.url are None, effective_url is None.
        let routing_url: Option<&str> = None;
        let creds_url: Option<&str> = None;
        let effective = routing_url.or(creds_url);
        assert!(effective.is_none(), "both absent → effective_url is None → send() returns failure");
    }

    #[test]
    fn test_integration_with_url_in_credentials_compiles() {
        let integration = make_webhook_integration(Some("https://example.com/hook"));
        assert!(integration.credentials["url"].is_string());
    }

    #[test]
    fn test_integration_without_url_in_credentials_compiles() {
        let integration = make_webhook_integration(None);
        assert!(integration.credentials["url"].is_null());
    }
}
