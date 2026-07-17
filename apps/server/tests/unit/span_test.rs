//! Unit tests for standalone Span (Sentry "span" item type) ingestion.
//!
//! Standalone spans are NOT containerized like logs — each envelope item
//! holds exactly one flat span JSON object (Relay's legacy `Span` schema).
//! See _bmad-output/implementation-artifacts/story-span-ingestion.md.

use rustrak::ingest::envelope::{EnvelopeItemKind, ItemHeaders};

// =============================================================================
// Level 1 — Pure enum dispatch tests (no DB, no async)
// =============================================================================

#[test]
fn test_enum_dispatch_span_maps_to_span_kind() {
    let headers = ItemHeaders {
        item_type: "span".into(),
        length: None,
        content_type: None,
    };
    let kind = EnvelopeItemKind::from((headers, b"{}".to_vec()));
    assert!(matches!(kind, EnvelopeItemKind::Span(_)));
}

#[test]
fn test_span_does_not_require_event_id() {
    let kind = EnvelopeItemKind::Span(b"{}".to_vec());
    assert!(!kind.requires_event());
}

#[test]
fn test_span_item_routes_to_span_processor() {
    use rustrak::digest::processors::{route, Route};
    assert_eq!(route(&EnvelopeItemKind::Span(vec![])), Route::Span);
}

// =============================================================================
// Level 2 — SpanProcessor DB behavior (#[tokio::test] + TestDb)
// =============================================================================

#[cfg(test)]
mod level2 {
    use crate::common::TestDb;
    use chrono::Utc;
    use rustrak::digest::processors::{Processor, ProcessorCtx, SpanProcessor};
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
    async fn test_valid_span_stored_with_null_transaction_id() {
        // A standalone span (real Relay wire-format fixture, see
        // tests/integration/test_spans_standalone.py in the story's Dev Notes)
        // must land in the shared `spans` table with transaction_id NULL —
        // it is NOT attached to any transaction.
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-standalone".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "op": "http.client",
            "data": {"http.request.method": "GET"},
            "description": "Test span",
            "parent_span_id": "8a6626cc9bdd5d9b",
            "span_id": "9fd17741416e8e4e",
            "start_timestamp": 1234567890.0,
            "timestamp": 1234567890.5,
            "trace_id": "d3d20f000885466b8c8f947c9b92b8d3",
            "origin": "manual",
            "segment_id": "8a6626cc9bdd5d9b",
            "is_segment": false
        }))
        .unwrap();

        SpanProcessor
            .process(payload, &ctx(&db.pool, project.id))
            .await
            .unwrap();

        #[cfg(feature = "postgres")]
        const QUERY: &str = "SELECT span_id, trace_id, parent_span_id, op, description, transaction_id, duration_ms FROM spans WHERE project_id = $1";
        #[cfg(not(feature = "postgres"))]
        const QUERY: &str = "SELECT span_id, trace_id, parent_span_id, op, description, transaction_id, duration_ms FROM spans WHERE project_id = ?";

        let row = sqlx::query(QUERY)
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap();

        let span_id: Option<String> = row.get("span_id");
        let trace_id: Option<String> = row.get("trace_id");
        let parent_span_id: Option<String> = row.get("parent_span_id");
        let op: Option<String> = row.get("op");
        let description: Option<String> = row.get("description");
        let transaction_id: Option<Uuid> = row.get("transaction_id");
        let duration_ms: Option<f64> = row.get("duration_ms");

        assert_eq!(span_id.as_deref(), Some("9fd17741416e8e4e"));
        assert_eq!(
            trace_id.as_deref(),
            Some("d3d20f000885466b8c8f947c9b92b8d3")
        );
        assert_eq!(parent_span_id.as_deref(), Some("8a6626cc9bdd5d9b"));
        assert_eq!(op.as_deref(), Some("http.client"));
        assert_eq!(description.as_deref(), Some("Test span"));
        assert!(
            transaction_id.is_none(),
            "standalone span must not be linked to a transaction"
        );
        assert_eq!(duration_ms, Some(500.0), "0.5s span -> 500ms");
    }

    #[tokio::test]
    async fn test_span_missing_span_id_is_rejected() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-missing-id".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "trace_id": "d3d20f000885466b8c8f947c9b92b8d3",
            "start_timestamp": 1.0,
            "timestamp": 2.0
        }))
        .unwrap();

        let res = SpanProcessor
            .process(payload, &ctx(&db.pool, project.id))
            .await;
        assert!(res.is_err(), "span without span_id must be rejected");

        #[cfg(feature = "postgres")]
        const COUNT: &str = "SELECT COUNT(*) FROM spans WHERE project_id = $1";
        #[cfg(not(feature = "postgres"))]
        const COUNT: &str = "SELECT COUNT(*) FROM spans WHERE project_id = ?";
        let count: i64 = sqlx::query_scalar(COUNT)
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(count, 0, "no row may be stored for a rejected span");
    }

    #[tokio::test]
    async fn test_span_missing_trace_id_is_rejected() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-missing-trace".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "span_id": "9fd17741416e8e4e",
            "start_timestamp": 1.0,
            "timestamp": 2.0
        }))
        .unwrap();

        let res = SpanProcessor
            .process(payload, &ctx(&db.pool, project.id))
            .await;
        assert!(res.is_err(), "span without trace_id must be rejected");
    }

    #[tokio::test]
    async fn test_span_start_after_end_is_rejected() {
        // Relay: DiscardReason::Timestamp when start_timestamp > timestamp.
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-bad-timing".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "span_id": "9fd17741416e8e4e",
            "trace_id": "d3d20f000885466b8c8f947c9b92b8d3",
            "start_timestamp": 2.0,
            "timestamp": 1.0
        }))
        .unwrap();

        let res = SpanProcessor
            .process(payload, &ctx(&db.pool, project.id))
            .await;
        assert!(
            res.is_err(),
            "span with start_timestamp after timestamp must be rejected"
        );
    }

    #[tokio::test]
    async fn test_span_malformed_json_is_rejected() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-bad-json".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let res = SpanProcessor
            .process(vec![0xff, 0x00, b'n', b'o'], &ctx(&db.pool, project.id))
            .await;
        assert!(res.is_err(), "malformed span JSON must be rejected");
    }

    #[tokio::test]
    async fn test_span_data_column_stores_full_raw_payload() {
        // Mirrors TransactionProcessor::insert_span: the `data` column holds
        // the entire raw span JSON (full fidelity for debugging/future
        // gen_ai.* normalization), not just the nested `data` attributes
        // sub-object — consistent whether a span arrives standalone or
        // embedded in a transaction, since both write into the same table.
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-data-catchall".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "span_id": "9fd17741416e8e4e",
            "trace_id": "d3d20f000885466b8c8f947c9b92b8d3",
            "start_timestamp": 1.0,
            "timestamp": 2.0,
            "data": {"gen_ai.request.model": "gpt-4", "some.unknown.attr": 42}
        }))
        .unwrap();

        SpanProcessor
            .process(payload, &ctx(&db.pool, project.id))
            .await
            .unwrap();

        #[cfg(feature = "postgres")]
        const QUERY: &str = "SELECT data FROM spans WHERE project_id = $1";
        #[cfg(not(feature = "postgres"))]
        const QUERY: &str = "SELECT data FROM spans WHERE project_id = ?";
        let data: serde_json::Value = sqlx::query_scalar(QUERY)
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap();

        assert_eq!(data["span_id"], "9fd17741416e8e4e");
        assert_eq!(data["data"]["gen_ai.request.model"], "gpt-4");
        assert_eq!(data["data"]["some.unknown.attr"], 42);
    }

    // =========================================================================
    // SpanService — list_offset (Task 6)
    // =========================================================================

    async fn store_span(
        pool: &rustrak::db::DbPool,
        project_id: i32,
        span_id: &str,
        trace_id: &str,
        op: &str,
    ) {
        let payload = serde_json::to_vec(&json!({
            "span_id": span_id,
            "trace_id": trace_id,
            "op": op,
            "start_timestamp": 1.0,
            "timestamp": 2.0
        }))
        .unwrap();
        SpanProcessor
            .process(payload, &ctx(pool, project_id))
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn test_list_spans_filters_by_op() {
        use rustrak::services::span::{SpanFilters, SpanService};

        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-svc-filter-op".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        store_span(
            &db.pool,
            project.id,
            "aaaaaaaaaaaaaaaa",
            "trace1",
            "http.client",
        )
        .await;
        store_span(
            &db.pool,
            project.id,
            "bbbbbbbbbbbbbbbb",
            "trace2",
            "db.query",
        )
        .await;

        let filters = SpanFilters {
            op: Some("http.client".to_string()),
            ..Default::default()
        };
        let (list, total) = SpanService::list_offset(&db.pool, project.id, 1, 20, &filters)
            .await
            .unwrap();

        assert_eq!(total, 1, "only the http.client span matches");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].op.as_deref(), Some("http.client"));
    }

    #[tokio::test]
    async fn test_list_spans_by_trace_id_returns_both_standalone_and_transaction_spans() {
        // AC #7: a trace_id query returns spans regardless of origin, since
        // standalone spans and transaction-embedded spans share this table.
        use rustrak::digest::processors::TransactionProcessor;
        use rustrak::services::span::{SpanFilters, SpanService};

        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-svc-cross-origin".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let shared_trace = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

        // A standalone span sharing the trace.
        store_span(
            &db.pool,
            project.id,
            "1111111111111111",
            shared_trace,
            "http.client",
        )
        .await;

        // A transaction whose embedded span carries the SAME trace_id.
        let txn_payload = serde_json::to_vec(&json!({
            "type": "transaction",
            "transaction": "/api/x",
            "start_timestamp": 1.0,
            "timestamp": 2.0,
            "contexts": { "trace": { "trace_id": shared_trace, "span_id": "2222222222222222" } },
            "spans": [
                { "span_id": "3333333333333333", "op": "db.query", "start_timestamp": 1.0, "timestamp": 1.5 }
            ]
        }))
        .unwrap();
        TransactionProcessor
            .process(txn_payload, &ctx(&db.pool, project.id))
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
            "both the standalone span and the transaction-embedded span share this trace_id"
        );
        assert_eq!(list.len(), 2);
    }

    #[tokio::test]
    async fn test_list_spans_standalone_has_no_transaction_id() {
        use rustrak::services::span::{SpanFilters, SpanService};

        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-svc-txn-id".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        store_span(
            &db.pool,
            project.id,
            "4444444444444444",
            "trace4",
            "http.client",
        )
        .await;

        let (list, _) =
            SpanService::list_offset(&db.pool, project.id, 1, 20, &SpanFilters::default())
                .await
                .unwrap();

        assert_eq!(list.len(), 1);
        assert!(
            list[0].transaction_id.is_none(),
            "standalone span response must report no parent transaction"
        );
    }

    // =========================================================================
    // gen_ai.* normalization on standalone spans (story-ai-agent-monitoring.md)
    // =========================================================================

    #[tokio::test]
    async fn test_standalone_ai_span_normalized() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-gen-ai".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "span_id": "5555555555555555",
            "trace_id": "d3d20f000885466b8c8f947c9b92b8d3",
            "start_timestamp": 1.0,
            "timestamp": 2.0,
            "data": {
                "gen_ai.operation.name": "invoke_agent",
                "gen_ai.request.model": "gpt-4o",
                "gen_ai.usage.input_tokens": 1000,
                "gen_ai.usage.output_tokens": 500
            }
        }))
        .unwrap();

        SpanProcessor
            .process(payload, &ctx(&db.pool, project.id))
            .await
            .unwrap();

        #[cfg(feature = "postgres")]
        const QUERY: &str = "SELECT gen_ai_operation_type, gen_ai_response_model, gen_ai_usage_total_tokens FROM spans WHERE project_id = $1";
        #[cfg(not(feature = "postgres"))]
        const QUERY: &str = "SELECT gen_ai_operation_type, gen_ai_response_model, gen_ai_usage_total_tokens FROM spans WHERE project_id = ?";

        let row = sqlx::query(QUERY)
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap();

        let operation_type: Option<String> = row.get("gen_ai_operation_type");
        let response_model: Option<String> = row.get("gen_ai_response_model");
        let total_tokens: Option<f64> = row.get("gen_ai_usage_total_tokens");

        assert_eq!(operation_type.as_deref(), Some("agent"));
        assert_eq!(response_model.as_deref(), Some("gpt-4o"));
        assert_eq!(total_tokens, Some(1500.0));
    }

    #[tokio::test]
    async fn test_non_ai_standalone_span_leaves_gen_ai_columns_null() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "span-not-ai".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "span_id": "6666666666666666",
            "trace_id": "d3d20f000885466b8c8f947c9b92b8d3",
            "op": "http.client",
            "start_timestamp": 1.0,
            "timestamp": 2.0
        }))
        .unwrap();

        SpanProcessor
            .process(payload, &ctx(&db.pool, project.id))
            .await
            .unwrap();

        #[cfg(feature = "postgres")]
        const QUERY: &str = "SELECT gen_ai_operation_type FROM spans WHERE project_id = $1";
        #[cfg(not(feature = "postgres"))]
        const QUERY: &str = "SELECT gen_ai_operation_type FROM spans WHERE project_id = ?";

        let row = sqlx::query(QUERY)
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap();

        let operation_type: Option<String> = row.get("gen_ai_operation_type");

        assert!(
            operation_type.is_none(),
            "non-AI span must not get gen_ai columns populated"
        );
    }
}
