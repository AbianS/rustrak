//! Level 3 integration tests for typed envelope dispatch (spec: spec-transaction-processing.md)
//!
//! Full HTTP → dispatch → DB path. Tests the transaction spawn path in routes/ingest.rs.

use crate::common::TestDb;
use actix_web::{test, web, App};
use rustrak::config::{Config, DatabaseConfig, RateLimitConfig};
use rustrak::routes;
use rustrak::services::{DbSourceMapProvider, LocalSourceMapStore, ProjectService};
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;

fn create_test_config() -> Config {
    Config {
        host: "127.0.0.1".to_string(),
        port: 0,
        database: DatabaseConfig {
            url: "sqlite::memory:".to_string(),
            max_connections: 5,
            min_connections: 1,
            acquire_timeout: Duration::from_secs(5),
            idle_timeout: Duration::from_secs(60),
            max_lifetime: Duration::from_secs(300),
        },
        rate_limit: RateLimitConfig {
            max_events_per_minute: 1000,
            max_events_per_hour: 10000,
            max_events_per_project_per_minute: 500,
            max_events_per_project_per_hour: 5000,
        },
        security: rustrak::config::SecurityConfig {
            ssl_proxy: false,
            session_secret_key: None,
        },
        ingest_dir: Some("/tmp/rustrak_test_ingest_v2".to_string()),
        public_url: None,
        sourcemap_storage_path: "/tmp/test_sourcemaps_v2".to_string(),
        max_chunk_size_bytes: 10 * 1024 * 1024,
        session_flush_interval_secs: 30,
        session_cardinality_cap: 10_000,
    }
}

async fn create_test_project(pool: &rustrak::db::DbPool, name: &str) -> (i32, String) {
    let project = ProjectService::create(
        pool,
        rustrak::models::CreateProject {
            name: name.to_string(),
            slug: None,
            platform: None,
        },
    )
    .await
    .expect("Failed to create test project");
    (project.id, project.sentry_key.to_string())
}

fn transaction_envelope(event_id: &str, project_id: i32, sentry_key: &str) -> Vec<u8> {
    let txn = json!({
        "event_id": event_id,
        "type": "transaction",
        "transaction": "/api/test",
        "start_timestamp": 1704801590.0_f64,
        "timestamp": 1704801600.0_f64,
        "spans": [{"op": "db", "description": "SELECT 1"}]
    });
    let txn_str = txn.to_string();
    let envelope = format!(
        "{}\n{}\n{}\n",
        json!({ "event_id": event_id }),
        json!({ "type": "transaction", "length": txn_str.len() }),
        txn_str
    );
    let _ = (project_id, sentry_key); // used via URL/header
    envelope.into_bytes()
}

fn error_envelope(event_id: &str) -> Vec<u8> {
    let event = json!({
        "event_id": event_id,
        "timestamp": 1704801600.0_f64,
        "platform": "python",
        "level": "error",
        "exception": {
            "values": [{
                "type": "ValueError",
                "value": "something went wrong"
            }]
        }
    });
    let event_str = event.to_string();
    format!(
        "{}\n{}\n{}\n",
        json!({ "event_id": event_id }),
        json!({ "type": "event", "length": event_str.len() }),
        event_str
    )
    .into_bytes()
}

/// Regression guard: error envelope must still work after EnvelopeItemKind refactor.
#[actix_web::test]
async fn test_error_envelope_still_works_after_refactor() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "Error Regression Test").await;
    let config = create_test_config();

    let sourcemap_store = Arc::new(LocalSourceMapStore::new(&config.sourcemap_storage_path))
        as Arc<dyn rustrak::services::SourceMapStore>;
    let sourcemap_provider = Arc::new(DbSourceMapProvider::new(db.pool.clone(), sourcemap_store))
        as Arc<dyn rustrak::services::SourceMapProvider>;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .app_data(web::Data::new(sourcemap_provider))
            .app_data(web::Data::new(
                rustrak::digest::processors::Processors::new(
                    rustrak::ingest::get_ingest_dir(config.ingest_dir.as_deref()),
                    config.rate_limit.clone(),
                    crate::common::null_sourcemap_provider(),
                    None,
                ),
            ))
            .configure(routes::ingest::configure),
    )
    .await;

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let body = error_envelope(&event_id);

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header(("X-Sentry-Auth", format!("Sentry sentry_key={}", sentry_key)))
        .insert_header(("Content-Type", "application/x-sentry-envelope"))
        .set_payload(body)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(
        resp.status().as_u16(),
        200,
        "error envelope must return 200"
    );

    let body: serde_json::Value = test::read_body_json(resp).await;
    assert!(body.get("id").is_some(), "response must include event id");
}

/// Transaction-only envelope must return 200 with an id, then the spawned
/// processor stores the row. We verify the response and poll (bounded) for the
/// asynchronously-stored `events` row.
#[actix_web::test]
async fn test_transaction_envelope_returns_200_with_id() {
    let db = TestDb::new().await;
    let (project_id, sentry_key) = create_test_project(&db.pool, "Transaction Ingest Test").await;
    let config = create_test_config();

    let sourcemap_store = Arc::new(LocalSourceMapStore::new(&config.sourcemap_storage_path))
        as Arc<dyn rustrak::services::SourceMapStore>;
    let sourcemap_provider = Arc::new(DbSourceMapProvider::new(db.pool.clone(), sourcemap_store))
        as Arc<dyn rustrak::services::SourceMapProvider>;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .app_data(web::Data::new(sourcemap_provider))
            .app_data(web::Data::new(
                rustrak::digest::processors::Processors::new(
                    rustrak::ingest::get_ingest_dir(config.ingest_dir.as_deref()),
                    config.rate_limit.clone(),
                    crate::common::null_sourcemap_provider(),
                    None,
                ),
            ))
            .configure(routes::ingest::configure),
    )
    .await;

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let body = transaction_envelope(&event_id, project_id, &sentry_key);

    let req = test::TestRequest::post()
        .uri(&format!("/api/{}/envelope/", project_id))
        .insert_header(("X-Sentry-Auth", format!("Sentry sentry_key={}", sentry_key)))
        .insert_header(("Content-Type", "application/x-sentry-envelope"))
        .set_payload(body)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(
        resp.status().as_u16(),
        200,
        "transaction envelope must return 200"
    );

    let body: serde_json::Value = test::read_body_json(resp).await;
    assert!(body.get("id").is_some(), "response must include event id");

    // The processor runs in a spawned task; poll (bounded) instead of a fixed
    // sleep so the assertion isn't flaky on slower CI runners.
    #[cfg(feature = "postgres")]
    const COUNT_QUERY: &str = "SELECT COUNT(*) FROM transactions WHERE project_id = $1";
    #[cfg(not(feature = "postgres"))]
    const COUNT_QUERY: &str = "SELECT COUNT(*) FROM transactions WHERE project_id = ?";

    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(2);
    let stored: i64 = loop {
        let count: i64 = sqlx::query_scalar(COUNT_QUERY)
            .bind(project_id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
        if count > 0 || tokio::time::Instant::now() >= deadline {
            break count;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    };

    assert_eq!(
        stored, 1,
        "transaction must be stored in the dedicated transactions table"
    );
}
