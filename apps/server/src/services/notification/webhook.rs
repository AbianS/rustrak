//! Webhook notification dispatcher.
//!
//! Sends alerts as HTTP POST requests with JSON payloads.
//! Supports HMAC-SHA256 signature verification for security.

use async_trait::async_trait;
use chrono::Utc;
use hmac::{Hmac, KeyInit, Mac};
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
                return NotificationResult::failure(format!("Invalid webhook config: {}", e), None)
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
            return Err(AppError::Validation("Webhook URL is required".to_string()));
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

        // Block SSRF: reject private/internal hosts (H-4)
        if let Some(host) = parsed_url.host() {
            if is_ssrf_blocked_url_host(&host) {
                return Err(AppError::Validation(
                    "Webhook URL must not target internal or private addresses".to_string(),
                ));
            }
        }

        Ok(())
    }
}

/// Returns true if the `url::Host` is a private/internal address that could enable SSRF.
fn is_ssrf_blocked_url_host(host: &url::Host<&str>) -> bool {
    match host {
        url::Host::Ipv4(ip) => is_private_ipv4(*ip),
        url::Host::Ipv6(ip) => is_private_ipv6(*ip),
        url::Host::Domain(name) => is_blocked_hostname(name),
    }
}

fn is_blocked_hostname(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower == "localhost"
        || lower == "ip6-localhost"
        || lower == "ip6-loopback"
        || lower.ends_with(".local")
        || lower.ends_with(".internal")
}

fn is_private_ip(ip: std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(v4) => is_private_ipv4(v4),
        std::net::IpAddr::V6(v6) => is_private_ipv6(v6),
    }
}

fn is_private_ipv4(ip: std::net::Ipv4Addr) -> bool {
    let octets = ip.octets();
    // 127.0.0.0/8 — loopback
    if octets[0] == 127 {
        return true;
    }
    // 0.0.0.0/8
    if octets[0] == 0 {
        return true;
    }
    // 10.0.0.0/8 — private class A
    if octets[0] == 10 {
        return true;
    }
    // 172.16.0.0/12 — private class B (172.16.x.x – 172.31.x.x)
    if octets[0] == 172 && (16..=31).contains(&octets[1]) {
        return true;
    }
    // 192.168.0.0/16 — private class C
    if octets[0] == 192 && octets[1] == 168 {
        return true;
    }
    // 169.254.0.0/16 — link-local (AWS/GCP metadata endpoint)
    if octets[0] == 169 && octets[1] == 254 {
        return true;
    }
    false
}

fn is_private_ipv6(ip: std::net::Ipv6Addr) -> bool {
    let segments = ip.segments();
    // ::1 — loopback
    if ip == std::net::Ipv6Addr::LOCALHOST {
        return true;
    }
    // fc00::/7 — unique local (fc00:: – fdff::)
    if segments[0] & 0xFE00 == 0xFC00 {
        return true;
    }
    // fe80::/10 — link-local
    if segments[0] & 0xFFC0 == 0xFE80 {
        return true;
    }
    // ::ffff:0:0/96 — IPv4-mapped IPv6 (check the embedded IPv4)
    if let Some(v4) = ip.to_ipv4_mapped() {
        return is_private_ipv4(v4);
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    // =============================================================================
    // SSRF Prevention Tests (H-4)
    // =============================================================================

    fn make_webhook_config(url: &str) -> serde_json::Value {
        serde_json::json!({"url": url, "secret": null})
    }

    #[test]
    fn test_rejects_loopback_ipv4() {
        let notifier = WebhookNotifier::new();
        assert!(notifier
            .validate_config(&make_webhook_config("http://127.0.0.1/hook"))
            .is_err());
        assert!(notifier
            .validate_config(&make_webhook_config("http://127.1.2.3/hook"))
            .is_err());
    }

    #[test]
    fn test_rejects_localhost_hostname() {
        let notifier = WebhookNotifier::new();
        assert!(notifier
            .validate_config(&make_webhook_config("http://localhost/hook"))
            .is_err());
        assert!(notifier
            .validate_config(&make_webhook_config("https://LOCALHOST/hook"))
            .is_err());
    }

    #[test]
    fn test_rejects_rfc1918_addresses() {
        let notifier = WebhookNotifier::new();
        assert!(notifier
            .validate_config(&make_webhook_config("http://10.0.0.1/hook"))
            .is_err());
        assert!(notifier
            .validate_config(&make_webhook_config("http://10.255.255.255/hook"))
            .is_err());
        assert!(notifier
            .validate_config(&make_webhook_config("http://172.16.0.1/hook"))
            .is_err());
        assert!(notifier
            .validate_config(&make_webhook_config("http://172.31.255.255/hook"))
            .is_err());
        assert!(notifier
            .validate_config(&make_webhook_config("http://192.168.0.1/hook"))
            .is_err());
        assert!(notifier
            .validate_config(&make_webhook_config("http://192.168.255.255/hook"))
            .is_err());
    }

    #[test]
    fn test_rejects_aws_metadata_ip() {
        let notifier = WebhookNotifier::new();
        assert!(notifier
            .validate_config(&make_webhook_config(
                "http://169.254.169.254/latest/meta-data/"
            ))
            .is_err());
        assert!(notifier
            .validate_config(&make_webhook_config("http://169.254.0.1/"))
            .is_err());
    }

    #[test]
    fn test_rejects_ipv6_loopback() {
        let notifier = WebhookNotifier::new();
        assert!(notifier
            .validate_config(&make_webhook_config("http://[::1]/hook"))
            .is_err());
    }

    #[test]
    fn test_accepts_public_urls() {
        let notifier = WebhookNotifier::new();
        assert!(notifier
            .validate_config(&make_webhook_config("https://hooks.example.com/webhook"))
            .is_ok());
        assert!(notifier
            .validate_config(&make_webhook_config(
                "https://discord.com/api/webhooks/123/abc"
            ))
            .is_ok());
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
}
