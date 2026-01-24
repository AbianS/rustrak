//! Webhook notification dispatcher.
//!
//! Sends alerts as HTTP POST requests with JSON payloads.
//! Supports HMAC-SHA256 signature verification for security.

use async_trait::async_trait;
use chrono::Utc;
use hmac::{Hmac, Mac};
use sha2::Sha256;

use super::{NotificationDispatcher, NotificationResult};
use crate::error::{AppError, AppResult};
use crate::models::{AlertPayload, NotificationChannel, WebhookConfig};

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
    async fn send(
        &self,
        channel: &NotificationChannel,
        payload: &AlertPayload,
    ) -> NotificationResult {
        // Parse config
        let config: WebhookConfig = match serde_json::from_value(channel.config.clone()) {
            Ok(c) => c,
            Err(e) => {
                return NotificationResult::failure(
                    format!("Invalid webhook config: {}", e),
                    None,
                )
            }
        };

        // Serialize payload
        let body = match serde_json::to_vec(payload) {
            Ok(b) => b,
            Err(e) => {
                return NotificationResult::failure(format!("Failed to serialize payload: {}", e), None)
            }
        };

        let timestamp = Utc::now().timestamp().to_string();

        // Build request
        let mut request = self
            .client
            .post(&config.url)
            .header("Content-Type", "application/json")
            .header("X-Rustrak-Timestamp", &timestamp)
            .header("X-Rustrak-Request-ID", &payload.alert_id);

        // Add HMAC signature if secret is configured
        if let Some(ref secret) = config.secret {
            let signature = Self::generate_signature(secret, &timestamp, &body);
            request = request.header("X-Rustrak-Signature", format!("sha256={}", signature));
        }

        // Add custom headers
        if let Some(ref headers) = config.headers {
            for (key, value) in headers {
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

        if webhook_config.url.is_empty() {
            return Err(AppError::Validation(
                "Webhook URL is required".to_string(),
            ));
        }

        // Validate URL format
        let parsed_url = url::Url::parse(&webhook_config.url)
            .map_err(|_| AppError::Validation("Invalid webhook URL format".to_string()))?;

        // Ensure it's HTTP or HTTPS
        if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
            return Err(AppError::Validation(
                "Webhook URL must use HTTP or HTTPS".to_string(),
            ));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
