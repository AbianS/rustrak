//! Unit tests for gen_ai.* span attribute normalization (story-ai-agent-monitoring.md, GH #180).
//!
//! Pure logic, no DB — mirrors Relay's normalize_ai() / infer_ai_operation_type().

use rustrak::services::gen_ai::{infer_operation_type, is_ai_span, normalize_gen_ai_attributes};
use serde_json::json;

// =============================================================================
// is_ai_span
// =============================================================================

#[test]
fn test_is_ai_span_true_when_operation_type_present() {
    let data = json!({"gen_ai.operation.type": "agent"});
    assert!(is_ai_span(&data, None));
}

#[test]
fn test_is_ai_span_true_when_operation_name_present() {
    let data = json!({"gen_ai.operation.name": "chat"});
    assert!(is_ai_span(&data, None));
}

#[test]
fn test_is_ai_span_true_when_op_starts_with_gen_ai_prefix() {
    let data = json!({});
    assert!(is_ai_span(&data, Some("gen_ai.chat")));
}

#[test]
fn test_is_ai_span_true_when_op_starts_with_legacy_ai_prefix() {
    let data = json!({});
    assert!(is_ai_span(&data, Some("ai.streamText")));
}

#[test]
fn test_is_ai_span_false_for_unrelated_span() {
    let data = json!({});
    assert!(!is_ai_span(&data, Some("http.client")));
}

#[test]
fn test_is_ai_span_false_for_op_containing_ai_not_as_prefix() {
    // "database" contains no "ai." prefix at the start — must not false-positive.
    let data = json!({});
    assert!(!is_ai_span(&data, Some("db.query")));
}

// =============================================================================
// infer_operation_type — full port of Relay's infer_ai_operation_type
// =============================================================================

#[test]
fn test_infer_operation_type_full_matches_to_agent() {
    for op in [
        "ai.run.generateText",
        "ai.run.generateObject",
        "gen_ai.invoke_agent",
        "ai.pipeline.generate_text",
        "ai.pipeline.generate_object",
        "ai.pipeline.stream_text",
        "ai.pipeline.stream_object",
        "gen_ai.create_agent",
        "invoke_agent",
        "create_agent",
    ] {
        assert_eq!(infer_operation_type(op), Some("agent"), "op={op}");
    }
}

#[test]
fn test_infer_operation_type_full_matches_to_tool() {
    for op in ["gen_ai.execute_tool", "execute_tool"] {
        assert_eq!(infer_operation_type(op), Some("tool"), "op={op}");
    }
}

#[test]
fn test_infer_operation_type_full_matches_to_handoff() {
    for op in ["gen_ai.handoff", "handoff"] {
        assert_eq!(infer_operation_type(op), Some("handoff"), "op={op}");
    }
}

#[test]
fn test_infer_operation_type_full_matches_to_other() {
    for op in ["ai.processor", "processor_run"] {
        assert_eq!(infer_operation_type(op), Some("other"), "op={op}");
    }
}

#[test]
fn test_infer_operation_type_prefix_matches() {
    assert_eq!(
        infer_operation_type("ai.streamText.doStream"),
        Some("ai_client")
    );
    assert_eq!(infer_operation_type("ai.streamText.foo"), Some("agent"));
    assert_eq!(infer_operation_type("ai.streamText"), Some("agent"));

    assert_eq!(
        infer_operation_type("ai.generateText.doGenerate"),
        Some("ai_client")
    );
    assert_eq!(infer_operation_type("ai.generateText.foo"), Some("agent"));

    assert_eq!(
        infer_operation_type("ai.generateObject.doGenerate"),
        Some("ai_client")
    );
    assert_eq!(infer_operation_type("ai.generateObject.foo"), Some("agent"));

    assert_eq!(infer_operation_type("ai.toolCall.foo"), Some("tool"));
}

#[test]
fn test_infer_operation_type_no_match_returns_none() {
    assert_eq!(infer_operation_type("http.client"), None);
    assert_eq!(infer_operation_type("gen_ai.chat.completions"), None);
}

// =============================================================================
// normalize_gen_ai_attributes — orchestration
// =============================================================================

#[test]
fn test_normalize_defaults_response_model_from_request_model() {
    let mut data = json!({
        "gen_ai.operation.type": "ai_client",
        "gen_ai.request.model": "gpt-4"
    });
    normalize_gen_ai_attributes(&mut data, None);
    assert_eq!(data["gen_ai.response.model"], "gpt-4");
}

#[test]
fn test_normalize_does_not_overwrite_existing_response_model() {
    let mut data = json!({
        "gen_ai.operation.type": "ai_client",
        "gen_ai.request.model": "gpt-4",
        "gen_ai.response.model": "gpt-4-turbo-2024"
    });
    normalize_gen_ai_attributes(&mut data, None);
    assert_eq!(data["gen_ai.response.model"], "gpt-4-turbo-2024");
}

#[test]
fn test_normalize_infers_operation_type_from_operation_name() {
    let mut data = json!({"gen_ai.operation.name": "invoke_agent"});
    normalize_gen_ai_attributes(&mut data, None);
    assert_eq!(data["gen_ai.operation.type"], "agent");
}

#[test]
fn test_normalize_infers_operation_type_from_span_op() {
    let mut data = json!({});
    normalize_gen_ai_attributes(&mut data, Some("gen_ai.invoke_agent"));
    assert_eq!(data["gen_ai.operation.type"], "agent");
}

#[test]
fn test_normalize_defaults_operation_type_to_ai_client_when_no_match() {
    let mut data = json!({"gen_ai.operation.name": "embeddings"});
    normalize_gen_ai_attributes(&mut data, None);
    assert_eq!(data["gen_ai.operation.type"], "ai_client");
}

#[test]
fn test_normalize_does_not_overwrite_existing_operation_type() {
    let mut data = json!({
        "gen_ai.operation.type": "tool",
        "gen_ai.operation.name": "invoke_agent"
    });
    normalize_gen_ai_attributes(&mut data, None);
    assert_eq!(data["gen_ai.operation.type"], "tool");
}

#[test]
fn test_normalize_defaults_agent_name_from_function_id() {
    let mut data = json!({
        "gen_ai.operation.type": "ai_client",
        "gen_ai.function_id": "my-agent"
    });
    normalize_gen_ai_attributes(&mut data, None);
    assert_eq!(data["gen_ai.agent.name"], "my-agent");
}

#[test]
fn test_normalize_does_not_overwrite_existing_agent_name() {
    let mut data = json!({
        "gen_ai.operation.type": "ai_client",
        "gen_ai.function_id": "fallback-name",
        "gen_ai.agent.name": "real-agent"
    });
    normalize_gen_ai_attributes(&mut data, None);
    assert_eq!(data["gen_ai.agent.name"], "real-agent");
}

#[test]
fn test_normalize_computes_total_tokens_from_input_and_output() {
    let mut data = json!({
        "gen_ai.operation.type": "ai_client",
        "gen_ai.usage.input_tokens": 100,
        "gen_ai.usage.output_tokens": 50
    });
    normalize_gen_ai_attributes(&mut data, None);
    assert_eq!(data["gen_ai.usage.total_tokens"], 150.0);
}

#[test]
fn test_normalize_does_not_overwrite_existing_total_tokens() {
    let mut data = json!({
        "gen_ai.operation.type": "ai_client",
        "gen_ai.usage.input_tokens": 100,
        "gen_ai.usage.output_tokens": 50,
        "gen_ai.usage.total_tokens": 999
    });
    normalize_gen_ai_attributes(&mut data, None);
    assert_eq!(data["gen_ai.usage.total_tokens"], 999);
}

#[test]
fn test_normalize_total_tokens_absent_when_neither_input_nor_output_present() {
    let mut data = json!({"gen_ai.operation.type": "ai_client"});
    normalize_gen_ai_attributes(&mut data, None);
    assert!(data.get("gen_ai.usage.total_tokens").is_none());
}

#[test]
fn test_normalize_is_noop_for_non_ai_span() {
    let mut data = json!({"foo": "bar"});
    normalize_gen_ai_attributes(&mut data, Some("http.client"));
    assert_eq!(data, json!({"foo": "bar"}));
}
