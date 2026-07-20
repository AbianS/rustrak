//! Response models for the AI Agent Monitoring dashboard (story-ai-agent-monitoring.md, GH #180).

use chrono::{DateTime, Utc};
use serde::Serialize;

/// One time-bucketed value (count or sum) — mirrors `SessionTimeseriesPoint`.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AgentTimeseriesPoint {
    pub bucket: DateTime<Utc>,
    pub value: f64,
}

/// avg/p95 duration for one time bucket.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AgentDurationPoint {
    pub bucket: DateTime<Utc>,
    pub avg_ms: f64,
    pub p95_ms: f64,
}

/// One row of a "top N by X" breakdown (model or tool name).
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct GenAiBreakdownRow {
    pub label: String,
    pub value: f64,
}

/// One row of the Traces table — per-`trace_id` aggregate across all AI
/// spans (standalone and transaction-embedded) sharing that trace.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AgentTraceSummary {
    pub trace_id: String,
    /// Every distinct agent that ran in this trace, earliest first. A trace
    /// with handoffs involves more than one, so this is a list rather than a
    /// single root name — Sentry's own Traces table shows them all.
    pub agent_names: Vec<String>,
    /// Duration of the root/longest AI span in this trace, in milliseconds.
    pub duration_ms: Option<f64>,
    pub total_tokens: f64,
    pub tool_call_count: i64,
    pub started_at: DateTime<Utc>,
}
