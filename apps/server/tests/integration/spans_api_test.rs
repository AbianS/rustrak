//! Integration tests for the Spans API
//!
//! Tests GET /api/projects/{id}/spans with a real database.

use crate::common::TestDb;
use actix_web::{test, web, App};
use chrono::Utc;
use rustrak::config::{Config, DatabaseConfig, RateLimitConfig};
use rustrak::digest::processors::{Processor, ProcessorCtx, SpanProcessor};
use rustrak::models::CreateProject;
use rustrak::routes;
use rustrak::services::{AuthTokenService, ProjectService};
use serde_json::{json, Value};
use std::time::Duration as StdDuration;
use uuid::Uuid;

fn create_test_config() -> Config {
    Config {
        host: "127.0.0.1".to_string(),
        port: 0,
        database: DatabaseConfig {
            url: "postgres://test:test@localhost/test".to_string(),
            max_connections: 5,
            min_connections: 1,
            acquire_timeout: StdDuration::from_secs(5),
            idle_timeout: StdDuration::from_secs(60),
            max_lifetime: StdDuration::from_secs(300),
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
        ingest_dir: None,
        public_url: None,
        sourcemap_storage_path: "/tmp/test_sourcemaps".to_string(),
        max_chunk_size_bytes: 10 * 1024 * 1024,
        session_flush_interval_secs: 30,
        session_cardinality_cap: 10_000,
    }
}

async fn create_test_token(pool: &rustrak::db::DbPool) -> String {
    AuthTokenService::create(
        pool,
        rustrak::models::CreateAuthToken {
            description: Some("Test token".to_string()),
        },
    )
    .await
    .expect("Failed to create test token")
    .token
}

async fn store_sample_spans(pool: &rustrak::db::DbPool, project_id: i32) {
    for (span_id, trace_id, op, status) in [
        ("aaaaaaaaaaaaaaaa", "trace-a", "http.client", "ok"),
        ("bbbbbbbbbbbbbbbb", "trace-b", "db.query", "internal_error"),
    ] {
        let payload = serde_json::to_vec(&json!({
            "span_id": span_id,
            "trace_id": trace_id,
            "op": op,
            "status": status,
            "start_timestamp": 1.0,
            "timestamp": 2.0
        }))
        .unwrap();
        let ctx = ProcessorCtx {
            pool: pool.clone(),
            project_id,
            event_id: Uuid::nil(),
            ingested_at: Utc::now(),
            remote_addr: None,
        };
        SpanProcessor.process(payload, &ctx).await.unwrap();
    }
}

#[actix_web::test]
async fn test_list_spans_returns_stored_spans() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project = ProjectService::create(
        &pool,
        CreateProject {
            name: "Spans List Test".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    store_sample_spans(&pool, project.id).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::spans::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/spans", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total_count"], 2);
    let items = body["items"].as_array().expect("items is array");
    assert_eq!(items.len(), 2);
}

#[actix_web::test]
async fn test_list_spans_filters_by_trace_id() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project = ProjectService::create(
        &pool,
        CreateProject {
            name: "Spans Filter Test".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    store_sample_spans(&pool, project.id).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::spans::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/spans?trace_id=trace-a",
            project.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total_count"], 1);
    let items = body["items"].as_array().expect("items is array");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["trace_id"], "trace-a");
    assert!(
        items[0]["transaction_id"].is_null(),
        "standalone span must report no transaction_id"
    );
}

#[actix_web::test]
async fn test_list_spans_filters_by_op() {
    // Task 9 explicitly calls for an HTTP-level op filter test — the
    // service-level equivalent (SpanService::list_offset) doesn't exercise
    // the `ListSpansQuery` deserialization/query-param boundary.
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project = ProjectService::create(
        &pool,
        CreateProject {
            name: "Spans Op Filter Test".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    store_sample_spans(&pool, project.id).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::spans::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/spans?op=db.query", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total_count"], 1);
    let items = body["items"].as_array().expect("items is array");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["op"], "db.query");
}

#[actix_web::test]
async fn test_list_spans_filters_by_status() {
    // SpanFilters::status had zero test coverage anywhere before this —
    // closing that gap alongside the op-filter HTTP test.
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project = ProjectService::create(
        &pool,
        CreateProject {
            name: "Spans Status Filter Test".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    store_sample_spans(&pool, project.id).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::spans::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/spans?status=internal_error",
            project.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total_count"], 1);
    let items = body["items"].as_array().expect("items is array");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["status"], "internal_error");
}

#[actix_web::test]
async fn test_list_spans_returns_401_without_token() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let project = ProjectService::create(
        &pool,
        CreateProject {
            name: "Spans Auth Test".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::spans::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/spans", project.id))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}
