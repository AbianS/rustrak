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
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM events WHERE project_id = ?")
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

        let (page1, _) = TransactionService::list_offset(&db.pool, project.id, 1, 2)
            .await
            .unwrap();
        assert_eq!(page1.len(), 2);

        let (page2, _) = TransactionService::list_offset(&db.pool, project.id, 2, 2)
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
            "SELECT event_type, start_timestamp, spans FROM events WHERE project_id = ?",
        )
        .bind(project.id)
        .fetch_one(&db.pool)
        .await
        .unwrap();

        let event_type: String = row.get("event_type");
        let start_timestamp: Option<String> = row.try_get("start_timestamp").ok().flatten();
        let spans: Option<String> = row.try_get("spans").ok().flatten();

        assert_eq!(event_type, "transaction");
        assert!(
            start_timestamp.is_some(),
            "start_timestamp must not be NULL"
        );
        assert!(spans.is_some(), "spans must not be NULL");
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

        let event_type: String =
            sqlx::query_scalar("SELECT event_type FROM events WHERE project_id = ?")
                .bind(project.id)
                .fetch_one(&db.pool)
                .await
                .unwrap();
        assert_eq!(event_type, "transaction");
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
