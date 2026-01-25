//! Sentry envelope generator for benchmarking.
//!
//! Generates valid Sentry envelope format payloads for load testing.

use chrono::{DateTime, Utc};
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use std::io::Write;
use uuid::Uuid;

/// Sentry event level
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Fatal,
    Error,
    Warning,
    Info,
    Debug,
}

impl Default for Level {
    fn default() -> Self {
        Self::Error
    }
}

/// Stack frame in a stack trace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StackFrame {
    pub filename: String,
    pub function: String,
    pub lineno: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub colno: Option<u32>,
    pub in_app: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_line: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pre_context: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post_context: Option<Vec<String>>,
}

/// Stack trace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stacktrace {
    pub frames: Vec<StackFrame>,
}

/// Exception value
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExceptionValue {
    #[serde(rename = "type")]
    pub type_name: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stacktrace: Option<Stacktrace>,
}

/// Exception container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Exception {
    pub values: Vec<ExceptionValue>,
}

/// Breadcrumb
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Breadcrumb {
    pub timestamp: f64,
    #[serde(rename = "type")]
    pub crumb_type: String,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// Breadcrumbs container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Breadcrumbs {
    pub values: Vec<Breadcrumb>,
}

/// User context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,
}

/// SDK information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sdk {
    pub name: String,
    pub version: String,
}

/// Sentry event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub event_id: String,
    pub timestamp: f64,
    pub platform: String,
    pub level: Level,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exception: Option<Exception>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub breadcrumbs: Option<Breadcrumbs>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fingerprint: Option<Vec<String>>,
    pub sdk: Sdk,
}

/// Envelope header
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvelopeHeader {
    pub event_id: String,
    pub sent_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dsn: Option<String>,
    pub sdk: Sdk,
}

/// Item header
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemHeader {
    #[serde(rename = "type")]
    pub item_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
}

/// Configuration for event generation
#[derive(Debug, Clone)]
pub struct EventConfig {
    /// Number of breadcrumbs to include
    pub breadcrumb_count: usize,
    /// Number of stack frames to include
    pub stack_depth: usize,
    /// Include user context
    pub include_user: bool,
    /// Include tags
    pub include_tags: bool,
    /// Include extra data
    pub include_extra: bool,
    /// Environment name
    pub environment: String,
    /// Release version
    pub release: String,
    /// Error type name
    pub error_type: String,
}

impl Default for EventConfig {
    fn default() -> Self {
        Self {
            breadcrumb_count: 5,
            stack_depth: 10,
            include_user: true,
            include_tags: true,
            include_extra: false,
            environment: "benchmark".to_string(),
            release: "rustrak-bench@0.1.0".to_string(),
            error_type: "Error".to_string(),
        }
    }
}

/// Envelope generator for creating Sentry-compatible payloads
pub struct EnvelopeGenerator {
    config: EventConfig,
    sdk: Sdk,
    counter: u64,
}

impl EnvelopeGenerator {
    /// Create a new envelope generator with the given configuration
    pub fn new(config: EventConfig) -> Self {
        Self {
            config,
            sdk: Sdk {
                name: "rustrak-bench".to_string(),
                version: "0.1.0".to_string(),
            },
            counter: 0,
        }
    }

    /// Generate a unique event ID
    fn generate_event_id(&mut self) -> String {
        self.counter += 1;
        Uuid::new_v4().to_string().replace('-', "")
    }

    /// Generate stack frames
    fn generate_stack_frames(&self) -> Vec<StackFrame> {
        let mut frames = Vec::with_capacity(self.config.stack_depth);

        for i in 0..self.config.stack_depth {
            frames.push(StackFrame {
                filename: format!("/app/src/module_{}.rs", i),
                function: format!("process_request_{}", i),
                lineno: 100 + (i as u32 * 10),
                colno: Some(5),
                in_app: i < 5, // First 5 frames are in-app
                context_line: Some(format!("    let result = handle_event({});", i)),
                pre_context: Some(vec![
                    format!("    // Processing step {}", i),
                    "    let data = prepare_data();".to_string(),
                ]),
                post_context: Some(vec![
                    "    log::info!(\"Step completed\");".to_string(),
                    format!("    return result;"),
                ]),
            });
        }

        frames
    }

    /// Generate breadcrumbs
    fn generate_breadcrumbs(&self, now: f64) -> Vec<Breadcrumb> {
        let mut crumbs = Vec::with_capacity(self.config.breadcrumb_count);

        for i in 0..self.config.breadcrumb_count {
            let offset = (self.config.breadcrumb_count - i) as f64;
            crumbs.push(Breadcrumb {
                timestamp: now - offset,
                crumb_type: "default".to_string(),
                category: match i % 4 {
                    0 => "http".to_string(),
                    1 => "navigation".to_string(),
                    2 => "ui.click".to_string(),
                    _ => "console".to_string(),
                },
                message: Some(format!("Breadcrumb event #{}", i + 1)),
                level: Some("info".to_string()),
                data: Some(serde_json::json!({
                    "step": i,
                    "action": format!("action_{}", i)
                })),
            });
        }

        crumbs
    }

    /// Generate a complete event
    pub fn generate_event(&mut self) -> Event {
        let now: DateTime<Utc> = Utc::now();
        let timestamp = now.timestamp() as f64 + (now.timestamp_subsec_millis() as f64 / 1000.0);
        let event_id = self.generate_event_id();

        let exception = Exception {
            values: vec![ExceptionValue {
                type_name: self.config.error_type.clone(),
                value: format!(
                    "Benchmark error #{} - testing server performance",
                    self.counter
                ),
                stacktrace: Some(Stacktrace {
                    frames: self.generate_stack_frames(),
                }),
            }],
        };

        let breadcrumbs = if self.config.breadcrumb_count > 0 {
            Some(Breadcrumbs {
                values: self.generate_breadcrumbs(timestamp),
            })
        } else {
            None
        };

        let user = if self.config.include_user {
            Some(User {
                id: Some(format!("user-{}", self.counter % 100)),
                email: Some(format!("user{}@benchmark.test", self.counter % 100)),
                username: Some(format!("benchuser_{}", self.counter % 100)),
                ip_address: Some(format!("192.168.1.{}", self.counter % 255)),
            })
        } else {
            None
        };

        let tags = if self.config.include_tags {
            Some(serde_json::json!({
                "benchmark": "true",
                "iteration": self.counter.to_string(),
                "scenario": "load_test"
            }))
        } else {
            None
        };

        let extra = if self.config.include_extra {
            Some(serde_json::json!({
                "request_id": format!("req-{}", Uuid::new_v4()),
                "processing_time_ms": self.counter % 1000,
                "payload_size": 1024
            }))
        } else {
            None
        };

        Event {
            event_id,
            timestamp,
            platform: "rust".to_string(),
            level: Level::Error,
            transaction: Some("/api/benchmark".to_string()),
            release: Some(self.config.release.clone()),
            environment: Some(self.config.environment.clone()),
            exception: Some(exception),
            breadcrumbs,
            user,
            tags,
            extra,
            fingerprint: None,
            sdk: self.sdk.clone(),
        }
    }

    /// Generate a complete envelope (uncompressed)
    pub fn generate_envelope(&mut self, dsn: Option<&str>) -> Vec<u8> {
        let event = self.generate_event();
        let event_json = serde_json::to_string(&event).expect("Failed to serialize event");

        let now: DateTime<Utc> = Utc::now();
        let envelope_header = EnvelopeHeader {
            event_id: event.event_id.clone(),
            sent_at: now.to_rfc3339(),
            dsn: dsn.map(String::from),
            sdk: self.sdk.clone(),
        };

        let item_header = ItemHeader {
            item_type: "event".to_string(),
            length: Some(event_json.len()),
            content_type: Some("application/json".to_string()),
        };

        let envelope_header_json =
            serde_json::to_string(&envelope_header).expect("Failed to serialize envelope header");
        let item_header_json =
            serde_json::to_string(&item_header).expect("Failed to serialize item header");

        // Format: envelope_header\nitem_header\nitem_payload\n
        let mut envelope = Vec::new();
        envelope.extend_from_slice(envelope_header_json.as_bytes());
        envelope.push(b'\n');
        envelope.extend_from_slice(item_header_json.as_bytes());
        envelope.push(b'\n');
        envelope.extend_from_slice(event_json.as_bytes());
        envelope.push(b'\n');

        envelope
    }

    /// Generate a gzip-compressed envelope
    pub fn generate_compressed_envelope(&mut self, dsn: Option<&str>) -> Vec<u8> {
        let envelope = self.generate_envelope(dsn);

        let mut encoder = GzEncoder::new(Vec::new(), Compression::fast());
        encoder
            .write_all(&envelope)
            .expect("Failed to compress envelope");
        encoder.finish().expect("Failed to finish compression")
    }

    /// Get the current counter value (number of events generated)
    pub fn events_generated(&self) -> u64 {
        self.counter
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_event() {
        let config = EventConfig::default();
        let mut generator = EnvelopeGenerator::new(config);

        let event = generator.generate_event();

        assert!(!event.event_id.is_empty());
        assert!(event.timestamp > 0.0);
        assert_eq!(event.platform, "rust");
        assert!(event.exception.is_some());
    }

    #[test]
    fn test_generate_envelope() {
        let config = EventConfig::default();
        let mut generator = EnvelopeGenerator::new(config);

        let envelope = generator.generate_envelope(Some("http://key@localhost:8080/1"));

        // Check it's valid UTF-8 and contains expected parts
        let envelope_str = String::from_utf8(envelope).expect("Invalid UTF-8");
        assert!(envelope_str.contains("event_id"));
        assert!(envelope_str.contains("sent_at"));
        assert!(envelope_str.contains("\"type\":\"event\""));
    }

    #[test]
    fn test_generate_compressed_envelope() {
        let config = EventConfig::default();
        let mut generator = EnvelopeGenerator::new(config);

        let compressed = generator.generate_compressed_envelope(None);

        // Gzip magic bytes
        assert!(compressed.len() >= 2);
        assert_eq!(compressed[0], 0x1f);
        assert_eq!(compressed[1], 0x8b);
    }

    #[test]
    fn test_counter_increments() {
        let config = EventConfig::default();
        let mut generator = EnvelopeGenerator::new(config);

        assert_eq!(generator.events_generated(), 0);
        generator.generate_event();
        assert_eq!(generator.events_generated(), 1);
        generator.generate_event();
        assert_eq!(generator.events_generated(), 2);
    }
}
