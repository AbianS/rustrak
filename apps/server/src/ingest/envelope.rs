use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Headers of the envelope (first JSON line)
/// Some fields are parsed but not currently used - kept for future logging/debugging
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct EnvelopeHeaders {
    /// Event ID (required for items of type "event")
    pub event_id: Option<String>,

    /// Full DSN (optional, for self-auth)
    pub dsn: Option<String>,

    /// Timestamp of sending (RFC3339)
    pub sent_at: Option<String>,

    /// SDK info
    pub sdk: Option<SdkInfo>,
}

/// SDK information from envelope headers
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct SdkInfo {
    pub name: Option<String>,
    pub version: Option<String>,
}

/// Headers of an item within the envelope
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct ItemHeaders {
    /// Item type: "event", "session", "transaction", etc.
    #[serde(rename = "type")]
    pub item_type: String,

    /// Payload length in bytes (optional)
    pub length: Option<usize>,

    /// Content type of the payload
    pub content_type: Option<String>,
}

/// A parsed item from the envelope
#[derive(Debug)]
pub struct EnvelopeItem {
    pub headers: ItemHeaders,
    pub payload: Vec<u8>,
}

/// Result of parsing an envelope
#[derive(Debug)]
pub struct ParsedEnvelope {
    pub headers: EnvelopeHeaders,
    pub items: Vec<EnvelopeItem>,
}

/// Event metadata for the digest worker
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventMetadata {
    pub event_id: String,
    pub project_id: i32,
    pub ingested_at: DateTime<Utc>,
    pub remote_addr: Option<String>,
}
