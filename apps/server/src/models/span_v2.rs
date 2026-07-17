//! Sentry Spans Protocol v2 model (`application/vnd.sentry.items.span.v2+json`).
//!
//! Modern Sentry SDKs (verified: `@sentry/node` 10.65 + Vercel AI SDK's
//! `vercelAIIntegration()`) send OTel-instrumented spans — including every
//! AI Agent Monitoring span — in this batched, typed-attribute wire format,
//! not the legacy one-span-per-item format (`models::transaction`'s inline
//! span handling / `SpanProcessor`). See
//! `_bmad-output/implementation-artifacts/story-span-v2-protocol.md`.
//!
//! Wire shape: `{"version":2,"items":[SpanV2Entry, ...]}`. Schema mirrors
//! `relay-event-schema/src/protocol/span_v2/mod.rs` — notably there is no
//! top-level `op` (it lives in `attributes["sentry.op"]`) and `end_timestamp`
//! replaces the legacy `timestamp` field name.

use crate::error::{AppError, AppResult};
use serde::Deserialize;
use serde_json::{Map, Value};

/// One span entry from a Spans Protocol v2 container.
#[derive(Debug, Clone, Deserialize)]
pub struct SpanV2Entry {
    #[serde(default)]
    pub trace_id: String,
    #[serde(default)]
    pub span_id: String,
    #[serde(default)]
    pub parent_span_id: Option<String>,
    /// Human-readable span label (maps to Rustrak's `description` column —
    /// v2 has no separate `op`/`description` split at the top level).
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub is_segment: bool,
    #[serde(default)]
    pub start_timestamp: f64,
    #[serde(default)]
    pub end_timestamp: f64,
    /// Typed attribute map: `{"key": {"value": ..., "type": "string"|...}}`.
    /// Use [`Self::flat_attributes`] to unwrap into the plain `{key: value}`
    /// shape the rest of Rustrak's span-storage/gen_ai code expects.
    #[serde(default)]
    pub attributes: Map<String, Value>,
}

impl SpanV2Entry {
    /// Unwraps the typed attribute map into a flat `{key: value}` object,
    /// dropping the `{"value":..., "type":...}` wrapper. Rustrak (self-hosted,
    /// single-tenant) doesn't need Relay's type/value-agreement validation —
    /// that's a Relay-side Kafka-schema strictness concern, not a wire-format
    /// requirement. A missing `value` on an attribute is simply omitted.
    pub fn flat_attributes(&self) -> Value {
        let mut flat = Map::with_capacity(self.attributes.len());
        for (key, attr) in &self.attributes {
            if let Some(value) = attr.get("value") {
                flat.insert(key.clone(), value.clone());
            }
        }
        Value::Object(flat)
    }

    /// Derives the semantic operation for this span from its (already
    /// flattened) attributes: `sentry.op` first, falling back to
    /// `gen_ai.operation.name` — mirrors Relay's `derive_op_for_v2_span`
    /// for the AI case, the only fallback Rustrak needs (other resource
    /// types' op-inference-by-request-shape is out of scope).
    pub fn op(flat_attributes: &Value) -> Option<String> {
        flat_attributes
            .get("sentry.op")
            .and_then(|v| v.as_str())
            .or_else(|| {
                flat_attributes
                    .get("gen_ai.operation.name")
                    .and_then(|v| v.as_str())
            })
            .map(str::to_string)
    }
}

/// Wire shape of a Spans Protocol v2 container: `{"version":2,"items":[...]}`.
#[derive(Debug, Deserialize)]
struct SpanV2Container {
    #[serde(default)]
    items: Vec<SpanV2Entry>,
}

impl SpanV2Container {
    /// Parses a v2 container body into individual [`SpanV2Entry`]s.
    pub fn parse(body: &[u8]) -> AppResult<Vec<SpanV2Entry>> {
        let container: SpanV2Container = serde_json::from_slice(body)
            .map_err(|e| AppError::Validation(format!("Invalid span v2 container JSON: {}", e)))?;
        Ok(container.items)
    }
}

/// Parses a Spans Protocol v2 container body into its entries.
pub fn parse_span_v2_container(body: &[u8]) -> AppResult<Vec<SpanV2Entry>> {
    SpanV2Container::parse(body)
}
