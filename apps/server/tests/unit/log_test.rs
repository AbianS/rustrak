//! Unit tests for the Sentry log item-container model (OurLog).
//!
//! Logs arrive batched in an item container: `{"items":[OurLog, ...]}`.
//! These tests cover expanding that container into individual `LogItem`s.

use rustrak::digest::processors::{route, Route};
use rustrak::ingest::envelope::EnvelopeItemKind;
use rustrak::models::log::LogContainer;

#[test]
fn test_log_item_routes_to_log_processor() {
    let kind = EnvelopeItemKind::Log(b"{}".to_vec());
    assert_eq!(route(&kind), Route::Log);
}

#[test]
fn test_log_does_not_require_event_id() {
    let kind = EnvelopeItemKind::Log(b"{}".to_vec());
    assert!(!kind.requires_event());
}

#[test]
fn test_parse_container_yields_logs() {
    let body = br#"{"items":[{
        "timestamp":1544719860.0,
        "trace_id":"5b8efff798038103d269b633813fc60c",
        "span_id":"eee19b7ec3c1b174",
        "level":"info",
        "body":"Example log record",
        "attributes":{"string.attribute":{"value":"some string","type":"string"}}
    }]}"#;

    let logs = LogContainer::parse(body).unwrap();

    assert_eq!(logs.len(), 1);
    let log = &logs[0];
    assert_eq!(log.trace_id, "5b8efff798038103d269b633813fc60c");
    assert_eq!(log.span_id.as_deref(), Some("eee19b7ec3c1b174"));
    assert_eq!(log.level, "info");
    assert_eq!(log.body, "Example log record");
}

// =============================================================================
// Level 2 — LogsProcessor DB behavior (#[tokio::test] + TestDb)
// =============================================================================

#[cfg(test)]
mod level2 {
    use crate::common::TestDb;
    use chrono::Utc;
    use rustrak::digest::processors::{LogsProcessor, Processor, ProcessorCtx};
    use rustrak::models::CreateProject;
    use rustrak::services::ProjectService;
    use sqlx::Row;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_log_container_expanded_into_rows() {
        // A log container with N items must produce N rows in the `logs` table,
        // with denormalized level/body/trace_id columns populated per item.
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "logs-store".to_string(),
                slug: None,
                platform: None,
            },
        )
        .await
        .unwrap();

        let body = br#"{"items":[
            {"timestamp":1704801600.0,"trace_id":"5b8efff798038103d269b633813fc60c","span_id":"eee19b7ec3c1b174","level":"error","body":"boom","attributes":{"k":{"value":"v","type":"string"}}},
            {"timestamp":1704801601.0,"trace_id":"5b8efff798038103d269b633813fc60c","level":"info","body":"ok"}
        ]}"#
        .to_vec();

        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        LogsProcessor.process(body.clone(), &ctx).await.unwrap();
        LogsProcessor.process(body, &ctx).await.unwrap();

        #[cfg(feature = "postgres")]
        const QUERY: &str =
            "SELECT level, body, trace_id FROM logs WHERE project_id = $1 ORDER BY timestamp";
        #[cfg(not(feature = "postgres"))]
        const QUERY: &str =
            "SELECT level, body, trace_id FROM logs WHERE project_id = ? ORDER BY timestamp";

        let rows = sqlx::query(QUERY)
            .bind(project.id)
            .fetch_all(&db.pool)
            .await
            .unwrap();

        assert_eq!(
            rows.len(),
            2,
            "replaying a container must not duplicate rows"
        );
        let level0: String = rows[0].get("level");
        let body0: String = rows[0].get("body");
        let trace0: String = rows[0].get("trace_id");
        assert_eq!(level0, "error");
        assert_eq!(body0, "boom");
        assert_eq!(trace0, "5b8efff798038103d269b633813fc60c");
    }

    async fn store_sample_logs(pool: &rustrak::db::DbPool, project_id: i32) {
        let body = br#"{"items":[
            {"timestamp":1704801600.0,"trace_id":"aaaa","level":"error","body":"boom"},
            {"timestamp":1704801601.0,"trace_id":"bbbb","level":"info","body":"ok"}
        ]}"#
        .to_vec();
        let ctx = ProcessorCtx {
            pool: pool.clone(),
            project_id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };
        LogsProcessor.process(body, &ctx).await.unwrap();
    }

    #[tokio::test]
    async fn test_non_object_attributes_coerced_to_empty_object() {
        // A non-conforming SDK may send `attributes` as an array/primitive.
        // The stored column must always hold a JSON object so the read API and
        // client schema (z.record) never choke on one bad row.
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "logs-bad-attrs".to_string(),
                slug: None,
                platform: None,
            },
        )
        .await
        .unwrap();

        let body = br#"{"items":[
            {"timestamp":1704801600.0,"trace_id":"aaaa","level":"info","body":"x","attributes":[1,2,3]}
        ]}"#
        .to_vec();
        let ctx = ProcessorCtx {
            pool: db.pool.clone(),
            project_id: project.id,
            event_id: Uuid::new_v4(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };
        LogsProcessor.process(body, &ctx).await.unwrap();

        #[cfg(feature = "postgres")]
        const QUERY: &str = "SELECT attributes FROM logs WHERE project_id = $1";
        #[cfg(not(feature = "postgres"))]
        const QUERY: &str = "SELECT attributes FROM logs WHERE project_id = ?";

        let stored: serde_json::Value = sqlx::query_scalar(QUERY)
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert!(
            stored.is_object(),
            "non-object attributes must be coerced to an object, got {stored}"
        );
    }

    #[tokio::test]
    async fn test_list_logs_returns_stored_newest_first() {
        use rustrak::services::log::{LogFilters, LogService};
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "logs-list".to_string(),
                slug: None,
                platform: None,
            },
        )
        .await
        .unwrap();
        store_sample_logs(&db.pool, project.id).await;

        let (logs, total) =
            LogService::list_offset(&db.pool, project.id, 1, 50, &LogFilters::default())
                .await
                .unwrap();

        assert_eq!(total, 2);
        assert_eq!(logs.len(), 2);
        // Newest timestamp first: the info log (ts 1704801601) precedes the error.
        assert_eq!(logs[0].body, "ok");
        assert_eq!(logs[0].level, "info");
        assert_eq!(logs[1].body, "boom");
    }

    #[tokio::test]
    async fn test_list_logs_filters_by_level() {
        use rustrak::services::log::{LogFilters, LogService};
        let db = TestDb::new().await;
        let project = ProjectService::create(
            &db.pool,
            CreateProject {
                name: "logs-filter".to_string(),
                slug: None,
                platform: None,
            },
        )
        .await
        .unwrap();
        store_sample_logs(&db.pool, project.id).await;

        let filters = LogFilters {
            level: Some("error".to_string()),
            ..Default::default()
        };
        let (logs, total) = LogService::list_offset(&db.pool, project.id, 1, 50, &filters)
            .await
            .unwrap();

        assert_eq!(total, 1);
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].level, "error");
    }
}
