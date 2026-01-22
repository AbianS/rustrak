//! Test fixtures and data builders
//!
//! Provides reusable test data for events, projects, and other entities.

use serde_json::{json, Value};
use uuid::Uuid;

/// Builds test event data with sensible defaults
pub struct EventBuilder {
    event_id: String,
    timestamp: f64,
    platform: String,
    level: String,
    transaction: Option<String>,
    exception: Option<Value>,
    message: Option<String>,
    fingerprint: Option<Vec<String>>,
    release: Option<String>,
    environment: Option<String>,
}

impl Default for EventBuilder {
    fn default() -> Self {
        Self {
            event_id: Uuid::new_v4().to_string().replace("-", ""),
            timestamp: 1704801600.0,
            platform: "python".to_string(),
            level: "error".to_string(),
            transaction: None,
            exception: None,
            message: None,
            fingerprint: None,
            release: None,
            environment: None,
        }
    }
}

impl EventBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_event_id(mut self, id: &str) -> Self {
        self.event_id = id.to_string();
        self
    }

    pub fn with_platform(mut self, platform: &str) -> Self {
        self.platform = platform.to_string();
        self
    }

    pub fn with_level(mut self, level: &str) -> Self {
        self.level = level.to_string();
        self
    }

    pub fn with_transaction(mut self, transaction: &str) -> Self {
        self.transaction = Some(transaction.to_string());
        self
    }

    pub fn with_exception(mut self, exc_type: &str, exc_value: &str) -> Self {
        self.exception = Some(json!({
            "values": [{
                "type": exc_type,
                "value": exc_value
            }]
        }));
        self
    }

    pub fn with_exception_and_stacktrace(
        mut self,
        exc_type: &str,
        exc_value: &str,
        frames: Vec<StackFrame>,
    ) -> Self {
        let frames_json: Vec<Value> = frames.into_iter().map(|f| f.to_json()).collect();
        self.exception = Some(json!({
            "values": [{
                "type": exc_type,
                "value": exc_value,
                "stacktrace": {
                    "frames": frames_json
                }
            }]
        }));
        self
    }

    pub fn with_message(mut self, message: &str) -> Self {
        self.message = Some(message.to_string());
        self
    }

    pub fn with_fingerprint(mut self, fingerprint: Vec<&str>) -> Self {
        self.fingerprint = Some(fingerprint.into_iter().map(String::from).collect());
        self
    }

    pub fn with_release(mut self, release: &str) -> Self {
        self.release = Some(release.to_string());
        self
    }

    pub fn with_environment(mut self, env: &str) -> Self {
        self.environment = Some(env.to_string());
        self
    }

    pub fn build(self) -> Value {
        let mut event = json!({
            "event_id": self.event_id,
            "timestamp": self.timestamp,
            "platform": self.platform,
            "level": self.level
        });

        if let Some(t) = self.transaction {
            event["transaction"] = json!(t);
        }
        if let Some(e) = self.exception {
            event["exception"] = e;
        }
        if let Some(m) = self.message {
            event["message"] = json!(m);
        }
        if let Some(f) = self.fingerprint {
            event["fingerprint"] = json!(f);
        }
        if let Some(r) = self.release {
            event["release"] = json!(r);
        }
        if let Some(e) = self.environment {
            event["environment"] = json!(e);
        }

        event
    }
}

/// Stack frame data for exception fixtures
pub struct StackFrame {
    pub filename: String,
    pub function: String,
    pub lineno: Option<u32>,
    pub module: Option<String>,
    pub in_app: bool,
}

impl StackFrame {
    pub fn new(filename: &str, function: &str) -> Self {
        Self {
            filename: filename.to_string(),
            function: function.to_string(),
            lineno: None,
            module: None,
            in_app: true,
        }
    }

    pub fn with_lineno(mut self, lineno: u32) -> Self {
        self.lineno = Some(lineno);
        self
    }

    pub fn with_module(mut self, module: &str) -> Self {
        self.module = Some(module.to_string());
        self
    }

    pub fn not_in_app(mut self) -> Self {
        self.in_app = false;
        self
    }

    fn to_json(self) -> Value {
        let mut frame = json!({
            "filename": self.filename,
            "function": self.function,
            "in_app": self.in_app
        });

        if let Some(l) = self.lineno {
            frame["lineno"] = json!(l);
        }
        if let Some(m) = self.module {
            frame["module"] = json!(m);
        }

        frame
    }
}

/// Creates a minimal valid Sentry envelope for testing
pub fn create_envelope(project_id: u32, sentry_key: &str, event: &Value) -> Vec<u8> {
    let event_id = event["event_id"].as_str().unwrap_or("test-event-id");
    let event_json = serde_json::to_string(event).unwrap();

    let envelope = format!(
        r#"{{"event_id":"{}","dsn":"http://{}@localhost/{}"}}
{{"type":"event","length":{}}}
{}"#,
        event_id,
        sentry_key,
        project_id,
        event_json.len(),
        event_json
    );

    envelope.into_bytes()
}

/// Creates a minimal envelope without length field (relies on newline)
pub fn create_envelope_no_length(project_id: u32, sentry_key: &str, event: &Value) -> Vec<u8> {
    let event_id = event["event_id"].as_str().unwrap_or("test-event-id");
    let event_json = serde_json::to_string(event).unwrap();

    let envelope = format!(
        r#"{{"event_id":"{}","dsn":"http://{}@localhost/{}"}}
{{"type":"event"}}
{}"#,
        event_id, sentry_key, project_id, event_json
    );

    envelope.into_bytes()
}

/// Common test exception events
pub mod events {
    use super::*;

    pub fn type_error() -> Value {
        EventBuilder::new()
            .with_exception("TypeError", "undefined is not a function")
            .with_transaction("/api/users")
            .build()
    }

    pub fn value_error() -> Value {
        EventBuilder::new()
            .with_exception("ValueError", "invalid literal for int()")
            .with_transaction("/process")
            .build()
    }

    pub fn runtime_error_with_stack() -> Value {
        EventBuilder::new()
            .with_exception_and_stacktrace(
                "RuntimeError",
                "Connection refused",
                vec![
                    StackFrame::new("lib/http.py", "connect").not_in_app(),
                    StackFrame::new("app/client.py", "fetch")
                        .with_lineno(42)
                        .with_module("app.client"),
                    StackFrame::new("app/main.py", "run")
                        .with_lineno(10)
                        .with_module("app.main"),
                ],
            )
            .with_transaction("/fetch-data")
            .with_release("v1.2.3")
            .with_environment("production")
            .build()
    }

    pub fn log_message(msg: &str) -> Value {
        EventBuilder::new()
            .with_message(msg)
            .with_level("warning")
            .build()
    }
}
