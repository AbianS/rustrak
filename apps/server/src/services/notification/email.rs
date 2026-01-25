//! Email notification dispatcher.
//!
//! Sends alerts via SMTP using the lettre crate.
//! Supports both plain text and HTML email formats.

use async_trait::async_trait;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use super::{NotificationDispatcher, NotificationResult};
use crate::error::{AppError, AppResult};
use crate::models::{AlertPayload, EmailConfig, NotificationChannel};

/// Email notification dispatcher
pub struct EmailNotifier {
    // Global SMTP configuration (fallback if channel doesn't specify)
    global_smtp_host: Option<String>,
    global_smtp_port: u16,
    global_smtp_username: Option<String>,
    global_smtp_password: Option<String>,
    global_from_address: String,
}

impl EmailNotifier {
    /// Creates a new email notifier with global SMTP settings from environment
    pub fn new() -> Self {
        Self {
            global_smtp_host: std::env::var("SMTP_HOST").ok(),
            global_smtp_port: std::env::var("SMTP_PORT")
                .unwrap_or_else(|_| "587".to_string())
                .parse()
                .unwrap_or(587),
            global_smtp_username: std::env::var("SMTP_USERNAME").ok(),
            global_smtp_password: std::env::var("SMTP_PASSWORD").ok(),
            global_from_address: std::env::var("SMTP_FROM")
                .unwrap_or_else(|_| "alerts@rustrak.local".to_string()),
        }
    }

    /// Formats an alert as HTML email body
    fn format_html(payload: &AlertPayload) -> String {
        let level_color = match payload.issue.level.as_deref() {
            Some("fatal") => "#dc2626",
            Some("error") => "#ef4444",
            Some("warning") => "#f59e0b",
            Some("info") => "#3b82f6",
            _ => "#6b7280",
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

        format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background-color: {level_color}; padding: 16px 24px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">
                {alert_type_display} in {project_name}
            </h1>
        </div>
        <div style="padding: 24px;">
            <h2 style="margin: 0 0 8px 0; font-size: 16px; color: #111827;">
                <a href="{issue_url}" style="color: #2563eb; text-decoration: none;">
                    {short_id}
                </a>
            </h2>
            <p style="margin: 0 0 24px 0; font-size: 14px; color: #374151; line-height: 1.5;">
                {title}
            </p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                    <td style="padding: 8px 0; color: #6b7280; border-top: 1px solid #e5e7eb;">Events</td>
                    <td style="padding: 8px 0; color: #111827; border-top: 1px solid #e5e7eb; text-align: right;">{event_count}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280; border-top: 1px solid #e5e7eb;">First seen</td>
                    <td style="padding: 8px 0; color: #111827; border-top: 1px solid #e5e7eb; text-align: right;">{first_seen}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280; border-top: 1px solid #e5e7eb;">Last seen</td>
                    <td style="padding: 8px 0; color: #111827; border-top: 1px solid #e5e7eb; text-align: right;">{last_seen}</td>
                </tr>
            </table>
            <div style="margin-top: 24px;">
                <a href="{issue_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
                    View Issue
                </a>
            </div>
        </div>
        <div style="padding: 16px 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
                This alert was sent by Rustrak for project {project_name}.
            </p>
        </div>
    </div>
</body>
</html>"#,
            level_color = level_color,
            alert_type_display = alert_type_display,
            project_name = html_escape(&payload.project.name),
            issue_url = &payload.issue_url,
            short_id = html_escape(&payload.issue.short_id),
            title = html_escape(&payload.issue.title),
            event_count = payload.issue.event_count,
            first_seen = payload.issue.first_seen.format("%Y-%m-%d %H:%M UTC"),
            last_seen = payload.issue.last_seen.format("%Y-%m-%d %H:%M UTC"),
        )
    }

    /// Formats an alert as plain text email body
    fn format_text(payload: &AlertPayload) -> String {
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

        format!(
            r#"{alert_type_display} in {project_name}

{short_id}: {title}

Events: {event_count}
First seen: {first_seen}
Last seen: {last_seen}

View issue: {issue_url}

--
This alert was sent by Rustrak for project {project_name}."#,
            alert_type_display = alert_type_display,
            project_name = &payload.project.name,
            short_id = &payload.issue.short_id,
            title = &payload.issue.title,
            event_count = payload.issue.event_count,
            first_seen = payload.issue.first_seen.format("%Y-%m-%d %H:%M UTC"),
            last_seen = payload.issue.last_seen.format("%Y-%m-%d %H:%M UTC"),
            issue_url = &payload.issue_url,
        )
    }
}

impl Default for EmailNotifier {
    fn default() -> Self {
        Self::new()
    }
}

/// Simple HTML escaping for email content
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[async_trait]
impl NotificationDispatcher for EmailNotifier {
    async fn send(
        &self,
        channel: &NotificationChannel,
        payload: &AlertPayload,
    ) -> NotificationResult {
        // Parse config
        let config: EmailConfig = match serde_json::from_value(channel.config.clone()) {
            Ok(c) => c,
            Err(e) => {
                return NotificationResult::failure(format!("Invalid email config: {}", e), None)
            }
        };

        // Determine SMTP settings (channel config overrides global)
        let smtp_host = config.smtp_host.as_ref().or(self.global_smtp_host.as_ref());
        let smtp_host = match smtp_host {
            Some(h) => h,
            None => {
                return NotificationResult::failure("SMTP host not configured".to_string(), None)
            }
        };

        let smtp_port = config.smtp_port.unwrap_or(self.global_smtp_port);
        let from_address = config
            .from_address
            .as_ref()
            .unwrap_or(&self.global_from_address);

        // Build email subject
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

        let subject = format!(
            "[{}] {} - {}",
            payload.project.name, alert_type_display, payload.issue.short_id
        );

        // Build HTML and text bodies
        let html_body = Self::format_html(payload);
        let text_body = Self::format_text(payload);

        // Send to each recipient
        let mut sent_any = false;
        for recipient in &config.recipients {
            // Build email message
            let email = match Message::builder()
                .from(
                    from_address
                        .parse()
                        .unwrap_or_else(|_| "alerts@rustrak.local".parse().unwrap()),
                )
                .to(match recipient.parse() {
                    Ok(addr) => addr,
                    Err(_) => {
                        log::warn!("Invalid email recipient: {}", recipient);
                        continue;
                    }
                })
                .subject(&subject)
                .multipart(
                    lettre::message::MultiPart::alternative()
                        .singlepart(
                            lettre::message::SinglePart::builder()
                                .header(ContentType::TEXT_PLAIN)
                                .body(text_body.clone()),
                        )
                        .singlepart(
                            lettre::message::SinglePart::builder()
                                .header(ContentType::TEXT_HTML)
                                .body(html_body.clone()),
                        ),
                ) {
                Ok(email) => email,
                Err(e) => {
                    return NotificationResult::failure(
                        format!("Failed to build email: {}", e),
                        None,
                    )
                }
            };

            // Build SMTP transport
            // Port 465 = implicit TLS (SMTPS), Port 587 = STARTTLS
            let mailer_builder = if smtp_port == 465 {
                // Use implicit TLS for port 465
                // Build TLS parameters first to handle errors gracefully
                let tls_params = match lettre::transport::smtp::client::TlsParameters::new(
                    smtp_host.to_string(),
                ) {
                    Ok(p) => p,
                    Err(e) => {
                        return NotificationResult::failure(
                            format!("Invalid TLS parameters for SMTP host: {}", e),
                            None,
                        )
                    }
                };

                AsyncSmtpTransport::<Tokio1Executor>::relay(smtp_host)
                    .map(|b| {
                        b.port(smtp_port)
                            .tls(lettre::transport::smtp::client::Tls::Wrapper(tls_params))
                    })
                    .map_err(|e| {
                        NotificationResult::failure(format!("Invalid SMTP host: {}", e), None)
                    })
            } else {
                // Use STARTTLS for port 587 (starts plain, upgrades to TLS)
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(smtp_host)
                    .map(|b| b.port(smtp_port))
                    .map_err(|e| {
                        NotificationResult::failure(format!("Invalid SMTP host: {}", e), None)
                    })
            };

            let mailer_builder = match mailer_builder {
                Ok(b) => b,
                Err(result) => return result,
            };

            // Add credentials if configured
            let mailer = if let (Some(username), Some(password)) = (
                config
                    .smtp_username
                    .as_ref()
                    .or(self.global_smtp_username.as_ref()),
                config
                    .smtp_password
                    .as_ref()
                    .or(self.global_smtp_password.as_ref()),
            ) {
                mailer_builder
                    .credentials(Credentials::new(username.clone(), password.clone()))
                    .build()
            } else {
                mailer_builder.build()
            };

            // Send email
            match mailer.send(email).await {
                Ok(_) => {
                    sent_any = true;
                    log::debug!("Email sent successfully to {}", recipient);
                }
                Err(e) => {
                    return NotificationResult::failure(
                        format!("Failed to send email to {}: {}", recipient, e),
                        None,
                    )
                }
            }
        }

        if !sent_any {
            return NotificationResult::failure("No valid email recipients".to_string(), None);
        }

        NotificationResult::success(None)
    }

    fn validate_config(&self, config: &serde_json::Value) -> AppResult<()> {
        let email_config: EmailConfig = serde_json::from_value(config.clone())
            .map_err(|e| AppError::Validation(format!("Invalid email config: {}", e)))?;

        if email_config.recipients.is_empty() {
            return Err(AppError::Validation(
                "At least one email recipient is required".to_string(),
            ));
        }

        // Validate email addresses
        for recipient in &email_config.recipients {
            if !recipient.contains('@') || recipient.len() < 5 {
                return Err(AppError::Validation(format!(
                    "Invalid email address: {}",
                    recipient
                )));
            }
        }

        // If no global SMTP and no channel SMTP, warn
        if email_config.smtp_host.is_none() && self.global_smtp_host.is_none() {
            return Err(AppError::Validation(
                "SMTP host must be configured either globally or per-channel".to_string(),
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
    fn test_format_html_contains_key_elements() {
        let payload = create_test_payload();
        let html = EmailNotifier::format_html(&payload);

        assert!(html.contains("Test Project"));
        assert!(html.contains("TEST-1"));
        assert!(html.contains("TypeError"));
        assert!(html.contains("View Issue"));
    }

    #[test]
    fn test_format_text_contains_key_elements() {
        let payload = create_test_payload();
        let text = EmailNotifier::format_text(&payload);

        assert!(text.contains("Test Project"));
        assert!(text.contains("TEST-1"));
        assert!(text.contains("TypeError"));
        assert!(text.contains("https://example.com/issues/abc-123"));
    }

    #[test]
    fn test_html_escape() {
        assert_eq!(html_escape("<script>"), "&lt;script&gt;");
        assert_eq!(html_escape("a & b"), "a &amp; b");
        assert_eq!(html_escape("\"quote\""), "&quot;quote&quot;");
    }
}
