//! Integration tests for the AI Agent Monitoring dashboard API
//! (story-ai-agent-monitoring.md, GH #180).

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

async fn store_agent_run_with_llm_call(pool: &rustrak::db::DbPool, project_id: i32) {
    let ctx = ProcessorCtx {
        pool: pool.clone(),
        project_id,
        event_id: Uuid::nil(),
        ingested_at: Utc::now(),
        remote_addr: None,
    };
    let agent = serde_json::to_vec(&json!({
        "span_id": "1111111111111111", "trace_id": "agent-trace",
        "start_timestamp": 1.0, "timestamp": 2.0,
        "data": {"gen_ai.operation.type": "agent", "gen_ai.agent.name": "planner"}
    }))
    .unwrap();
    SpanProcessor.process(agent, &ctx).await.unwrap();

    let llm = serde_json::to_vec(&json!({
        "span_id": "2222222222222222", "trace_id": "agent-trace",
        "parent_span_id": "1111111111111111",
        "start_timestamp": 1.2, "timestamp": 1.8,
        "data": {
            "gen_ai.operation.type": "ai_client",
            "gen_ai.request.model": "gpt-4o",
            "gen_ai.usage.input_tokens": 100,
            "gen_ai.usage.output_tokens": 50
        }
    }))
    .unwrap();
    SpanProcessor.process(llm, &ctx).await.unwrap();

    let tool = serde_json::to_vec(&json!({
        "span_id": "3333333333333333", "trace_id": "agent-trace",
        "parent_span_id": "1111111111111111",
        "start_timestamp": 1.85, "timestamp": 1.95,
        "data": {"gen_ai.operation.type": "tool", "gen_ai.tool.name": "search"}
    }))
    .unwrap();
    SpanProcessor.process(tool, &ctx).await.unwrap();
}

async fn create_test_project(pool: &rustrak::db::DbPool) -> i32 {
    ProjectService::create(
        pool,
        CreateProject {
            name: format!("Agents API Test {}", Uuid::new_v4()),
            slug: None,
        },
    )
    .await
    .unwrap()
    .id
}

#[actix_web::test]
async fn test_agent_runs_endpoint_returns_timeseries() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project_id = create_test_project(&pool).await;
    store_agent_run_with_llm_call(&pool, project_id).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::agents::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/agents/runs", project_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    let points = body.as_array().expect("array response");
    let total: f64 = points.iter().map(|p| p["value"].as_f64().unwrap()).sum();
    assert_eq!(total, 1.0, "one agent-type span was stored");
}

#[actix_web::test]
async fn test_agent_cost_endpoint_returns_timeseries() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project_id = create_test_project(&pool).await;
    store_agent_run_with_llm_call(&pool, project_id).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::agents::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/agents/cost", project_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    let points = body.as_array().expect("array response");
    let total: f64 = points.iter().map(|p| p["value"].as_f64().unwrap()).sum();
    assert!(total > 0.0, "gpt-4o with usage must produce cost > 0");
}

#[actix_web::test]
async fn test_agent_duration_endpoint_returns_timeseries() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project_id = create_test_project(&pool).await;
    store_agent_run_with_llm_call(&pool, project_id).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::agents::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/agents/duration", project_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    let points = body.as_array().expect("array response");
    assert!(!points.is_empty());
    assert!(points[0].get("avg_ms").is_some());
    assert!(points[0].get("p95_ms").is_some());
}

#[actix_web::test]
async fn test_agent_models_calls_endpoint_returns_breakdown() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project_id = create_test_project(&pool).await;
    store_agent_run_with_llm_call(&pool, project_id).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::agents::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/agents/models/calls", project_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    let rows = body.as_array().expect("array response");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["label"], "gpt-4o");
    assert_eq!(rows[0]["value"], 1.0);
}

#[actix_web::test]
async fn test_agent_models_tokens_endpoint_returns_breakdown() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project_id = create_test_project(&pool).await;
    store_agent_run_with_llm_call(&pool, project_id).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::agents::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/agents/models/tokens",
            project_id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    let rows = body.as_array().expect("array response");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["label"], "gpt-4o");
    assert_eq!(rows[0]["value"], 150.0);
}

#[actix_web::test]
async fn test_agent_tools_endpoint_returns_breakdown() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project_id = create_test_project(&pool).await;
    store_agent_run_with_llm_call(&pool, project_id).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::agents::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/agents/tools", project_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    let rows = body.as_array().expect("array response");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["label"], "search");
    assert_eq!(rows[0]["value"], 1.0);
}

#[actix_web::test]
async fn test_agent_traces_endpoint_returns_paginated_traces() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let token = create_test_token(&pool).await;
    let project_id = create_test_project(&pool).await;
    store_agent_run_with_llm_call(&pool, project_id).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::agents::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/agents/traces", project_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["total_count"], 1);
    let items = body["items"].as_array().expect("items is array");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["trace_id"], "agent-trace");
    assert_eq!(items[0]["agent_name"], "planner");
    assert_eq!(items[0]["tool_call_count"], 1);
}

#[actix_web::test]
async fn test_agents_endpoints_return_401_without_token() {
    let db = TestDb::new().await;
    let pool = db.pool.clone();
    let config = create_test_config();
    let project_id = create_test_project(&pool).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .configure(routes::agents::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/agents/runs", project_id))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}
