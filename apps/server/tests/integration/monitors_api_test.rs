//! Integration tests for the Monitors (Crons) API
//!
//! Tests GET /api/projects/{id}/monitors and
//! GET /api/projects/{id}/monitors/{slug}/checkins with a real database.

use crate::common::TestDb;
use actix_web::{test, web, App};
use chrono::Utc;
use rustrak::config::{Config, DatabaseConfig, RateLimitConfig};
use rustrak::digest::processors::{CheckInProcessor, Processor, ProcessorCtx};
use rustrak::models::CreateProject;
use rustrak::routes;
use rustrak::services::{AuthTokenService, ProjectService};
use serde_json::Value;
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
        monitor_tick_interval_secs: 60,
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

async fn store_check_in(pool: &rustrak::db::DbPool, project_id: i32, body: &[u8]) {
    let ctx = ProcessorCtx {
        pool: pool.clone(),
        project_id,
        event_id: Uuid::new_v4(),
        ingested_at: Utc::now(),
        remote_addr: None,
    };
    CheckInProcessor.process(body.to_vec(), &ctx).await.unwrap();
}

#[actix_web::test]
async fn test_list_monitors_returns_stored_monitors() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project = ProjectService::create(
        &pool,
        CreateProject {
            name: "Monitors List Test".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    store_check_in(
        &pool,
        project.id,
        br#"{"monitor_slug":"nightly","status":"ok","monitor_config":{"schedule":{"type":"crontab","value":"0 0 * * *"}}}"#,
    )
    .await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::monitors::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/monitors", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    let items = body["monitors"].as_array().expect("monitors is array");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["slug"], "nightly");
    assert_eq!(items[0]["status"], "ok");
}

#[actix_web::test]
async fn test_list_check_ins_for_monitor() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project = ProjectService::create(
        &pool,
        CreateProject {
            name: "CheckIns List Test".to_string(),
            slug: None,
        },
    )
    .await
    .unwrap();

    store_check_in(
        &pool,
        project.id,
        br#"{"monitor_slug":"job","status":"ok"}"#,
    )
    .await;
    store_check_in(
        &pool,
        project.id,
        br#"{"monitor_slug":"job","status":"error"}"#,
    )
    .await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::monitors::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/monitors/job/checkins",
            project.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total_count"], 2);
    let items = body["items"].as_array().expect("items is array");
    assert_eq!(items.len(), 2);
}
