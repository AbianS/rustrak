//! Integration tests for the Events API
//!
//! Tests the Events API endpoints with a real PostgreSQL database.

use actix_web::{test, web, App};
use chrono::Utc;
use rustrak::config::{Config, DatabaseConfig, RateLimitConfig};
use rustrak::models::{CreateProject, Grouping};
use rustrak::routes;
use rustrak::services::grouping::DenormalizedFields;
use rustrak::services::{AuthTokenService, EventService, IssueService, ProjectService};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::time::Duration as StdDuration;
use testcontainers::{runners::AsyncRunner, ContainerAsync};
use testcontainers_modules::postgres::Postgres;
use uuid::Uuid;

/// Test database container with connection pool
struct TestDb {
    #[allow(dead_code)]
    container: ContainerAsync<Postgres>,
    pool: PgPool,
}

impl TestDb {
    async fn new() -> Self {
        let container = Postgres::default()
            .start()
            .await
            .expect("Failed to start PostgreSQL container");

        let host = container.get_host().await.expect("Failed to get host");
        let port = container
            .get_host_port_ipv4(5432)
            .await
            .expect("Failed to get port");

        let database_url = format!("postgres://postgres:postgres@{}:{}/postgres", host, port);

        let pool = PgPool::connect(&database_url)
            .await
            .expect("Failed to connect to test database");

        sqlx::query("CREATE EXTENSION IF NOT EXISTS pgcrypto")
            .execute(&pool)
            .await
            .expect("Failed to enable pgcrypto extension");

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Failed to run migrations");

        TestDb { container, pool }
    }
}

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
    }
}

async fn create_test_token(pool: &PgPool) -> String {
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

async fn create_test_project(pool: &PgPool, name: &str) -> rustrak::models::Project {
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

fn create_denormalized_fields(
    calc_type: &str,
    calc_value: &str,
    transaction: &str,
) -> DenormalizedFields {
    DenormalizedFields {
        calculated_type: calc_type.to_string(),
        calculated_value: calc_value.to_string(),
        transaction: transaction.to_string(),
        last_frame_filename: "test.rs".to_string(),
        last_frame_module: "test_module".to_string(),
        last_frame_function: "test_function".to_string(),
    }
}

async fn create_test_issue(
    pool: &PgPool,
    project_id: i32,
    calc_type: &str,
    calc_value: &str,
) -> rustrak::models::Issue {
    let denormalized = create_denormalized_fields(calc_type, calc_value, "/api/test");
    IssueService::create(
        pool,
        project_id,
        Utc::now(),
        &denormalized,
        Some("error"),
        Some("rust"),
    )
    .await
    .expect("Failed to create test issue")
}

async fn create_test_grouping(pool: &PgPool, project_id: i32, issue_id: Uuid) -> Grouping {
    let grouping_key = format!("test_grouping_key_{}", Uuid::new_v4());
    let grouping_key_hash = format!("{:064x}", 0); // Simple hash for testing

    sqlx::query_as::<_, Grouping>(
        r#"
        INSERT INTO groupings (project_id, issue_id, grouping_key, grouping_key_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(project_id)
    .bind(issue_id)
    .bind(&grouping_key)
    .bind(&grouping_key_hash)
    .fetch_one(pool)
    .await
    .expect("Failed to create test grouping")
}

async fn create_test_event(
    pool: &PgPool,
    project_id: i32,
    issue_id: Uuid,
    grouping_id: i32,
    event_data: &Value,
    digest_order: i32,
) -> rustrak::models::Event {
    let event_id = Uuid::new_v4();
    let denormalized = create_denormalized_fields("TypeError", "Test error", "/api/test");

    EventService::create(
        pool,
        event_id,
        project_id,
        issue_id,
        grouping_id,
        event_data,
        Utc::now(),
        &denormalized,
        digest_order,
        None,
    )
    .await
    .expect("Failed to create test event")
}

fn create_event_data() -> Value {
    json!({
        "event_id": Uuid::new_v4().to_string().replace("-", ""),
        "timestamp": Utc::now().timestamp() as f64,
        "platform": "rust",
        "level": "error",
        "transaction": "/api/test",
        "exception": {
            "values": [{
                "type": "TypeError",
                "value": "Test error message",
                "stacktrace": {
                    "frames": [{
                        "filename": "test.rs",
                        "function": "test_function",
                        "lineno": 42,
                        "in_app": true
                    }]
                }
            }]
        },
        "sdk": {
            "name": "sentry.rust",
            "version": "0.35.0"
        }
    })
}

// =============================================================================
// List Events Tests
// =============================================================================

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_events_empty() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Empty Events Project").await;
    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events",
            project.id, issue.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert!(body["items"].as_array().unwrap().is_empty());
    assert_eq!(body["has_more"], false);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_events_with_data() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Events Project").await;
    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    let grouping = create_test_grouping(&db.pool, project.id, issue.id).await;
    let config = create_test_config();

    // Create some test events
    let event_data = create_event_data();
    create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, 1).await;
    create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, 2).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events",
            project.id, issue.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let events = body["items"].as_array().unwrap();
    assert_eq!(events.len(), 2);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_events_unauthorized() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Unauthorized Events Project").await;
    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events",
            project.id, issue.id
        ))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_events_issue_not_found() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Issue Not Found Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let fake_uuid = Uuid::new_v4();
    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events",
            project.id, fake_uuid
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_events_wrong_project() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project1 = create_test_project(&db.pool, "Events Project 1").await;
    let project2 = create_test_project(&db.pool, "Events Project 2").await;
    let issue = create_test_issue(&db.pool, project1.id, "TypeError", "Error").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // Try to access issue via wrong project
    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events",
            project2.id, issue.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_events_order_desc() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Events Order Project").await;
    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    let grouping = create_test_grouping(&db.pool, project.id, issue.id).await;
    let config = create_test_config();

    let event_data = create_event_data();
    let event1 =
        create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, 1).await;
    let event2 =
        create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, 2).await;
    let event3 =
        create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, 3).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // Default order is DESC (newest first / highest digest_order first)
    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events?order=desc",
            project.id, issue.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let events = body["items"].as_array().unwrap();
    assert_eq!(events.len(), 3);

    // Verify order by event_id (should be event3, event2, event1 for desc)
    let event_ids: Vec<String> = events
        .iter()
        .map(|e| e["id"].as_str().unwrap().to_string())
        .collect();
    assert_eq!(
        event_ids,
        vec![
            event3.id.to_string(),
            event2.id.to_string(),
            event1.id.to_string()
        ]
    );
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_events_order_asc() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Events ASC Project").await;
    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    let grouping = create_test_grouping(&db.pool, project.id, issue.id).await;
    let config = create_test_config();

    let event_data = create_event_data();
    let event1 =
        create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, 1).await;
    let event2 =
        create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, 2).await;
    let event3 =
        create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, 3).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events?order=asc",
            project.id, issue.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let events = body["items"].as_array().unwrap();
    assert_eq!(events.len(), 3);

    // Verify order by event_id (should be event1, event2, event3 for asc)
    let event_ids: Vec<String> = events
        .iter()
        .map(|e| e["id"].as_str().unwrap().to_string())
        .collect();
    assert_eq!(
        event_ids,
        vec![
            event1.id.to_string(),
            event2.id.to_string(),
            event3.id.to_string()
        ]
    );
}

// =============================================================================
// Get Event Tests
// =============================================================================

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_get_event_success() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Get Event Project").await;
    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    let grouping = create_test_grouping(&db.pool, project.id, issue.id).await;
    let config = create_test_config();

    let event_data = create_event_data();
    let event =
        create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, 1).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events/{}",
            project.id, issue.id, event.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["id"], event.id.to_string());
    // Detail response should include the data field
    assert!(body.get("data").is_some());
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_get_event_not_found() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Event Not Found Project").await;
    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let fake_uuid = Uuid::new_v4();
    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events/{}",
            project.id, issue.id, fake_uuid
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_get_event_wrong_issue() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Event Wrong Issue Project").await;
    let issue1 = create_test_issue(&db.pool, project.id, "TypeError", "Error 1").await;
    let issue2 = create_test_issue(&db.pool, project.id, "ValueError", "Error 2").await;
    let grouping = create_test_grouping(&db.pool, project.id, issue1.id).await;
    let config = create_test_config();

    let event_data = create_event_data();
    let event =
        create_test_event(&db.pool, project.id, issue1.id, grouping.id, &event_data, 1).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // Try to access event via wrong issue
    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events/{}",
            project.id, issue2.id, event.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_get_event_includes_full_data() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Event Full Data Project").await;
    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    let grouping = create_test_grouping(&db.pool, project.id, issue.id).await;
    let config = create_test_config();

    let event_data = json!({
        "event_id": Uuid::new_v4().to_string().replace("-", ""),
        "timestamp": Utc::now().timestamp() as f64,
        "platform": "rust",
        "level": "error",
        "message": "This is a detailed error message",
        "exception": {
            "values": [{
                "type": "CustomError",
                "value": "Something went wrong",
                "stacktrace": {
                    "frames": [
                        {"filename": "main.rs", "function": "main", "lineno": 10},
                        {"filename": "lib.rs", "function": "process", "lineno": 50}
                    ]
                }
            }]
        },
        "breadcrumbs": {
            "values": [
                {"timestamp": 1234567890.0, "message": "User clicked button"}
            ]
        },
        "tags": {
            "environment": "production",
            "version": "1.0.0"
        }
    });

    let event =
        create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, 1).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events/{}",
            project.id, issue.id, event.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;

    // Verify the data field contains the full event data
    // EventDetailResponse includes a `data` field with the raw event JSON
    let data = &body["data"];
    assert!(data["exception"].is_object());
    assert!(data["breadcrumbs"].is_object());
    assert!(data["tags"].is_object());
}

// =============================================================================
// Pagination Tests
// =============================================================================

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_events_pagination() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Events Pagination Project").await;
    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    let grouping = create_test_grouping(&db.pool, project.id, issue.id).await;
    let config = create_test_config();

    // Create a few events for pagination testing
    // (actual page size is 250, so we test with fewer items and verify cursor mechanics)
    let event_data = create_event_data();
    for i in 1..=25 {
        create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, i).await;
    }

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // First page - should return all 25 events (less than page size of 250)
    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events",
            project.id, issue.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let events = body["items"].as_array().unwrap();
    assert_eq!(events.len(), 25);
    // With only 25 items and page size 250, there should be no more pages
    assert_eq!(body["has_more"], false);
    // next_cursor should be null when no more pages
    assert!(body["next_cursor"].is_null());
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_events_invalid_cursor() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Invalid Cursor Events Project").await;
    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events?cursor=invalid_cursor",
            project.id, issue.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

// =============================================================================
// Response Format Tests
// =============================================================================

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_event_list_response_format() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Event List Format Project").await;
    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    let grouping = create_test_grouping(&db.pool, project.id, issue.id).await;
    let config = create_test_config();

    let event_data = create_event_data();
    create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, 1).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events",
            project.id, issue.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let event = &body["items"][0];

    // List response should have summary fields
    assert!(event["id"].is_string());
    assert!(event["event_id"].is_string());
    assert!(event["timestamp"].is_string());
    assert!(event.get("level").is_some());
    assert!(event.get("platform").is_some());

    // List response should NOT have the full data field (for performance)
    // Note: This depends on implementation - verify with actual behavior
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_event_detail_response_format() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Event Detail Format Project").await;
    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    let grouping = create_test_grouping(&db.pool, project.id, issue.id).await;
    let config = create_test_config();

    let event_data = create_event_data();
    let event =
        create_test_event(&db.pool, project.id, issue.id, grouping.id, &event_data, 1).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::events::configure)
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/events/{}",
            project.id, issue.id, event.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;

    // Detail response should have all fields including data
    assert!(body["id"].is_string());
    assert!(body["event_id"].is_string());
    assert!(body["timestamp"].is_string());
    assert!(body.get("data").is_some());
    assert!(body["data"].is_object());
}
