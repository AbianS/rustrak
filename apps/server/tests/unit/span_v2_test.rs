//! Unit tests for Sentry Spans Protocol v2 ingestion
//! (application/vnd.sentry.items.span.v2+json).
//!
//! See _bmad-output/implementation-artifacts/story-span-v2-protocol.md.
//! Discovered via a real @sentry/node 10.65 + Vercel AI SDK integration
//! test (packages/test-sentry/demo/src/ai-agent.ts) — modern Sentry SDKs
//! send AI-instrumented spans in this batched, typed-attribute wire format,
//! not the legacy one-span-per-item format `span_test.rs` covers.

use rustrak::ingest::envelope::{EnvelopeItemKind, ItemHeaders};
use rustrak::models::span_v2::{parse_span_v2_container, SpanV2Entry};
use serde_json::json;

// =============================================================================
// Level 1 — Pure enum dispatch tests (no DB, no async)
// =============================================================================

#[test]
fn test_enum_dispatch_span_with_v2_content_type_maps_to_span_v2_batch() {
    let headers = ItemHeaders {
        item_type: "span".into(),
        length: None,
        content_type: Some("application/vnd.sentry.items.span.v2+json".into()),
    };
    let kind = EnvelopeItemKind::from((headers, b"{}".to_vec()));
    assert!(matches!(kind, EnvelopeItemKind::SpanV2Batch(_)));
}

#[test]
fn test_enum_dispatch_span_without_v2_content_type_stays_legacy() {
    let headers = ItemHeaders {
        item_type: "span".into(),
        length: None,
        content_type: None,
    };
    let kind = EnvelopeItemKind::from((headers, b"{}".to_vec()));
    assert!(matches!(kind, EnvelopeItemKind::Span(_)));
}

#[test]
fn test_span_v2_batch_does_not_require_event_id() {
    let kind = EnvelopeItemKind::SpanV2Batch(b"{}".to_vec());
    assert!(!kind.requires_event());
}

#[test]
fn test_span_v2_batch_routes_to_span_v2_processor() {
    use rustrak::digest::processors::{route, Route};
    assert_eq!(route(&EnvelopeItemKind::SpanV2Batch(vec![])), Route::SpanV2);
}

// =============================================================================
// Level 1b — Pure container/entry parsing tests (no DB, no async)
// =============================================================================

/// Real wire fixture (trimmed), captured off the wire from an actual
/// @sentry/node 10.65 + Vercel AI SDK generateText() + tool call, via a
/// local echo server acting as the DSN target — not a hand-rolled guess.
const REAL_WIRE_FIXTURE: &str = r#"{
    "version": 2,
    "items": [
        {
            "trace_id": "800087bbed8c481faaabed73e41e5d4b",
            "span_id": "8a743a442038cceb",
            "parent_span_id": "8efc25d3729c267c",
            "name": "generate_content gpt-4o",
            "start_timestamp": 1784231017.8907192,
            "end_timestamp": 1784231017.893409,
            "status": "ok",
            "is_segment": false,
            "attributes": {
                "sentry.origin": { "value": "auto.vercelai.otel", "type": "string" },
                "sentry.op": { "value": "gen_ai.generate_content", "type": "string" },
                "gen_ai.operation.name": { "value": "generate_content", "type": "string" },
                "gen_ai.request.model": { "value": "gpt-4o", "type": "string" },
                "gen_ai.function_id": { "value": "research_agent", "type": "string" },
                "gen_ai.usage.input_tokens": { "value": 210, "type": "integer" },
                "gen_ai.usage.output_tokens": { "value": 34, "type": "integer" }
            }
        },
        {
            "trace_id": "800087bbed8c481faaabed73e41e5d4b",
            "span_id": "a8aa8bae6afce239",
            "parent_span_id": "8efc25d3729c267c",
            "name": "execute_tool webSearch",
            "start_timestamp": 1784231017.894036,
            "end_timestamp": 1784231017.8943124,
            "status": "ok",
            "is_segment": false,
            "attributes": {
                "sentry.origin": { "value": "auto.vercelai.otel", "type": "string" },
                "sentry.op": { "value": "gen_ai.execute_tool", "type": "string" },
                "gen_ai.operation.name": { "value": "execute_tool", "type": "string" },
                "gen_ai.tool.name": { "value": "webSearch", "type": "string" }
            }
        }
    ]
}"#;

#[test]
fn test_parse_span_v2_container_real_fixture() {
    let entries = parse_span_v2_container(REAL_WIRE_FIXTURE.as_bytes()).unwrap();
    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].span_id, "8a743a442038cceb");
    assert_eq!(entries[0].trace_id, "800087bbed8c481faaabed73e41e5d4b");
    assert_eq!(
        entries[0].parent_span_id.as_deref(),
        Some("8efc25d3729c267c")
    );
    assert_eq!(entries[0].name.as_deref(), Some("generate_content gpt-4o"));
    assert_eq!(entries[0].status.as_deref(), Some("ok"));
    assert!(!entries[0].is_segment);
    assert_eq!(entries[1].span_id, "a8aa8bae6afce239");
}

#[test]
fn test_flat_attributes_unwraps_typed_value_type_pairs() {
    let entries = parse_span_v2_container(REAL_WIRE_FIXTURE.as_bytes()).unwrap();
    let flat = entries[0].flat_attributes();

    assert_eq!(flat["sentry.op"], "gen_ai.generate_content");
    assert_eq!(flat["gen_ai.request.model"], "gpt-4o");
    assert_eq!(flat["gen_ai.usage.input_tokens"], 210);
    assert_eq!(flat["gen_ai.usage.output_tokens"], 34);
    // The {"value":..., "type":...} wrapper must not leak through.
    assert!(flat["sentry.op"].is_string());
    assert!(flat.get("type").is_none());
}

#[test]
fn test_op_reads_sentry_op_attribute() {
    let flat = json!({ "sentry.op": "gen_ai.execute_tool" });
    assert_eq!(
        SpanV2Entry::op(&flat).as_deref(),
        Some("gen_ai.execute_tool")
    );
}

#[test]
fn test_op_falls_back_to_gen_ai_operation_name_when_sentry_op_absent() {
    let flat = json!({ "gen_ai.operation.name": "invoke_agent" });
    assert_eq!(SpanV2Entry::op(&flat).as_deref(), Some("invoke_agent"));
}

#[test]
fn test_op_is_none_when_neither_attribute_present() {
    let flat = json!({ "some.other.attr": "x" });
    assert_eq!(SpanV2Entry::op(&flat), None);
}

#[test]
fn test_parse_malformed_container_json_is_rejected() {
    let res = parse_span_v2_container(b"not json");
    assert!(res.is_err());
}

#[test]
fn test_parse_container_with_no_items_returns_empty_vec() {
    let entries = parse_span_v2_container(br#"{"version":2}"#).unwrap();
    assert!(entries.is_empty());
}

// =============================================================================
// Level 2 — SpanV2Processor DB behavior (#[tokio::test] + TestDb)
// =============================================================================

#[cfg(test)]
mod level2 {
    use super::REAL_WIRE_FIXTURE;
    use crate::common::TestDb;
    use chrono::Utc;
    use rustrak::digest::processors::{Processor, ProcessorCtx, SpanV2Processor};
    use rustrak::models::CreateProject;
    use rustrak::services::ProjectService;
    use serde_json::json;
    use sqlx::Row;
    use uuid::Uuid;

    fn ctx(pool: &rustrak::db::DbPool, project_id: i32) -> ProcessorCtx {
        ProcessorCtx {
            pool: pool.clone(),
            project_id,
            event_id: Uuid::nil(),
            ingested_at: Utc::now(),
            remote_addr: None,
        }
    }

    #[tokio::test]
    async fn test_real_fixture_batch_stores_one_row_per_entry() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-v2-real-fixture".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        SpanV2Processor
            .process(
                REAL_WIRE_FIXTURE.as_bytes().to_vec(),
                &ctx(&db.pool, project.id),
            )
            .await
            .unwrap();

        #[cfg(feature = "postgres")]
        const COUNT: &str = "SELECT COUNT(*) FROM spans WHERE project_id = $1";
        #[cfg(not(feature = "postgres"))]
        const COUNT: &str = "SELECT COUNT(*) FROM spans WHERE project_id = ?";
        let count: i64 = sqlx::query_scalar(COUNT)
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(
            count, 2,
            "the fixture's 2 items must each become their own row"
        );
    }

    #[tokio::test]
    async fn test_v2_entry_maps_op_from_sentry_op_attribute_not_top_level() {
        // The key structural difference from the legacy format: `op` has no
        // top-level field in v2, it must be read out of attributes["sentry.op"].
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-v2-op-mapping".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        SpanV2Processor
            .process(
                REAL_WIRE_FIXTURE.as_bytes().to_vec(),
                &ctx(&db.pool, project.id),
            )
            .await
            .unwrap();

        #[cfg(feature = "postgres")]
        const QUERY: &str = "SELECT span_id, trace_id, parent_span_id, op, description, status, transaction_id, duration_ms FROM spans WHERE project_id = $1 AND span_id = $2";
        #[cfg(not(feature = "postgres"))]
        const QUERY: &str = "SELECT span_id, trace_id, parent_span_id, op, description, status, transaction_id, duration_ms FROM spans WHERE project_id = ? AND span_id = ?";

        let row = sqlx::query(QUERY)
            .bind(project.id)
            .bind("8a743a442038cceb")
            .fetch_one(&db.pool)
            .await
            .unwrap();

        let trace_id: Option<String> = row.get("trace_id");
        let parent_span_id: Option<String> = row.get("parent_span_id");
        let op: Option<String> = row.get("op");
        let description: Option<String> = row.get("description");
        let status: Option<String> = row.get("status");
        let transaction_id: Option<Uuid> = row.get("transaction_id");
        let duration_ms: Option<f64> = row.get("duration_ms");

        assert_eq!(
            trace_id.as_deref(),
            Some("800087bbed8c481faaabed73e41e5d4b")
        );
        assert_eq!(parent_span_id.as_deref(), Some("8efc25d3729c267c"));
        assert_eq!(
            op.as_deref(),
            Some("gen_ai.generate_content"),
            "op must come from attributes[\"sentry.op\"]"
        );
        assert_eq!(
            description.as_deref(),
            Some("generate_content gpt-4o"),
            "description must come from `name`"
        );
        assert_eq!(status.as_deref(), Some("ok"));
        assert!(
            transaction_id.is_none(),
            "standalone v2 span must not be linked to a transaction"
        );
        assert!(
            duration_ms.is_some_and(|d| d > 0.0),
            "duration must be derived from end_timestamp - start_timestamp"
        );
    }

    #[tokio::test]
    async fn test_v2_ai_span_normalized_and_cost_calculated() {
        // AC #4: extract_gen_ai_columns is the same shared entry point as
        // the legacy/transaction producers — the AI span in the real
        // fixture must get gen_ai columns populated.
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-v2-gen-ai".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        SpanV2Processor
            .process(
                REAL_WIRE_FIXTURE.as_bytes().to_vec(),
                &ctx(&db.pool, project.id),
            )
            .await
            .unwrap();

        #[cfg(feature = "postgres")]
        const QUERY: &str = "SELECT gen_ai_operation_type, gen_ai_agent_name, gen_ai_response_model, gen_ai_usage_total_tokens, gen_ai_cost_total_tokens FROM spans WHERE project_id = $1 AND span_id = $2";
        #[cfg(not(feature = "postgres"))]
        const QUERY: &str = "SELECT gen_ai_operation_type, gen_ai_agent_name, gen_ai_response_model, gen_ai_usage_total_tokens, gen_ai_cost_total_tokens FROM spans WHERE project_id = ? AND span_id = ?";

        let row = sqlx::query(QUERY)
            .bind(project.id)
            .bind("8a743a442038cceb")
            .fetch_one(&db.pool)
            .await
            .unwrap();

        let operation_type: Option<String> = row.get("gen_ai_operation_type");
        let agent_name: Option<String> = row.get("gen_ai_agent_name");
        let response_model: Option<String> = row.get("gen_ai_response_model");
        let total_tokens: Option<f64> = row.get("gen_ai_usage_total_tokens");
        let cost_total: Option<f64> = row.get("gen_ai_cost_total_tokens");

        // "gen_ai.generate_content" isn't in infer_operation_type's match
        // table (only the JS-raw "ai.generateText.doGenerate" form is) so it
        // falls through to the ai_client default — same behavior Relay's
        // own eap::ai normalization has (see story-span-v2-protocol.md).
        assert_eq!(operation_type.as_deref(), Some("ai_client"));
        assert_eq!(
            agent_name.as_deref(),
            Some("research_agent"),
            "must default from gen_ai.function_id"
        );
        assert_eq!(
            response_model.as_deref(),
            Some("gpt-4o"),
            "must default from gen_ai.request.model"
        );
        assert_eq!(total_tokens, Some(244.0), "210 input + 34 output");
        assert!(
            cost_total.is_some_and(|c| c > 0.0),
            "gpt-4o is a known model with real usage — cost must be calculated"
        );
    }

    #[tokio::test]
    async fn test_v2_tool_span_gets_tool_operation_type() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-v2-tool".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        SpanV2Processor
            .process(
                REAL_WIRE_FIXTURE.as_bytes().to_vec(),
                &ctx(&db.pool, project.id),
            )
            .await
            .unwrap();

        #[cfg(feature = "postgres")]
        const QUERY: &str = "SELECT gen_ai_operation_type, gen_ai_tool_name FROM spans WHERE project_id = $1 AND span_id = $2";
        #[cfg(not(feature = "postgres"))]
        const QUERY: &str = "SELECT gen_ai_operation_type, gen_ai_tool_name FROM spans WHERE project_id = ? AND span_id = ?";

        let row = sqlx::query(QUERY)
            .bind(project.id)
            .bind("a8aa8bae6afce239")
            .fetch_one(&db.pool)
            .await
            .unwrap();

        let operation_type: Option<String> = row.get("gen_ai_operation_type");
        let tool_name: Option<String> = row.get("gen_ai_tool_name");

        assert_eq!(operation_type.as_deref(), Some("tool"));
        assert_eq!(tool_name.as_deref(), Some("webSearch"));
    }

    #[tokio::test]
    async fn test_v2_cache_and_reasoning_token_keys_are_costed() {
        // Regression test for the bug found alongside the v2 protocol gap:
        // v2/EAP-sourced spans use DIFFERENT attribute key names for
        // cache/reasoning tokens than the legacy format
        // (gen_ai.usage.cache_read.input_tokens, not
        // gen_ai.usage.input_tokens.cached). Before the fix in
        // services/gen_ai.rs, this silently computed $0 extra cost.
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-v2-cache-tokens".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = json!({
            "version": 2,
            "items": [{
                "trace_id": "d3d20f000885466b8c8f947c9b92b8d3",
                "span_id": "cccccccccccccccc",
                "start_timestamp": 1.0,
                "end_timestamp": 2.0,
                "attributes": {
                    "sentry.op": { "value": "gen_ai.generate_content", "type": "string" },
                    "gen_ai.operation.type": { "value": "ai_client", "type": "string" },
                    "gen_ai.request.model": { "value": "claude-3-5-sonnet", "type": "string" },
                    "gen_ai.usage.input_tokens": { "value": 1000, "type": "integer" },
                    "gen_ai.usage.output_tokens": { "value": 500, "type": "integer" },
                    "gen_ai.usage.cache_read.input_tokens": { "value": 200, "type": "integer" },
                    "gen_ai.usage.cache_creation.input_tokens": { "value": 100, "type": "integer" }
                }
            }]
        })
        .to_string();

        SpanV2Processor
            .process(payload.into_bytes(), &ctx(&db.pool, project.id))
            .await
            .unwrap();

        #[cfg(feature = "postgres")]
        const QUERY: &str = "SELECT gen_ai_cost_input_tokens FROM spans WHERE project_id = $1";
        #[cfg(not(feature = "postgres"))]
        const QUERY: &str = "SELECT gen_ai_cost_input_tokens FROM spans WHERE project_id = ?";

        let cost_input: Option<f64> = sqlx::query_scalar(QUERY)
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap();

        // claude-3-5-sonnet: input_per_token=3.00/1e6, cached=0.30/1e6, cache_write=3.75/1e6
        // raw_input = 1000 - 200 - 100 = 700
        // cost = 700*3.00/1e6 + 200*0.30/1e6 + 100*3.75/1e6
        let expected = 700.0 * (3.00 / 1_000_000.0)
            + 200.0 * (0.30 / 1_000_000.0)
            + 100.0 * (3.75 / 1_000_000.0);
        assert!(
            cost_input.is_some_and(|c| (c - expected).abs() < 1e-9),
            "cache/cache-write tokens under v2 key names must be costed: got {:?}, expected {}",
            cost_input,
            expected
        );
    }

    #[tokio::test]
    async fn test_v2_entry_missing_span_id_is_skipped_not_whole_batch() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-v2-partial-batch".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = json!({
            "version": 2,
            "items": [
                {
                    "trace_id": "d3d20f000885466b8c8f947c9b92b8d3",
                    "start_timestamp": 1.0,
                    "end_timestamp": 2.0,
                    "attributes": {}
                },
                {
                    "trace_id": "d3d20f000885466b8c8f947c9b92b8d3",
                    "span_id": "dddddddddddddddd",
                    "start_timestamp": 1.0,
                    "end_timestamp": 2.0,
                    "attributes": {}
                }
            ]
        })
        .to_string();

        SpanV2Processor
            .process(payload.into_bytes(), &ctx(&db.pool, project.id))
            .await
            .unwrap();

        #[cfg(feature = "postgres")]
        const COUNT: &str = "SELECT COUNT(*) FROM spans WHERE project_id = $1";
        #[cfg(not(feature = "postgres"))]
        const COUNT: &str = "SELECT COUNT(*) FROM spans WHERE project_id = ?";
        let count: i64 = sqlx::query_scalar(COUNT)
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(
            count, 1,
            "the entry missing span_id must be skipped, the valid one still stored"
        );
    }

    #[tokio::test]
    async fn test_v2_is_segment_true_sets_segment_id_to_own_span_id() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-v2-segment".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = json!({
            "version": 2,
            "items": [{
                "trace_id": "d3d20f000885466b8c8f947c9b92b8d3",
                "span_id": "eeeeeeeeeeeeeeee",
                "start_timestamp": 1.0,
                "end_timestamp": 2.0,
                "is_segment": true,
                "attributes": {}
            }]
        })
        .to_string();

        SpanV2Processor
            .process(payload.into_bytes(), &ctx(&db.pool, project.id))
            .await
            .unwrap();

        #[cfg(feature = "postgres")]
        const QUERY: &str = "SELECT is_segment, segment_id FROM spans WHERE project_id = $1";
        #[cfg(not(feature = "postgres"))]
        const QUERY: &str = "SELECT is_segment, segment_id FROM spans WHERE project_id = ?";

        let row = sqlx::query(QUERY)
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap();

        let is_segment: bool = row.get("is_segment");
        let segment_id: Option<String> = row.get("segment_id");

        assert!(is_segment);
        assert_eq!(segment_id.as_deref(), Some("eeeeeeeeeeeeeeee"));
    }

    #[tokio::test]
    async fn test_v2_and_legacy_spans_sharing_trace_id_are_both_queryable() {
        // AC #6: a trace with mixed-origin spans (v2-sourced + legacy) must
        // be queryable as one coherent trace.
        use rustrak::digest::processors::SpanProcessor;
        use rustrak::services::span::{SpanFilters, SpanService};

        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-v2-mixed-origin".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let shared_trace = "ffffffffffffffffffffffffffffffff";

        // Legacy standalone span.
        let legacy_payload = json!({
            "span_id": "1111111111111111",
            "trace_id": shared_trace,
            "op": "http.client",
            "start_timestamp": 1.0,
            "timestamp": 2.0
        });
        SpanProcessor
            .process(
                serde_json::to_vec(&legacy_payload).unwrap(),
                &ctx(&db.pool, project.id),
            )
            .await
            .unwrap();

        // v2 span sharing the same trace_id.
        let v2_payload = json!({
            "version": 2,
            "items": [{
                "trace_id": shared_trace,
                "span_id": "2222222222222222",
                "start_timestamp": 1.0,
                "end_timestamp": 1.5,
                "attributes": {}
            }]
        })
        .to_string();
        SpanV2Processor
            .process(v2_payload.into_bytes(), &ctx(&db.pool, project.id))
            .await
            .unwrap();

        let filters = SpanFilters {
            trace_id: Some(shared_trace.to_string()),
            ..Default::default()
        };
        let (list, total) = SpanService::list_offset(&db.pool, project.id, 1, 20, &filters)
            .await
            .unwrap();

        assert_eq!(
            total, 2,
            "both the legacy and v2-sourced span share this trace_id"
        );
        assert_eq!(list.len(), 2);
    }

    #[tokio::test]
    async fn test_v2_malformed_container_json_is_rejected() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-v2-bad-json".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let res = SpanV2Processor
            .process(vec![0xff, 0x00, b'n', b'o'], &ctx(&db.pool, project.id))
            .await;
        assert!(
            res.is_err(),
            "malformed span v2 container JSON must be rejected"
        );
    }
}
