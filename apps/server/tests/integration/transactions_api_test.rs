//! Integration tests for the Transactions API
//!
//! Tests GET /api/projects/{id}/transactions with a real PostgreSQL database.

use crate::common::TestDb;
use actix_web::{test, web, App};
use chrono::Utc;
use rustrak::config::{Config, DatabaseConfig, RateLimitConfig};
use rustrak::digest::processors::{Processor, ProcessorCtx, TransactionProcessor};
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

async fn create_test_project(pool: &rustrak::db::DbPool, name: &str) -> rustrak::models::Project {
    ProjectService::create(
        pool,
        CreateProject {
            name: name.to_string(),
            slug: None,
        },
    )
    .await
    .expect("Failed to create test project")
}

async fn store_test_transaction(pool: &rustrak::db::DbPool, project_id: i32, name: &str) {
    let ctx = ProcessorCtx {
        pool: pool.clone(),
        project_id,
        event_id: Uuid::new_v4(),
        ingested_at: Utc::now(),
        remote_addr: None,
    };
    let payload = serde_json::to_vec(&json!({
        "event_id": Uuid::new_v4().to_string(),
        "type": "transaction",
        "transaction": name,
        "timestamp": Utc::now().timestamp(),
        "start_timestamp": (Utc::now().timestamp() - 1),
        "platform": "javascript",
        "environment": "production",
        "release": "1.0.0",
    }))
    .unwrap();
    TransactionProcessor
        .process(payload, &ctx)
        .await
        .expect("Failed to store transaction");
}

#[actix_web::test]
async fn test_list_transactions_returns_empty_when_none_exist() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project = create_test_project(&pool, "Transactions Empty Test").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::transactions::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/transactions", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["items"], json!([]));
    assert_eq!(body["has_more"], false);
}

#[actix_web::test]
async fn test_list_transactions_returns_stored_transactions() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project = create_test_project(&pool, "Transactions List Test").await;

    store_test_transaction(&pool, project.id, "/api/checkout").await;
    store_test_transaction(&pool, project.id, "/api/payment").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::transactions::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/transactions", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["has_more"], false);
    let items = body["items"].as_array().expect("items is array");
    assert_eq!(items.len(), 2);
    // Newest first
    assert_eq!(items[0]["transaction_name"], "/api/payment");
    assert_eq!(items[1]["transaction_name"], "/api/checkout");
}

#[actix_web::test]
async fn test_list_transactions_does_not_return_error_events() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project = create_test_project(&pool, "Transactions Isolation Test").await;

    // Only store a transaction (no error events manually inserted)
    store_test_transaction(&pool, project.id, "/api/users").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::transactions::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/transactions", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    let items = body["items"].as_array().expect("items is array");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["transaction_name"], "/api/users");
}

#[actix_web::test]
async fn test_list_transactions_returns_401_without_token() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let project = create_test_project(&pool, "Transactions Auth Test").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::transactions::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/transactions", project.id))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}
