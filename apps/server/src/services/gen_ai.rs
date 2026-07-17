//! gen_ai.* span attribute normalization (story-ai-agent-monitoring.md, GH #180).
//!
//! Pure logic, no DB — port of Relay's `normalize_ai()` /
//! `infer_ai_operation_type()` (relay-event-normalization/src/normalize/span/ai.rs).
//! Operates on a span's own `data` attributes object (the nested object,
//! not the whole span payload), mutating it in place. Called identically
//! from both `SpanProcessor` (standalone spans) and
//! `TransactionProcessor::insert_span` (transaction-embedded spans) so a
//! gen_ai span is normalized the same way regardless of origin.

use serde_json::Value;

/// Default operation type for a recognized AI span with no other match.
pub const DEFAULT_AI_OPERATION: &str = "ai_client";

/// Denormalized gen_ai.* column values, ready to bind into a `spans` INSERT.
/// All `None` for a non-AI span (see [`is_ai_span`]).
///
/// No cost fields: a self-hosted, single-maintainer project can't keep an
/// accurate per-model pricing table current (dozens of models, prices change
/// without notice) without shipping a release every time a provider updates
/// pricing. Token counts are exact (come straight from the SDK); a derived
/// cost estimate would be a stale approximation, which is worse than no
/// number at all.
#[derive(Debug, Default, Clone)]
pub struct GenAiColumns {
    pub operation_type: Option<String>,
    pub agent_name: Option<String>,
    pub request_model: Option<String>,
    pub response_model: Option<String>,
    pub tool_name: Option<String>,
    pub conversation_id: Option<String>,
    pub usage_input_tokens: Option<f64>,
    pub usage_output_tokens: Option<f64>,
    pub usage_total_tokens: Option<f64>,
}

/// Normalizes a span's `data` attributes bag (see [`normalize_gen_ai_attributes`]),
/// returning the denormalized column values to store. Mutates `span_data` in
/// place so the raw `data` JSONB column stays consistent with what was
/// normalized — mirrors Relay overwriting the attributes bag in `normalize_ai()`.
///
/// This is the single entry point both `SpanProcessor` (standalone spans)
/// and `TransactionProcessor::insert_span` (transaction-embedded spans) call
/// — do not duplicate this logic in either processor.
pub fn extract_gen_ai_columns(span_data: &mut Value, op: Option<&str>) -> GenAiColumns {
    if !is_ai_span(span_data, op) {
        return GenAiColumns::default();
    }

    normalize_gen_ai_attributes(span_data, op);

    let get_str =
        |data: &Value, key: &str| data.get(key).and_then(|v| v.as_str()).map(String::from);
    let get_f64 = |data: &Value, key: &str| data.get(key).and_then(|v| v.as_f64());

    GenAiColumns {
        operation_type: get_str(span_data, "gen_ai.operation.type"),
        agent_name: get_str(span_data, "gen_ai.agent.name"),
        request_model: get_str(span_data, "gen_ai.request.model"),
        response_model: get_str(span_data, "gen_ai.response.model"),
        tool_name: get_str(span_data, "gen_ai.tool.name"),
        conversation_id: get_str(span_data, "gen_ai.conversation.id"),
        usage_input_tokens: get_f64(span_data, "gen_ai.usage.input_tokens"),
        usage_output_tokens: get_f64(span_data, "gen_ai.usage.output_tokens"),
        usage_total_tokens: get_f64(span_data, "gen_ai.usage.total_tokens"),
    }
}

/// Returns true if `data`/`op` indicate an AI span (Relay's `is_ai_item`).
///
/// True if `gen_ai.operation.type` or `gen_ai.operation.name` is present in
/// `data`, or if `op` starts with `"gen_ai."` or `"ai."`.
pub fn is_ai_span(data: &Value, op: Option<&str>) -> bool {
    if data.get("gen_ai.operation.type").is_some() {
        return true;
    }
    if data.get("gen_ai.operation.name").is_some() {
        return true;
    }
    op.is_some_and(|op| op.starts_with("gen_ai.") || op.starts_with("ai."))
}

/// Infers the AI operation type from an operation name or span op.
/// Exact port of Relay's `infer_ai_operation_type`. Returns `None` when the
/// op is not recognized — callers should default to [`DEFAULT_AI_OPERATION`].
pub fn infer_operation_type(op_name: &str) -> Option<&'static str> {
    match op_name {
        "ai.run.generateText"
        | "ai.run.generateObject"
        | "gen_ai.invoke_agent"
        | "ai.pipeline.generate_text"
        | "ai.pipeline.generate_object"
        | "ai.pipeline.stream_text"
        | "ai.pipeline.stream_object"
        | "gen_ai.create_agent"
        | "invoke_agent"
        | "create_agent" => Some("agent"),
        "gen_ai.execute_tool" | "execute_tool" => Some("tool"),
        "gen_ai.handoff" | "handoff" => Some("handoff"),
        "ai.processor" | "processor_run" => Some("other"),
        op if op.starts_with("ai.streamText.doStream") => Some("ai_client"),
        op if op.starts_with("ai.streamText") => Some("agent"),
        op if op.starts_with("ai.generateText.doGenerate") => Some("ai_client"),
        op if op.starts_with("ai.generateText") => Some("agent"),
        op if op.starts_with("ai.generateObject.doGenerate") => Some("ai_client"),
        op if op.starts_with("ai.generateObject") => Some("agent"),
        op if op.starts_with("ai.toolCall") => Some("tool"),
        _ => None,
    }
}

/// Normalizes `data`'s gen_ai.* attributes in place. No-op if the span isn't
/// recognized as AI (see [`is_ai_span`]).
///
/// Order matches Relay's `normalize_ai()`: default response.model from
/// request.model, infer/default operation.type, default agent.name from
/// function_id, compute total_tokens if missing.
pub fn normalize_gen_ai_attributes(data: &mut Value, op: Option<&str>) {
    if !is_ai_span(data, op) {
        return;
    }
    // `is_ai_span` can pass on `op` alone, so a malformed payload whose
    // attributes bag isn't an object still reaches here — and `data[key] = ..`
    // panics on any Value other than Object/Null.
    if !data.is_object() && !data.is_null() {
        return;
    }

    normalize_model(data);
    normalize_operation_type(data, op);
    normalize_agent_name(data);
    normalize_total_tokens(data);
}

fn normalize_model(data: &mut Value) {
    if data.get("gen_ai.response.model").is_some() {
        return;
    }
    if let Some(model) = data.get("gen_ai.request.model").cloned() {
        data["gen_ai.response.model"] = model;
    }
}

/// Unlike the other normalizers, this one overwrites an existing value rather
/// than only filling a gap: `operation.type` is Sentry's own derived field,
/// not SDK data, so Relay recomputes it from `operation.name`/`op` to keep one
/// consistent vocabulary for the product.
///
/// It only does so when there is something authoritative to derive from. With
/// neither an `operation.name` nor an AI `op`, Relay's span pipeline would not
/// classify the span as AI at all and would leave it untouched — recomputing
/// here would just clobber a good value with the default.
fn normalize_operation_type(data: &mut Value, op: Option<&str>) {
    let op_name = data.get("gen_ai.operation.name").and_then(|v| v.as_str());
    let ai_op = op.filter(|o| o.starts_with("ai.") || o.starts_with("gen_ai."));

    if op_name.is_none() && ai_op.is_none() {
        return;
    }

    let operation_type = op_name
        .or(op)
        .and_then(infer_operation_type)
        .unwrap_or(DEFAULT_AI_OPERATION);
    data["gen_ai.operation.type"] = Value::String(operation_type.to_string());
}

fn normalize_agent_name(data: &mut Value) {
    if data.get("gen_ai.agent.name").is_some() {
        return;
    }
    if let Some(function_id) = data.get("gen_ai.function_id").cloned() {
        data["gen_ai.agent.name"] = function_id;
    }
}

fn normalize_total_tokens(data: &mut Value) {
    if data.get("gen_ai.usage.total_tokens").is_some() {
        return;
    }
    let input = data
        .get("gen_ai.usage.input_tokens")
        .and_then(|v| v.as_f64());
    let output = data
        .get("gen_ai.usage.output_tokens")
        .and_then(|v| v.as_f64());
    if input.is_none() && output.is_none() {
        return;
    }
    let total = input.unwrap_or(0.0) + output.unwrap_or(0.0);
    data["gen_ai.usage.total_tokens"] = serde_json::json!(total);
}
