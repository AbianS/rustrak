//! Custom Webhook notification dispatcher.
//!
//! Like [`super::webhook`], sends alerts as HTTP POST requests with JSON
//! bodies and optional HMAC-SHA256 signatures — but the body is rendered
//! from a user-supplied [Minijinja](https://docs.rs/minijinja) template with
//! the [`AlertPayload`] as context. The rendered result must be valid JSON;
//! that is what lets a single template target the fixed message schemas of
//! WeCom, DingTalk and Feishu bots, which reject foreign payloads.
//!
//! Template variables are the serialised payload fields:
//! `alert_id`, `alert_type`, `triggered_at`, `project.{id,name,slug}`,
//! `issue.{id,short_id,title,level,first_seen,last_seen,event_count}`,
//! `issue_url`, `actor`. Missing paths render as empty strings (minijinja's
//! default lenient undefined behaviour), which the JSON check then catches.
//!
//! Routing override is the same flat shape as the webhook's (SCL-1):
//! `{"url": "...", "extra_headers": {...}}`.
//! Effective URL (K5): routing.url ?? credentials.url

use async_trait::async_trait;
use chrono::Utc;

use super::webhook::WebhookNotifier;
use super::{NotificationDispatcher, NotificationResult};
use crate::error::{AppError, AppResult};
use crate::models::{AlertIntegration, AlertPayload, CustomWebhookConfig, WebhookRoutingOverride};

/// Custom webhook notification dispatcher
pub struct CustomWebhookNotifier {
    client: reqwest::Client,
}

/// Upper bound for a response body the dispatcher will buffer. Bot replies
/// are one small JSON object; the limit exists so an endpoint that answers
/// the alert POST with a giant (or endless) body cannot pin memory in the
/// notification worker.
const MAX_RESPONSE_BODY_BYTES: u64 = 64 * 1024;

impl CustomWebhookNotifier {
    /// Creates a new custom webhook notifier
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client }
    }

    /// Computes the effective URL: routing.url ?? credentials.url (K5).
    pub fn effective_url<'a>(
        routing: &'a WebhookRoutingOverride,
        credentials: &'a CustomWebhookConfig,
    ) -> Option<&'a str> {
        routing.url.as_deref().or(credentials.url.as_deref())
    }

    /// Validates a credential-level URL if present. Empty or non-http(s)
    /// URLs are rejected; absent URLs are legal because routing may supply one.
    fn validate_url(url: &Option<String>) -> AppResult<()> {
        let Some(url) = url.as_deref() else {
            return Ok(());
        };
        if url.is_empty() {
            return Err(AppError::Validation(
                "Custom webhook URL cannot be empty if provided".to_string(),
            ));
        }
        let parsed = url::Url::parse(url)
            .map_err(|_| AppError::Validation("Invalid custom webhook URL format".to_string()))?;
        if parsed.scheme() != "http" && parsed.scheme() != "https" {
            return Err(AppError::Validation(
                "Custom webhook URL must use HTTP or HTTPS".to_string(),
            ));
        }
        Ok(())
    }

    /// Renders the template against the payload and returns the normalised
    /// JSON body bytes, or a human-readable failure reason.
    fn render_body(template: &str, payload: &AlertPayload) -> Result<Vec<u8>, String> {
        let mut env = minijinja::Environment::new();
        env.add_template("body", template)
            .map_err(|e| format!("Invalid template: {e}"))?;
        let rendered = env
            .get_template("body")
            .map_err(|e| format!("Invalid template: {e}"))?
            .render(payload)
            .map_err(|e| format!("Template rendering failed: {e}"))?;
        let value: serde_json::Value = serde_json::from_str(&rendered)
            .map_err(|e| format!("Rendered template is not valid JSON: {e}"))?;
        serde_json::to_vec(&value).map_err(|e| format!("Failed to serialize payload: {e}"))
    }

    /// Reads the response body with a hard cap. `Response::text()` buffers
    /// whatever the endpoint sends, and the 30s timeout does not limit size;
    /// this dispatcher only ever needs a bot's small JSON reply, so anything
    /// past the bound is an error rather than an allocation.
    async fn read_capped_body(mut response: reqwest::Response) -> Result<String, String> {
        let mut bytes: Vec<u8> = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| format!("stream interrupted: {e}"))?
        {
            if bytes.len() + chunk.len() > MAX_RESPONSE_BODY_BYTES as usize {
                return Err(format!(
                    "response body exceeds the {MAX_RESPONSE_BODY_BYTES}-byte limit"
                ));
            }
            bytes.extend_from_slice(&chunk);
        }
        String::from_utf8(bytes).map_err(|e| format!("body is not valid UTF-8: {e}"))
    }
}

/// Whether an HTTP status counts as a delivered response (mirrors
/// `StatusCode::is_success`, evaluated from the integer the dispatcher kept).
fn response_status_is_success(status: u16) -> bool {
    (200..=299).contains(&status)
}

/// A rejection hidden inside a bot's 2xx response body, or `None`.
///
/// The platforms this provider exists for signal with `errcode` (WeCom,
/// DingTalk), `StatusCode` (Feishu legacy envelope) or a top-level `code`
/// (Feishu current envelope). An explicit platform success marker wins the
/// interpretation: a body carrying `errcode`/`StatusCode` of zero is accepted
/// without reading any generic `code`, because arbitrary APIs use that field
/// for their own business status. Bare `code` is therefore only treated as a
/// rejection when it is neither zero nor an HTTP-success echo (200..=299),
/// which covers the `{"code":200,"message":"OK"}` convention without letting
/// Feishu's 9499/11232-style failures through as successes.
fn bot_error_in_body(body: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(body).ok()?;
    for (field, reason) in [("errcode", "errmsg"), ("StatusCode", "StatusMessage")] {
        if let Some(code) = value.get(field).and_then(|v| v.as_i64()) {
            if code != 0 {
                let reason = value
                    .get(reason)
                    .and_then(|v| v.as_str())
                    .unwrap_or("rejected");
                return Some(format!("bot returned {field}={code}: {reason}"));
            }
            return None;
        }
    }
    if let Some(code) = value.get("code").and_then(|v| v.as_i64()) {
        if code != 0 && !(200..=299).contains(&code) {
            let reason = value
                .get("msg")
                .and_then(|v| v.as_str())
                .unwrap_or("rejected");
            return Some(format!("bot returned code={code}: {reason}"));
        }
    }
    None
}

impl Default for CustomWebhookNotifier {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl NotificationDispatcher for CustomWebhookNotifier {
    async fn send(
        &self,
        integration: &AlertIntegration,
        routing: &serde_json::Value,
        payload: &AlertPayload,
    ) -> NotificationResult {
        // is_enabled check FIRST (SCL-1)
        if !integration.is_enabled {
            log::debug!(
                "Skipping dispatch to disabled Custom Webhook integration {} ({})",
                integration.id,
                integration.name
            );
            return NotificationResult::success(None);
        }

        let credentials: CustomWebhookConfig =
            match serde_json::from_value(integration.credentials.clone()) {
                Ok(c) => c,
                Err(e) => {
                    return NotificationResult::failure(
                        format!("Invalid custom webhook credentials: {}", e),
                        None,
                    )
                }
            };

        let routing_override: WebhookRoutingOverride = serde_json::from_value(routing.clone())
            .unwrap_or(WebhookRoutingOverride {
                url: None,
                extra_headers: None,
            });

        let url = match Self::effective_url(&routing_override, &credentials) {
            Some(u) => u.to_string(),
            None => {
                return NotificationResult::failure(
                    "Custom webhook URL not configured in credentials or routing_override"
                        .to_string(),
                    None,
                )
            }
        };

        let body = match Self::render_body(&credentials.template, payload) {
            Ok(b) => b,
            Err(e) => return NotificationResult::failure(e, None),
        };

        let timestamp = Utc::now().timestamp().to_string();

        let mut request = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("X-Rustrak-Timestamp", &timestamp)
            .header("X-Rustrak-Request-ID", &payload.alert_id);

        if let Some(ref secret) = credentials.secret {
            let signature = WebhookNotifier::generate_signature(secret, &timestamp, &body);
            request = request.header("X-Rustrak-Signature", format!("sha256={}", signature));
        }

        // Credential-level headers, then routing-level extras on top
        // (same precedence as the plain webhook dispatcher).
        for headers in [&credentials.headers, &routing_override.extra_headers]
            .into_iter()
            .flatten()
        {
            for (key, value) in headers {
                request = request.header(key.as_str(), value.as_str());
            }
        }

        match request.body(body).send().await {
            Ok(response) => {
                let status = response.status().as_u16();
                // A body that cannot be read (truncated, oversized past
                // MAX_RESPONSE_BODY_BYTES, non-UTF-8) is a failure on every
                // status: on a 2xx we would otherwise record a delivery as
                // sent while unable to see a bot rejection hidden inside it.
                let error_body = match Self::read_capped_body(response).await {
                    Ok(b) => b,
                    Err(e) => {
                        return NotificationResult::failure(
                            format!("HTTP {status}: failed to read response body: {e}"),
                            Some(status),
                        );
                    }
                };
                if !response_status_is_success(status) {
                    let error_msg = if error_body.is_empty() {
                        format!("HTTP {}", status)
                    } else {
                        format!("HTTP {}: {}", status, error_body)
                    };
                    return NotificationResult::failure(error_msg, Some(status));
                }
                // WeCom, DingTalk and Feishu group bots answer 200 even for a
                // rejected message, carrying the real result in the body. A
                // delivery that only checked the status would look sent. The
                // field names below are specific to those platforms' bot APIs,
                // so an arbitrary endpoint that ignores the payload and returns
                // `200` with an unrelated body is still treated as success.
                if let Some(rejection) = bot_error_in_body(&error_body) {
                    return NotificationResult::failure(
                        format!("HTTP {}: {}", status, rejection),
                        Some(status),
                    );
                }
                NotificationResult::success(Some(status))
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
        let config: CustomWebhookConfig = serde_json::from_value(config.clone())
            .map_err(|e| AppError::Validation(format!("Invalid custom webhook config: {}", e)))?;

        Self::validate_url(&config.url)?;

        if config.template.trim().is_empty() {
            return Err(AppError::Validation("Template cannot be empty".to_string()));
        }

        // Compile check: surface syntax errors at save time, not delivery time.
        let mut env = minijinja::Environment::new();
        env.add_template("body", &config.template)
            .map_err(|e| AppError::Validation(format!("Invalid template syntax: {}", e)))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{IssueInfo, ProjectInfo};
    use serde_json::json;

    fn make_config(template: &str, url: Option<&str>) -> serde_json::Value {
        json!({
            "url": url,
            "template": template,
        })
    }

    fn make_integration(credentials: serde_json::Value, is_enabled: bool) -> AlertIntegration {
        AlertIntegration {
            id: 4,
            name: "Test Custom Webhook".to_string(),
            provider_type: crate::models::ProviderType::CustomWebhook,
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

    fn create_test_payload() -> AlertPayload {
        AlertPayload {
            alert_id: "test-123".to_string(),
            alert_type: "new_issue".to_string(),
            triggered_at: Utc::now(),
            project: ProjectInfo {
                id: 1,
                name: "Test Project".to_string(),
                slug: "test-project".to_string(),
            },
            issue: IssueInfo {
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

    // -------------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------------

    #[test]
    fn test_render_dingtalk_style_template() {
        let template = r#"{"msgtype":"text","text":{"content":"Rustrak: {{ issue.title }} ({{ issue.short_id }}) in {{ project.name }}"}}"#;
        let body = CustomWebhookNotifier::render_body(template, &create_test_payload())
            .expect("dingtalk text template must render to valid JSON");
        let parsed: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(parsed["msgtype"], "text");
        assert_eq!(
            parsed["text"]["content"],
            "Rustrak: Test error (TEST-1) in Test Project"
        );
    }

    #[test]
    fn test_render_wecom_markdown_template_with_url_field() {
        let template = r#"{"msgtype":"markdown","markdown":{"content":"**{{ issue.title }}** {{ issue_url }}"}}"#;
        let body = CustomWebhookNotifier::render_body(template, &create_test_payload())
            .expect("wecom markdown template must render");
        let parsed: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(
            parsed["markdown"]["content"],
            "**Test error** https://example.com/issues/abc-123"
        );
    }

    #[test]
    fn test_render_result_is_normalised_valid_json() {
        let template = r#"{ "a" : 1, "b" : "{{ project.slug }}" }"#;
        let body =
            CustomWebhookNotifier::render_body(template, &create_test_payload()).expect("renders");
        // Normalised: serde re-serialisation drops the whitespace.
        assert_eq!(
            String::from_utf8(body).unwrap(),
            r#"{"a":1,"b":"test-project"}"#
        );
    }

    #[test]
    fn test_render_string_interpolation_can_break_json_and_is_reported() {
        // A title containing a quote is only safe via | tojson; without it the
        // rendered body is invalid JSON and the failure is surfaced, not sent.
        let payload = AlertPayload {
            issue: IssueInfo {
                title: r#"He said "boom""#.to_string(),
                ..create_test_payload().issue
            },
            ..create_test_payload()
        };
        let template = r#"{"msgtype":"text","text":{"content":"{{ issue.title }}"}}"#;
        let err = CustomWebhookNotifier::render_body(template, &payload)
            .expect_err("raw interpolation of a quoted title must fail JSON validation");
        assert!(err.contains("not valid JSON"), "got: {err}");
    }

    #[test]
    fn test_tojson_filter_quotes_strings() {
        let payload = AlertPayload {
            issue: IssueInfo {
                title: r#"He said "boom""#.to_string(),
                ..create_test_payload().issue
            },
            ..create_test_payload()
        };
        let template = r#"{"content":{{ issue.title | tojson }}}"#;
        let body = CustomWebhookNotifier::render_body(template, &payload).expect("tojson renders");
        let parsed: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(parsed["content"], r#"He said "boom""#);
    }

    #[test]
    fn test_undefined_variable_renders_empty_and_fails_json_when_bare() {
        // Lenient undefined behaviour: {{ nope }} becomes "". Bare in a JSON
        // value position that is invalid — which is exactly the safety net.
        let template = r#"{"a": {{ nope }}}"#;
        let err = CustomWebhookNotifier::render_body(template, &create_test_payload())
            .expect_err("bare undefined interpolation is not valid JSON");
        assert!(err.contains("not valid JSON"), "got: {err}");
    }

    // -------------------------------------------------------------------------
    // Bot rejection hidden in a 2xx body
    // -------------------------------------------------------------------------

    #[test]
    fn test_status_is_success_matches_2xx() {
        assert!(response_status_is_success(200));
        assert!(response_status_is_success(204));
        assert!(!response_status_is_success(301));
        assert!(!response_status_is_success(500));
    }

    #[test]
    fn test_wecom_dingtalk_errcode_detected() {
        assert!(bot_error_in_body(r#"{"errcode":0,"errmsg":"ok"}"#).is_none());
        assert!(
            bot_error_in_body(r#"{"errcode":93000,"errmsg":"invalid webhook url"}"#)
                .unwrap()
                .contains("93000")
        );
    }

    #[test]
    fn test_feishu_statuscode_detected() {
        assert!(bot_error_in_body(r#"{"StatusCode":0,"StatusMessage":"success"}"#).is_none());
        let msg = bot_error_in_body(r#"{"StatusCode":9499,"StatusMessage":"Bad Request"}"#)
            .expect("non-zero StatusCode is a rejection");
        assert!(msg.contains("StatusCode=9499"), "got: {msg}");
        assert!(msg.contains("Bad Request"), "got: {msg}");
    }

    #[test]
    fn test_non_bot_bodies_are_not_misread_as_rejection() {
        // A generic endpoint returning 200 with unrelated content stays success:
        // not JSON, or JSON without the platform-specific codes.
        assert!(bot_error_in_body("").is_none());
        assert!(bot_error_in_body("ok").is_none());
        assert!(bot_error_in_body(r#"{"status":"queued"}"#).is_none());
        assert!(bot_error_in_body(r#"{"errcode":0,"code":42}"#).is_none());
    }

    #[test]
    fn test_feishu_current_envelope_code_detected() {
        // Feishu's newer envelope signals only through the top-level `code`.
        let msg = bot_error_in_body(r#"{"code":11232,"msg":"trigger frequency limit","data":{}}"#)
            .expect("non-zero code without a platform success marker is a rejection");
        assert!(msg.contains("code=11232"), "got: {msg}");
        assert!(msg.contains("frequency"), "got: {msg}");
        assert!(bot_error_in_body(r#"{"code":0,"msg":"success","data":{}}"#).is_none());
    }

    #[test]
    fn test_http_echo_code_is_not_a_rejection() {
        // Generic APIs reuse `code` for an echoed HTTP status; 2xx means OK
        // there, so the band must not read as a bot failure.
        assert!(bot_error_in_body(r#"{"code":200,"message":"OK"}"#).is_none());
        assert!(bot_error_in_body(r#"{"code":204}"#).is_none());
    }

    // -------------------------------------------------------------------------
    // Built-in presets (must stay in sync with
    // apps/webview-ui/src/features/alert/model/webhook-presets.ts)
    // -------------------------------------------------------------------------

    const PRESET_WECOM_TEXT: &str = r#"{"msgtype":"text","text":{"content":{{ ("Rustrak: " ~ issue.title ~ " (" ~ issue.short_id ~ ") " ~ issue_url) | tojson }}}}"#;

    // Split because a raw string cannot end with `("`: that quote would fuse
    // with the closing hashes. The head is a normal escaped string, the tail
    // needs r#### so the `"###` heading survives inside it.
    const PRESET_WECOM_MARKDOWN: &str = concat!(
        "{\"msgtype\":\"markdown\",\"markdown\":{\"content\":{{ (\"",
        r####"### " ~ issue.title ~ "\n> Project: " ~ project.name ~ "\n> Level: " ~ issue.level ~ "\n> [View issue](" ~ issue_url ~ ")") | tojson }}}}"####,
    );

    const PRESET_DINGTALK_TEXT: &str = PRESET_WECOM_TEXT;

    const PRESET_FEISHU_TEXT: &str = r#"{"msg_type":"text","content":{"text":{{ ("Rustrak: " ~ issue.title ~ " (" ~ issue.short_id ~ ") " ~ issue_url) | tojson }}}}"#;

    // The dashboard's textarea placeholder
    // (webhook-presets.ts `templatePlaceholder`); mirrored so a copy that
    // would teach users an invalid template fails this test instead.
    const PLACEHOLDER_EXAMPLE: &str =
        r#"{"msgtype":"text","text":{"content":{{ ("Rustrak: " ~ issue.title) | tojson }}}}"#;

    #[test]
    fn test_placeholder_example_renders_valid_json() {
        let parsed: serde_json::Value = serde_json::from_slice(
            &CustomWebhookNotifier::render_body(PLACEHOLDER_EXAMPLE, &create_test_payload())
                .expect("placeholder example must render to valid JSON"),
        )
        .unwrap();
        assert_eq!(parsed["text"]["content"], "Rustrak: Test error");
    }

    #[test]
    fn test_preset_wecom_text_renders_valid_schema() {
        let parsed: serde_json::Value = serde_json::from_slice(
            &CustomWebhookNotifier::render_body(PRESET_WECOM_TEXT, &create_test_payload())
                .expect("wecom text preset must render"),
        )
        .unwrap();
        assert_eq!(parsed["msgtype"], "text");
        assert_eq!(
            parsed["text"]["content"],
            "Rustrak: Test error (TEST-1) https://example.com/issues/abc-123"
        );
    }

    #[test]
    fn test_preset_markdown_renders_newlines_as_escapes() {
        let parsed: serde_json::Value = serde_json::from_slice(
            &CustomWebhookNotifier::render_body(PRESET_WECOM_MARKDOWN, &create_test_payload())
                .expect("wecom markdown preset must render"),
        )
        .unwrap();
        let content = parsed["markdown"]["content"].as_str().unwrap();
        assert!(
            content.contains('\n'),
            "minijinja must unescape \\n so the JSON carries a real newline, got: {content:?}"
        );
        assert!(content.starts_with("### Test error"), "got: {content:?}");
    }

    #[test]
    fn test_preset_feishu_text_renders_valid_schema() {
        let parsed: serde_json::Value = serde_json::from_slice(
            &CustomWebhookNotifier::render_body(PRESET_FEISHU_TEXT, &create_test_payload())
                .expect("feishu text preset must render"),
        )
        .unwrap();
        assert_eq!(parsed["msg_type"], "text");
        assert!(parsed["content"]["text"]
            .as_str()
            .unwrap()
            .starts_with("Rustrak: Test error (TEST-1)"));
    }

    #[test]
    fn test_preset_dingtalk_survives_quotes_in_title() {
        let payload = AlertPayload {
            issue: IssueInfo {
                title: r#"He said "boom""#.to_string(),
                ..create_test_payload().issue
            },
            ..create_test_payload()
        };
        let parsed: serde_json::Value = serde_json::from_slice(
            &CustomWebhookNotifier::render_body(PRESET_DINGTALK_TEXT, &payload)
                .expect("tojson-escaped preset must survive a quoted title"),
        )
        .unwrap();
        assert_eq!(
            parsed["text"]["content"],
            r#"Rustrak: He said "boom" (TEST-1) https://example.com/issues/abc-123"#
        );
    }

    // -------------------------------------------------------------------------
    // validate_config
    // -------------------------------------------------------------------------

    #[test]
    fn test_validate_accepts_valid_config() {
        let notifier = CustomWebhookNotifier::new();
        let config = make_config(
            r#"{"msgtype":"text","text":{"content":"{{ issue.title }}"}}"#,
            Some("https://example.com/hook"),
        );
        notifier
            .validate_config(&config)
            .expect("valid config must pass");
    }

    #[test]
    fn test_validate_rejects_empty_template() {
        let notifier = CustomWebhookNotifier::new();
        let err = notifier
            .validate_config(&make_config("   ", Some("https://example.com/hook")))
            .expect_err("blank template must be rejected");
        assert!(err.to_string().contains("Template cannot be empty"));
    }

    #[test]
    fn test_validate_rejects_template_syntax_error() {
        let notifier = CustomWebhookNotifier::new();
        let err = notifier
            .validate_config(&make_config("{% for x in %}", None))
            .expect_err("syntax error must be caught at save time");
        assert!(err.to_string().contains("Invalid template syntax"));
    }

    #[test]
    fn test_validate_requires_template_field() {
        let notifier = CustomWebhookNotifier::new();
        let err = notifier
            .validate_config(&json!({"url": "https://example.com/hook"}))
            .expect_err("missing template field must be rejected");
        assert!(err.to_string().contains("Invalid custom webhook config"));
    }

    #[test]
    fn test_validate_rejects_non_http_url() {
        let notifier = CustomWebhookNotifier::new();
        let err = notifier
            .validate_config(&make_config("{}", Some("ftp://example.com/hook")))
            .expect_err("ftp url must be rejected");
        assert!(err.to_string().contains("HTTP or HTTPS"));
    }

    #[test]
    fn test_validate_allows_missing_url_for_routing_override() {
        let notifier = CustomWebhookNotifier::new();
        notifier
            .validate_config(&make_config(r#"{"a":1}"#, None))
            .expect("url is optional like the plain webhook");
    }

    // -------------------------------------------------------------------------
    // effective_url and dispatch guards
    // -------------------------------------------------------------------------

    #[test]
    fn test_effective_url_routing_wins_over_credentials() {
        let routing = WebhookRoutingOverride {
            url: Some("https://routing.example.com/hook".to_string()),
            extra_headers: None,
        };
        let credentials = CustomWebhookConfig {
            url: Some("https://creds.example.com/hook".to_string()),
            secret: None,
            headers: None,
            template: "{}".to_string(),
        };
        assert_eq!(
            CustomWebhookNotifier::effective_url(&routing, &credentials),
            Some("https://routing.example.com/hook")
        );
    }

    #[test]
    fn test_effective_url_none_when_both_absent() {
        let routing = WebhookRoutingOverride {
            url: None,
            extra_headers: None,
        };
        let credentials = CustomWebhookConfig {
            url: None,
            secret: None,
            headers: None,
            template: "{}".to_string(),
        };
        assert_eq!(
            CustomWebhookNotifier::effective_url(&routing, &credentials),
            None
        );
    }

    #[tokio::test]
    async fn test_disabled_integration_skipped() {
        let notifier = CustomWebhookNotifier::new();
        let integration =
            make_integration(make_config("{}", Some("https://example.com/hook")), false);
        let result = notifier
            .send(&integration, &json!({}), &create_test_payload())
            .await;
        assert!(result.success, "disabled integration must skip");
    }

    #[tokio::test]
    async fn test_missing_url_fails_before_render() {
        let notifier = CustomWebhookNotifier::new();
        let integration = make_integration(make_config("{% invalid", None), true);
        let result = notifier
            .send(&integration, &json!({}), &create_test_payload())
            .await;
        assert!(!result.success);
        assert!(result
            .error_message
            .unwrap_or_default()
            .contains("URL not configured"));
    }

    #[tokio::test]
    async fn test_render_failure_is_reported_not_sent() {
        let notifier = CustomWebhookNotifier::new();
        let integration = make_integration(
            make_config(
                r#"{"broken": {{ nope }}}"#,
                Some("https://127.0.0.1:1/hook"),
            ),
            true,
        );
        let result = notifier
            .send(&integration, &json!({}), &create_test_payload())
            .await;
        assert!(!result.success);
        assert!(result
            .error_message
            .unwrap_or_default()
            .contains("not valid JSON"));
    }

    #[tokio::test]
    async fn test_delivers_rendered_body_over_http() {
        // Full network path: a listener that reads the request, replies 200,
        // and hands the raw bytes back for assertion.
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind delivery listener");
        let addr = listener.local_addr().expect("listener addr");

        let (tx, rx) = tokio::sync::oneshot::channel::<String>();
        tokio::spawn(async move {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let (mut socket, _) = listener.accept().await.expect("accept");
            let mut buf = Vec::new();
            let mut chunk = [0u8; 1024];
            // Read until the rendered marker has arrived (well under the
            // request head's own size, so one or two reads suffice).
            while !String::from_utf8_lossy(&buf).contains("Rustrak: Test error") {
                let n = socket.read(&mut chunk).await.expect("read request");
                if n == 0 {
                    break;
                }
                buf.extend_from_slice(&chunk[..n]);
            }
            let _ = socket
                .write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 0\r\nconnection: close\r\n\r\n")
                .await;
            let _ = tx.send(String::from_utf8_lossy(&buf).to_string());
        });

        let notifier = CustomWebhookNotifier::new();
        let credentials = json!({
            "url": format!("http://{addr}/hook"),
            "secret": "s3cret",
            "headers": {"X-Custom": "cred-level"},
            "template": PRESET_DINGTALK_TEXT,
        });
        let integration = make_integration(credentials, true);
        let routing = json!({"extra_headers": {"X-Extra": "route-level"}});

        let result = notifier
            .send(&integration, &routing, &create_test_payload())
            .await;
        assert!(
            result.success,
            "delivery must succeed: {:?}",
            result.error_message
        );
        assert_eq!(result.http_status, Some(200));

        let raw = rx.await.expect("listener captured a request");
        // Rendered JSON body, not the raw AlertPayload.
        assert!(raw.contains(r#""msgtype":"text""#), "got: {raw}");
        assert!(raw.contains("Rustrak: Test error (TEST-1)"), "got: {raw}");
        assert!(!raw.contains("alert_type"), "raw payload must not be sent");
        // Headers: HMAC signature, both custom levels, standard metadata.
        let lower = raw.to_ascii_lowercase();
        assert!(lower.contains("x-rustrak-signature: sha256="), "got: {raw}");
        assert!(lower.contains("x-custom: cred-level"), "got: {raw}");
        assert!(lower.contains("x-extra: route-level"), "got: {raw}");
        assert!(
            lower.contains("x-rustrak-request-id: test-123"),
            "got: {raw}"
        );
    }

    #[tokio::test]
    async fn test_200_with_errcode_body_is_a_failure() {
        // The core of the greptile P1: a WeCom/DingTalk rejection rides on a
        // 200 response. The dispatcher must not record it as sent.
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind rejection listener");
        let addr = listener.local_addr().expect("listener addr");
        tokio::spawn(async move {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let (mut socket, _) = listener.accept().await.expect("accept");
            let mut sink = [0u8; 1024];
            let _ = socket.read(&mut sink).await;
            let body = r#"{"errcode":93000,"errmsg":"invalid webhook url"}"#;
            let resp = format!(
                "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                body.len()
            );
            let _ = socket.write_all(resp.as_bytes()).await;
        });

        let notifier = CustomWebhookNotifier::new();
        let credentials = json!({
            "url": format!("http://{addr}/hook"),
            "template": r#"{"msgtype":"text","text":{"content":"hi"}}"#,
        });
        let integration = make_integration(credentials, true);
        let result = notifier
            .send(&integration, &json!({}), &create_test_payload())
            .await;
        assert!(!result.success, "a 200 that hides errcode!=0 is a failure");
        assert_eq!(result.http_status, Some(200));
        assert!(
            result
                .error_message
                .unwrap_or_default()
                .contains("errcode=93000"),
            "message should carry the bot code"
        );
    }

    /// Serves a fixed raw HTTP response (after reading one request chunk) on
    /// a random localhost port; returns the URL. The responder task owns the
    /// bytes, so callers can build responses at runtime.
    async fn raw_responder(response: Vec<u8>) -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind responder listener");
        let addr = listener.local_addr().expect("listener addr");
        tokio::spawn(async move {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let (mut socket, _) = listener.accept().await.expect("accept");
            let mut sink = [0u8; 1024];
            let _ = socket.read(&mut sink).await;
            let _ = socket.write_all(&response).await;
            let _ = socket.flush().await;
        });
        format!("http://{addr}/hook")
    }

    fn custom_integration(url: String) -> AlertIntegration {
        make_integration(
            json!({
                "url": url,
                "template": r#"{"msgtype":"text","text":{"content":"hi"}}"#,
            }),
            true,
        )
    }

    #[tokio::test]
    async fn test_feishu_current_envelope_fails_live_delivery() {
        let body = r#"{"code":9499,"msg":"Bad Request","data":{}}"#;
        let response = format!(
            "HTTP/1.1 200 OK
content-type: application/json
content-length: {}
connection: close

{body}",
            body.len()
        );
        let url = raw_responder(response.into_bytes()).await;
        let notifier = CustomWebhookNotifier::new();
        let result = notifier
            .send(&custom_integration(url), &json!({}), &create_test_payload())
            .await;
        assert!(
            !result.success,
            "Feishu 200+code rejection must not record sent"
        );
        assert!(result
            .error_message
            .unwrap_or_default()
            .contains("code=9499"));
    }

    #[tokio::test]
    async fn test_oversized_response_body_is_a_failure() {
        let big = vec![b'x'; (MAX_RESPONSE_BODY_BYTES as usize) + 4096];
        let head = format!(
            "HTTP/1.1 200 OK
content-type: text/plain
content-length: {}
connection: close

",
            big.len()
        );
        let mut response = head.into_bytes();
        response.extend_from_slice(&big);
        let url = raw_responder(response.to_vec()).await;
        let notifier = CustomWebhookNotifier::new();
        let result = notifier
            .send(&custom_integration(url), &json!({}), &create_test_payload())
            .await;
        assert!(
            !result.success,
            "a body past the limit must fail rather than buffer"
        );
        assert!(result
            .error_message
            .unwrap_or_default()
            .contains("failed to read response body"));
    }

    #[tokio::test]
    async fn test_truncated_response_body_is_a_failure() {
        // Declares 200 bytes, sends 10, then closes: `text()` errors, and a
        // 2xx whose body cannot be inspected must not read as delivered.
        let response = b"HTTP/1.1 200 OK
content-length: 200
connection: close

truncated!";
        let url = raw_responder(response.to_vec()).await;
        let notifier = CustomWebhookNotifier::new();
        let result = notifier
            .send(&custom_integration(url), &json!({}), &create_test_payload())
            .await;
        assert!(!result.success, "an unreadable 200 body is a failure");
        assert_eq!(result.http_status, Some(200));
        assert!(result
            .error_message
            .unwrap_or_default()
            .contains("failed to read response body"));
    }
}
