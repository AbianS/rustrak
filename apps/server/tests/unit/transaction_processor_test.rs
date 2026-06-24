//! TDD tests for the typed envelope dispatch pipeline (spec: spec-transaction-processing.md)
//!
//! Level 1 — pure unit tests, no DB, no async.
//! Level 2 — processor DB behavior tests, #[tokio::test] + TestDb.

use rustrak::ingest::envelope::{EnvelopeItemKind, ItemHeaders};
use rustrak::ingest::parser::EnvelopeParser;

// =============================================================================
// Level 1 — Pure enum dispatch tests (no DB, no async)
// =============================================================================

#[test]
fn test_enum_dispatch_transaction_maps_to_transaction_kind() {
    let headers = ItemHeaders {
        item_type: "transaction".into(),
        length: None,
        content_type: None,
    };
    let kind = EnvelopeItemKind::from((headers, b"{}".to_vec()));
    assert!(matches!(kind, EnvelopeItemKind::Transaction(_)));
}

#[test]
fn test_enum_dispatch_event_maps_to_event_kind() {
    let headers = ItemHeaders {
        item_type: "event".into(),
        length: None,
        content_type: None,
    };
    let kind = EnvelopeItemKind::from((headers, b"{}".to_vec()));
    assert!(matches!(kind, EnvelopeItemKind::Event(_)));
}

#[test]
fn test_transaction_never_becomes_event_item() {
    // Regression guard for fb52e1e: transaction items must NEVER land in Event variant
    let raw = b"{\"event_id\":\"9ec79c33ec9942ab8353589fcb2e04dc\"}\n{\"type\":\"transaction\",\"length\":2}\n{}\n";
    let mut parser = EnvelopeParser::new(raw);
    let items = parser.parse().unwrap().items;
    assert!(
        items
            .iter()
            .all(|i| !matches!(i, EnvelopeItemKind::Event(_))),
        "transaction item must not be classified as Event"
    );
}

#[test]
fn test_requires_event_true_for_transaction() {
    let kind = EnvelopeItemKind::Transaction(vec![]);
    assert!(kind.requires_event());
}

#[test]
fn test_requires_event_true_for_event() {
    let kind = EnvelopeItemKind::Event(vec![]);
    assert!(kind.requires_event());
}

#[test]
fn test_requires_event_false_for_session() {
    use rustrak::models::session::SessionUpdate;
    let kind = EnvelopeItemKind::Session(SessionUpdate::default());
    assert!(!kind.requires_event());
}

// =============================================================================
// Level 1 — Processor routing (pure: item -> which processor handles it)
// =============================================================================

#[test]
fn test_event_item_routes_to_error_processor() {
    use rustrak::digest::processors::{route, Route};
    assert_eq!(route(&EnvelopeItemKind::Event(vec![])), Route::Error);
}

#[test]
fn test_transaction_item_routes_to_transaction_processor() {
    use rustrak::digest::processors::{route, Route};
    assert_eq!(
        route(&EnvelopeItemKind::Transaction(vec![])),
        Route::Transaction
    );
}

#[test]
fn test_session_item_routes_to_session_processor() {
    use rustrak::digest::processors::{route, Route};
    use rustrak::models::session::SessionUpdate;
    assert_eq!(
        route(&EnvelopeItemKind::Session(SessionUpdate::default())),
        Route::Session
    );
}

#[test]
fn test_unknown_item_routes_to_ignored() {
    use rustrak::digest::processors::{route, Route};
    assert_eq!(
        route(&EnvelopeItemKind::Other("span".into(), vec![])),
        Route::Ignored
    );
}

// =============================================================================
// Level 2 — Processor DB behavior tests (#[tokio::test] + TestDb)
// =============================================================================

#[cfg(test)]
mod level2 {
    use crate::common::TestDb;
    use chrono::Utc;
    use rustrak::digest::processors::{Processor, ProcessorCtx, TransactionProcessor};
    use rustrak::models::CreateProject;
    use rustrak::services::ProjectService;
    use serde_json::json;
    use sqlx::Row;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_transaction_stored_in_dedicated_transactions_table() {
        // A transaction must land in the dedicated `transactions` table, not
        // be overloaded onto `events`. duration_ms is precomputed at write time
        // from (timestamp - start_timestamp), in milliseconds.
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-dedicated".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "type": "transaction",
            "transaction": "/api/users",
            "start_timestamp": 1704801590.0,
            "timestamp": 1704801600.0,
            "spans": [{"op": "db", "description": "SELECT 1"}]
        }))
        .unwrap();

        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        TransactionProcessor.process(payload, &ctx).await.unwrap();

        let row = sqlx::query(
            "SELECT transaction_name, duration_ms FROM transactions WHERE project_id = ?",
        )
        .bind(project.id)
        .fetch_one(&db.pool)
        .await
        .unwrap();

        let name: String = row.get("transaction_name");
        let duration_ms: f64 = row.get("duration_ms");
        assert_eq!(name, "/api/users");
        assert_eq!(duration_ms, 10_000.0, "10s transaction → 10000ms");
    }

    #[tokio::test]
    async fn test_transaction_normalizes_trace_context_to_columns() {
        // Relay denormalizes contexts.trace.{op,status,span_id} and the trace_id
        // into queryable columns. Rustrak must do the same so the list view can
        // filter by op/status without parsing JSON on every row.
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-trace-ctx".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "type": "transaction",
            "transaction": "/api/checkout",
            "start_timestamp": 1.0,
            "timestamp": 2.0,
            "contexts": {
                "trace": {
                    "trace_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    "span_id": "bbbbbbbbbbbbbbbb",
                    "parent_span_id": "cccccccccccccccc",
                    "op": "http.server",
                    "status": "ok"
                }
            }
        }))
        .unwrap();

        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        TransactionProcessor.process(payload, &ctx).await.unwrap();

        let row = sqlx::query(
            "SELECT op, status, span_id, parent_span_id, trace_id FROM transactions WHERE project_id = ?",
        )
        .bind(project.id)
        .fetch_one(&db.pool)
        .await
        .unwrap();

        let op: Option<String> = row.get("op");
        let status: Option<String> = row.get("status");
        let span_id: Option<String> = row.get("span_id");
        let parent_span_id: Option<String> = row.get("parent_span_id");
        let trace_id: Option<String> = row.get("trace_id");

        assert_eq!(op.as_deref(), Some("http.server"));
        assert_eq!(status.as_deref(), Some("ok"));
        assert_eq!(span_id.as_deref(), Some("bbbbbbbbbbbbbbbb"));
        assert_eq!(parent_span_id.as_deref(), Some("cccccccccccccccc"));
        assert_eq!(
            trace_id.as_deref(),
            Some("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        );
    }

    #[tokio::test]
    async fn test_transaction_source_known_value_stored_verbatim() {
        // transaction_info.source carries Relay's TransactionSource. Known values
        // (url/route/...) are stored verbatim into the `source` column.
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-source-url".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "type": "transaction",
            "transaction": "/users/:id",
            "timestamp": 2.0,
            "transaction_info": { "source": "route" }
        }))
        .unwrap();

        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };
        TransactionProcessor.process(payload, &ctx).await.unwrap();

        let source: String =
            sqlx::query_scalar("SELECT source FROM transactions WHERE project_id = ?")
                .bind(project.id)
                .fetch_one(&db.pool)
                .await
                .unwrap();
        assert_eq!(source, "route");
    }

    #[tokio::test]
    async fn test_transaction_source_defaults_to_unknown_when_absent() {
        // No transaction_info → Relay's TransactionSource default is Unknown.
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-source-default".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "type": "transaction",
            "transaction": "/health",
            "timestamp": 2.0
        }))
        .unwrap();

        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };
        TransactionProcessor.process(payload, &ctx).await.unwrap();

        let source: String =
            sqlx::query_scalar("SELECT source FROM transactions WHERE project_id = ?")
                .bind(project.id)
                .fetch_one(&db.pool)
                .await
                .unwrap();
        assert_eq!(source, "unknown");
    }

    #[tokio::test]
    async fn test_transaction_spans_extracted_to_indexed_rows() {
        // Relay extracts each span in the `spans` array into a standalone indexed
        // row (DataCategory::SpanIndexed). Rustrak stores them in the `spans`
        // table, linked to the transaction, individually queryable by op/trace.
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-span-extract".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "type": "transaction",
            "transaction": "/api/x",
            "start_timestamp": 1.0,
            "timestamp": 2.0,
            "contexts": {
                "trace": { "trace_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "span_id": "bbbbbbbbbbbbbbbb" }
            },
            "spans": [
                { "span_id": "cccccccccccccccc", "parent_span_id": "bbbbbbbbbbbbbbbb",
                  "op": "db.query", "description": "SELECT 1", "status": "ok",
                  "start_timestamp": 1.0, "timestamp": 1.5 },
                { "span_id": "dddddddddddddddd", "parent_span_id": "cccccccccccccccc",
                  "op": "http.client", "description": "GET /x",
                  "start_timestamp": 1.5, "timestamp": 1.8 }
            ]
        }))
        .unwrap();

        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };
        TransactionProcessor.process(payload, &ctx).await.unwrap();

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM spans WHERE project_id = ?")
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(
            count, 2,
            "both spans must be extracted into the spans table"
        );

        let row = sqlx::query(
            "SELECT op, description, status, duration_ms, trace_id, parent_span_id FROM spans WHERE span_id = ?",
        )
        .bind("cccccccccccccccc")
        .fetch_one(&db.pool)
        .await
        .unwrap();

        let op: Option<String> = row.get("op");
        let description: Option<String> = row.get("description");
        let status: Option<String> = row.get("status");
        let duration_ms: f64 = row.get("duration_ms");
        let trace_id: Option<String> = row.get("trace_id");
        let parent_span_id: Option<String> = row.get("parent_span_id");

        assert_eq!(op.as_deref(), Some("db.query"));
        assert_eq!(description.as_deref(), Some("SELECT 1"));
        assert_eq!(status.as_deref(), Some("ok"));
        assert_eq!(duration_ms, 500.0, "0.5s span → 500ms");
        assert_eq!(
            trace_id.as_deref(),
            Some("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
            "span inherits the transaction trace_id when not carried on the span"
        );
        assert_eq!(parent_span_id.as_deref(), Some("bbbbbbbbbbbbbbbb"));
    }

    #[tokio::test]
    async fn test_transaction_malformed_json_is_rejected_not_stored() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-bad-json".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        // Binary garbage some misconfigured SDKs send — not valid JSON.
        let res = TransactionProcessor
            .process(vec![0xff, 0x00, 0x01, b'n', b'o'], &ctx)
            .await;

        assert!(res.is_err(), "malformed transaction JSON must be rejected");
        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM transactions WHERE project_id = ?")
                .bind(project.id)
                .fetch_one(&db.pool)
                .await
                .unwrap();
        assert_eq!(count, 0, "no row may be stored for a malformed payload");
    }

    #[tokio::test]
    async fn test_transaction_pagination_no_skip_on_equal_timestamps() {
        use rustrak::services::TransactionService;

        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-paging".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        // Three transactions that all share the SAME ingested_at (page boundary).
        let ts = Utc::now();
        for _ in 0..3 {
            let ctx = ProcessorCtx {
                pool: db.pool.clone(),
                project_id: project.id,
                event_id: Uuid::new_v4(),
                ingested_at: ts,
                remote_addr: None,
            };
            let payload = serde_json::to_vec(&json!({
                "type": "transaction", "transaction": "/x",
                "start_timestamp": 1.0, "timestamp": 2.0
            }))
            .unwrap();
            TransactionProcessor.process(payload, &ctx).await.unwrap();
        }

        let filters = rustrak::services::TransactionFilters::default();
        let (page1, _) = TransactionService::list_offset(&db.pool, project.id, 1, 2, &filters)
            .await
            .unwrap();
        assert_eq!(page1.len(), 2);

        let (page2, _) = TransactionService::list_offset(&db.pool, project.id, 2, 2, &filters)
            .await
            .unwrap();

        assert_eq!(
            page1.len() + page2.len(),
            3,
            "no transaction may be skipped at an equal-timestamp page boundary"
        );
    }

    #[tokio::test]
    async fn test_transaction_stores_to_db_with_correct_fields() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-test".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "type": "transaction",
            "transaction": "/api/users",
            "start_timestamp": 1704801590.0,
            "timestamp": 1704801600.0,
            "spans": [{"op": "db", "description": "SELECT 1"}]
        }))
        .unwrap();

        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        TransactionProcessor.process(payload, &ctx).await.unwrap();

        let row = sqlx::query(
            "SELECT transaction_name, start_timestamp FROM transactions WHERE project_id = ?",
        )
        .bind(project.id)
        .fetch_one(&db.pool)
        .await
        .unwrap();

        let transaction_name: String = row.get("transaction_name");
        let start_timestamp: Option<String> = row.try_get("start_timestamp").ok().flatten();

        assert_eq!(transaction_name, "/api/users");
        assert!(
            start_timestamp.is_some(),
            "start_timestamp must not be NULL"
        );
    }

    #[tokio::test]
    async fn test_transaction_processor_impl_stores_via_trait() {
        use rustrak::digest::processors::Processor;

        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-trait".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "type": "transaction",
            "transaction": "/api/trait",
            "start_timestamp": 1704801590.0,
            "timestamp": 1704801600.0,
            "spans": [{"op": "db", "description": "SELECT 1"}]
        }))
        .unwrap();

        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        // Drive the trait into existence: dispatch through the Processor contract.
        TransactionProcessor.process(payload, &ctx).await.unwrap();

        let name: String =
            sqlx::query_scalar("SELECT transaction_name FROM transactions WHERE project_id = ?")
                .bind(project.id)
                .fetch_one(&db.pool)
                .await
                .unwrap();
        assert_eq!(name, "/api/trait");
    }

    #[tokio::test]
    async fn test_session_processor_forwards_update_to_aggregator() {
        use rustrak::digest::processors::{Processor, SessionItem, SessionProcessor};
        use rustrak::models::session::{SessionAttributes, SessionStatus, SessionUpdate};
        use rustrak::workers::session_aggregator::SessionAggregator;

        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "sess-fwd".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let handle = SessionAggregator::new(db.pool.clone(), 3600, 1000);
        let processor = SessionProcessor::new(Some(handle.clone()));

        let update = SessionUpdate {
            sid: Some("sid-1".to_string()),
            did: None,
            seq: Some(0),
            init: true,
            started: Some("2026-06-10T10:00:00.000Z".to_string()),
            timestamp: None,
            duration: None,
            status: Some(SessionStatus::Ok),
            errors: 0,
            attrs: Some(SessionAttributes {
                release: Some("1.0.0".to_string()),
                environment: Some("production".to_string()),
            }),
        };

        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        processor
            .process(SessionItem::Update(update), &ctx)
            .await
            .unwrap();
        handle.flush().await;

        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM session_counts WHERE project_id = ?")
                .bind(project.id)
                .fetch_one(&db.pool)
                .await
                .unwrap();
        assert!(
            count >= 1,
            "session must be aggregated and flushed to session_counts"
        );
    }

    #[tokio::test]
    async fn test_list_transactions_filters_by_op() {
        use rustrak::services::{TransactionFilters, TransactionService};

        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-filter-op".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        for op in ["http.server", "db.query"] {
            let ctx = ProcessorCtx {
                pool: db.pool.clone(),
                project_id: project.id,
                event_id: Uuid::new_v4(),
                ingested_at: Utc::now(),
                remote_addr: None,
            };
            let payload = serde_json::to_vec(&json!({
                "type": "transaction", "transaction": "/x", "timestamp": 2.0,
                "contexts": { "trace": { "op": op } }
            }))
            .unwrap();
            TransactionProcessor.process(payload, &ctx).await.unwrap();
        }

        let filters = TransactionFilters {
            op: Some("http.server".to_string()),
            ..Default::default()
        };
        let (list, total) = TransactionService::list_offset(&db.pool, project.id, 1, 20, &filters)
            .await
            .unwrap();

        assert_eq!(
            total, 1,
            "only the http.server transaction matches the filter"
        );
        assert_eq!(list.len(), 1);
    }

    #[tokio::test]
    async fn test_list_transactions_filters_by_name() {
        // Drilling into a grouped row needs to list only that transaction's
        // samples — so the list must filter by exact transaction_name.
        use rustrak::services::{TransactionFilters, TransactionService};

        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-filter-name".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        for name in ["/api/users", "/api/users", "/api/checkout"] {
            let ctx = ProcessorCtx {
                pool: db.pool.clone(),
                project_id: project.id,
                event_id: Uuid::new_v4(),
                ingested_at: Utc::now(),
                remote_addr: None,
            };
            let payload = serde_json::to_vec(&json!({
                "type": "transaction", "transaction": name, "timestamp": 2.0,
                "contexts": { "trace": { "op": "http.server" } }
            }))
            .unwrap();
            TransactionProcessor.process(payload, &ctx).await.unwrap();
        }

        let filters = TransactionFilters {
            name: Some("/api/users".to_string()),
            ..Default::default()
        };
        let (list, total) = TransactionService::list_offset(&db.pool, project.id, 1, 20, &filters)
            .await
            .unwrap();

        assert_eq!(total, 2, "only the two /api/users samples match");
        assert!(list.iter().all(|t| t.transaction_name == "/api/users"));
    }

    #[tokio::test]
    async fn test_list_spans_returns_extracted_spans_ordered() {
        use rustrak::services::TransactionService;

        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-list-spans".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };
        let payload = serde_json::to_vec(&json!({
            "type": "transaction", "transaction": "/api/x",
            "start_timestamp": 1.0, "timestamp": 2.0,
            "contexts": { "trace": { "trace_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "span_id": "bbbbbbbbbbbbbbbb" } },
            "spans": [
                { "span_id": "dddddddddddddddd", "op": "http.client", "start_timestamp": 1.5, "timestamp": 1.8 },
                { "span_id": "cccccccccccccccc", "op": "db.query", "start_timestamp": 1.0, "timestamp": 1.5 }
            ]
        }))
        .unwrap();
        TransactionProcessor.process(payload, &ctx).await.unwrap();

        let txn_id: Uuid = sqlx::query_scalar("SELECT id FROM transactions WHERE project_id = ?")
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap();

        let spans = TransactionService::list_spans(&db.pool, project.id, txn_id)
            .await
            .unwrap();

        assert_eq!(spans.len(), 2);
        // Ordered by start_timestamp ASC → db.query (1.0) before http.client (1.5).
        assert_eq!(spans[0].op.as_deref(), Some("db.query"));
        assert_eq!(spans[1].op.as_deref(), Some("http.client"));
        assert_eq!(spans[0].duration_ms, Some(500.0));
    }

    #[tokio::test]
    async fn test_transaction_stats_aggregates_per_name_and_op() {
        use rustrak::services::TransactionService;

        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-stats".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        // Group "/a" (http.server): 3 transactions, durations 100/200/300ms,
        // one failed (status != ok). Group "/b" (db): 1 transaction.
        let samples = [
            ("/a", "http.server", 0.0, 0.1, Some("ok")),
            ("/a", "http.server", 0.0, 0.2, Some("internal_error")),
            ("/a", "http.server", 0.0, 0.3, Some("ok")),
            ("/b", "db", 0.0, 0.05, Some("ok")),
        ];
        for (name, op, start, end, status) in samples {
            let ctx = ProcessorCtx {
                pool: db.pool.clone(),
                project_id: project.id,
                event_id: Uuid::new_v4(),
                ingested_at: Utc::now(),
                remote_addr: None,
            };
            let payload = serde_json::to_vec(&json!({
                "type": "transaction", "transaction": name,
                "start_timestamp": start, "timestamp": end,
                "contexts": { "trace": { "op": op, "status": status } }
            }))
            .unwrap();
            TransactionProcessor.process(payload, &ctx).await.unwrap();
        }

        let (stats, total) = TransactionService::stats(&db.pool, project.id, 1, 20)
            .await
            .unwrap();
        assert_eq!(total, 2, "two (name, op) groups total");
        assert_eq!(stats.len(), 2, "two (name, op) groups");

        let a = stats
            .iter()
            .find(|s| s.transaction_name == "/a")
            .expect("group /a present");
        assert_eq!(a.op.as_deref(), Some("http.server"));
        assert_eq!(a.count, 3);
        assert_eq!(a.p50_ms, 200.0, "median of 100/200/300");
        assert!(
            (a.failure_rate - 1.0 / 3.0).abs() < 1e-9,
            "1 of 3 failed → ~0.333"
        );
    }

    #[tokio::test]
    async fn test_transaction_stats_are_paginated() {
        use rustrak::services::TransactionService;

        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-stats-paging".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        // Five distinct (name, op) groups.
        for i in 0..5 {
            let ctx = ProcessorCtx {
                pool: db.pool.clone(),
                project_id: project.id,
                event_id: Uuid::new_v4(),
                ingested_at: Utc::now(),
                remote_addr: None,
            };
            let payload = serde_json::to_vec(&json!({
                "type": "transaction", "transaction": format!("/g{i}"),
                "start_timestamp": 0.0, "timestamp": 0.1,
                "contexts": { "trace": { "op": "http.server" } }
            }))
            .unwrap();
            TransactionProcessor.process(payload, &ctx).await.unwrap();
        }

        let (page1, total) = TransactionService::stats(&db.pool, project.id, 1, 2)
            .await
            .unwrap();
        assert_eq!(total, 5, "total reflects all groups, not the page size");
        assert_eq!(page1.len(), 2, "page is limited to per_page groups");

        let (page3, _) = TransactionService::stats(&db.pool, project.id, 3, 2)
            .await
            .unwrap();
        assert_eq!(page3.len(), 1, "last page has the remaining group");
    }

    #[tokio::test]
    async fn test_transaction_does_not_create_grouping() {
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "txn-no-group".to_string(),
                slug: None,
            },
        )
        .await
        .unwrap();

        let payload = serde_json::to_vec(&json!({
            "type": "transaction",
            "transaction": "/health",
            "start_timestamp": 1704801590.0,
            "timestamp": 1704801600.0,
            "spans": []
        }))
        .unwrap();

        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        TransactionProcessor.process(payload, &ctx).await.unwrap();

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM groupings")
            .fetch_one(&db.pool)
            .await
            .unwrap();

        assert_eq!(
            count, 0,
            "TransactionProcessor must not create any groupings"
        );
    }
}
