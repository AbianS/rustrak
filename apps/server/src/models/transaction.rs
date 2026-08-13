use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

/// Response model for a single transaction in the list view
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct TransactionResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub transaction_name: String,
    pub timestamp: DateTime<Utc>,
    pub start_timestamp: Option<DateTime<Utc>>,
    /// Duration in milliseconds (timestamp - start_timestamp). None if start_timestamp is missing.
    pub duration_ms: Option<f64>,
    pub platform: String,
    pub environment: String,
    pub release: String,
    pub ingested_at: DateTime<Utc>,
}

/// Response model for a single transaction detail view.
///
/// Carries the same summary fields as [`TransactionResponse`] plus the full
/// Sentry payload under `data` (spans, contexts.trace, measurements, tags,
/// request, user). The frontend builds the span waterfall and metrics view
/// from `data`.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct TransactionDetailResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub transaction_name: String,
    pub timestamp: DateTime<Utc>,
    pub start_timestamp: Option<DateTime<Utc>>,
    /// Duration in milliseconds (timestamp - start_timestamp). None if start_timestamp is missing.
    pub duration_ms: Option<f64>,
    pub platform: String,
    pub environment: String,
    pub release: String,
    pub ingested_at: DateTime<Utc>,
    /// Full Sentry transaction payload (spans, contexts, measurements, tags, request, user).
    pub data: serde_json::Value,
}

/// A single indexed span — extracted from a transaction, OR standalone
/// (Sentry "span" item type). Both origins write into the same `spans`
/// table, so `transaction_id` is the only thing that distinguishes them.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SpanResponse {
    pub id: Uuid,
    /// The parent transaction, if this span was extracted from one.
    /// `None` for a standalone span.
    pub transaction_id: Option<Uuid>,
    pub span_id: Option<String>,
    pub trace_id: Option<String>,
    pub parent_span_id: Option<String>,
    pub op: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub start_timestamp: Option<DateTime<Utc>>,
    pub timestamp: Option<DateTime<Utc>>,
    /// Duration in milliseconds (timestamp - start_timestamp).
    pub duration_ms: Option<f64>,
    /// Relay's exclusive (self) time in milliseconds, if provided by the SDK.
    pub exclusive_time_ms: Option<f64>,
    pub is_segment: bool,
    pub segment_id: Option<String>,
    /// Set for every span. A standalone span reports its own; a
    /// transaction-embedded one is stamped with its parent transaction's at
    /// write time, rather than being left NULL to be recovered by a JOIN —
    /// the agents dashboard filters `spans` directly and a NULL would drop
    /// the row from an environment-filtered view.
    pub platform: Option<String>,
    pub release: Option<String>,
    pub environment: Option<String>,
    /// gen_ai.* denormalized fields (story-ai-agent-monitoring.md, GH #180).
    /// All `None` unless the span was recognized as an AI span.
    pub gen_ai_operation_type: Option<String>,
    pub gen_ai_agent_name: Option<String>,
    pub gen_ai_request_model: Option<String>,
    pub gen_ai_response_model: Option<String>,
    pub gen_ai_tool_name: Option<String>,
    pub gen_ai_conversation_id: Option<String>,
    pub gen_ai_usage_input_tokens: Option<f64>,
    pub gen_ai_usage_output_tokens: Option<f64>,
    pub gen_ai_usage_total_tokens: Option<f64>,
}

/// One span with its full attribute bag — the detail counterpart to
/// [`SpanResponse`].
///
/// The list response deliberately omits attributes: `spans.data` is never
/// trimmed (unlike event data, which goes through `services::event_trim`), so
/// a single AI span can carry a whole prompt and a trace's worth of them would
/// dwarf the waterfall it is drawn from. Attributes are fetched one span at a
/// time instead, which is also how Sentry's own agent drawer works — the span
/// list is light and the details panel loads the selected node's attributes.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SpanDetailResponse {
    #[serde(flatten)]
    pub span: SpanResponse,
    /// The span's attribute bag, flattened to `{key: value}` regardless of
    /// which producer wrote the row — see [`span_attributes`]. This is the
    /// `gen_ai.*` payload (prompts, responses, tool arguments and results,
    /// system instructions, tool definitions) that the agents UI renders.
    pub attributes: serde_json::Value,
    /// Span tags, when the producer stored any. Spans Protocol v2 has no
    /// separate tags concept — everything is an attribute — so this is always
    /// `None` for a v2-origin span.
    pub tags: Option<serde_json::Value>,
}

/// Extracts a span's attribute bag from the raw `spans.data` column.
///
/// The column holds two different shapes depending on which producer wrote
/// the row, and callers must not have to care:
///
/// - Spans Protocol v2 (`digest::processors::span_v2`) stores the already
///   flattened attribute bag itself, so `data` *is* the attributes.
/// - The legacy standalone producer (`digest::processors::span`) and the
///   transaction-embedded one (`digest::processors::transaction`) store the
///   whole span object, whose own `data` key holds the attributes — the same
///   key `extract_gen_ai_columns` normalizes in place.
pub fn span_attributes(data: &serde_json::Value) -> serde_json::Value {
    match data.get("data") {
        Some(nested) if nested.is_object() => nested.clone(),
        _ => data.clone(),
    }
}

/// Aggregate performance stats for one (transaction_name, op) group.
/// Powers the performance overview: throughput + latency percentiles +
/// failure rate per transaction. Percentiles are continuous (linear
/// interpolation, matching Postgres `percentile_cont`).
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct TransactionStatsResponse {
    pub transaction_name: String,
    pub op: Option<String>,
    /// Number of transactions in this group.
    pub count: i64,
    pub p50_ms: f64,
    pub p95_ms: f64,
    pub p99_ms: f64,
    /// Fraction (0.0–1.0) of transactions whose trace status is set and not "ok".
    pub failure_rate: f64,
}
