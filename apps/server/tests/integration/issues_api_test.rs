//! Integration tests for the Issues API
//!
//! Tests the complete Issues API with a real PostgreSQL database.

use actix_web::{test, web, App};
use chrono::Utc;
use rustrak::config::{Config, DatabaseConfig, RateLimitConfig};
use rustrak::models::CreateProject;
use rustrak::routes;
use rustrak::services::grouping::DenormalizedFields;
use rustrak::services::{AuthTokenService, IssueService, ProjectService};
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

// =============================================================================
// List Issues Tests
// =============================================================================

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_issues_empty() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Empty Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert!(body["items"].as_array().unwrap().is_empty());
    assert_eq!(body["has_more"], false);
    assert!(body["next_cursor"].is_null());
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_issues_with_data() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Issues Project").await;
    let config = create_test_config();

    // Create some test issues
    create_test_issue(&db.pool, project.id, "TypeError", "Cannot read property").await;
    create_test_issue(&db.pool, project.id, "ValueError", "Invalid value").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let issues = body["items"].as_array().unwrap();
    assert_eq!(issues.len(), 2);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_issues_unauthorized() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Unauthorized Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues", project.id))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_issues_project_not_found() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri("/api/projects/99999/issues")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_issues_filters_resolved_by_default() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Filter Project").await;
    let config = create_test_config();

    // Create issues
    let issue1 = create_test_issue(&db.pool, project.id, "TypeError", "Error 1").await;
    create_test_issue(&db.pool, project.id, "ValueError", "Error 2").await;

    // Resolve one issue
    IssueService::resolve(&db.pool, issue1.id).await.unwrap();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // Default should filter out resolved
    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let issues = body["items"].as_array().unwrap();
    assert_eq!(issues.len(), 1);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_issues_include_resolved() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Include Resolved Project").await;
    let config = create_test_config();

    let issue1 = create_test_issue(&db.pool, project.id, "TypeError", "Error 1").await;
    create_test_issue(&db.pool, project.id, "ValueError", "Error 2").await;

    IssueService::resolve(&db.pool, issue1.id).await.unwrap();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues?include_resolved=true",
            project.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let issues = body["items"].as_array().unwrap();
    assert_eq!(issues.len(), 2);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_issues_sort_by_last_seen() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Sort Project").await;
    let config = create_test_config();

    create_test_issue(&db.pool, project.id, "TypeError", "First").await;
    // Small delay to ensure different last_seen
    tokio::time::sleep(StdDuration::from_millis(10)).await;
    create_test_issue(&db.pool, project.id, "ValueError", "Second").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues?sort=last_seen&order=desc",
            project.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let issues = body["items"].as_array().unwrap();
    assert_eq!(issues.len(), 2);
    // Most recent should be first
    assert!(issues[0]["title"].as_str().unwrap().contains("Second"));
}

// =============================================================================
// Get Issue Tests
// =============================================================================

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_get_issue_success() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Get Issue Project").await;
    let config = create_test_config();

    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Test error message").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues/{}", project.id, issue.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["id"], issue.id.to_string());
    assert!(body["title"].as_str().unwrap().contains("TypeError"));
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_get_issue_not_found() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Not Found Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let fake_uuid = Uuid::new_v4();
    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}",
            project.id, fake_uuid
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_get_issue_wrong_project() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project1 = create_test_project(&db.pool, "Project 1").await;
    let project2 = create_test_project(&db.pool, "Project 2").await;
    let config = create_test_config();

    // Create issue in project1
    let issue = create_test_issue(&db.pool, project1.id, "TypeError", "Error").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // Try to access issue via project2
    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}",
            project2.id, issue.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// =============================================================================
// Update Issue Tests
// =============================================================================

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_resolve_issue() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Resolve Project").await;
    let config = create_test_config();

    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    assert!(!issue.is_resolved);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::patch()
        .uri(&format!("/api/projects/{}/issues/{}", project.id, issue.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({"is_resolved": true}))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["is_resolved"], true);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_unresolve_issue() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Unresolve Project").await;
    let config = create_test_config();

    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    IssueService::resolve(&db.pool, issue.id).await.unwrap();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::patch()
        .uri(&format!("/api/projects/{}/issues/{}", project.id, issue.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({"is_resolved": false}))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["is_resolved"], false);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_mute_issue() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Mute Project").await;
    let config = create_test_config();

    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::patch()
        .uri(&format!("/api/projects/{}/issues/{}", project.id, issue.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({"is_muted": true}))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["is_muted"], true);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_update_issue_not_found() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Update Not Found Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let fake_uuid = Uuid::new_v4();
    let req = test::TestRequest::patch()
        .uri(&format!(
            "/api/projects/{}/issues/{}",
            project.id, fake_uuid
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({"is_resolved": true}))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_update_issue_empty_body() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Empty Update Project").await;
    let config = create_test_config();

    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // Empty update should succeed but not change anything
    let req = test::TestRequest::patch()
        .uri(&format!("/api/projects/{}/issues/{}", project.id, issue.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(json!({}))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

// =============================================================================
// Delete Issue Tests
// =============================================================================

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_delete_issue_success() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Delete Project").await;
    let config = create_test_config();

    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::delete()
        .uri(&format!("/api/projects/{}/issues/{}", project.id, issue.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 204);

    // Verify issue is marked as deleted
    let result = IssueService::get_by_id(&db.pool, issue.id).await;
    assert!(result.is_err());
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_delete_issue_not_found() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Delete Not Found Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let fake_uuid = Uuid::new_v4();
    let req = test::TestRequest::delete()
        .uri(&format!(
            "/api/projects/{}/issues/{}",
            project.id, fake_uuid
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_delete_issue_wrong_project() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project1 = create_test_project(&db.pool, "Delete Project 1").await;
    let project2 = create_test_project(&db.pool, "Delete Project 2").await;
    let config = create_test_config();

    let issue = create_test_issue(&db.pool, project1.id, "TypeError", "Error").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // Try to delete via wrong project
    let req = test::TestRequest::delete()
        .uri(&format!(
            "/api/projects/{}/issues/{}",
            project2.id, issue.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// =============================================================================
// Pagination Tests
// =============================================================================

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_issues_pagination() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Pagination Project").await;
    let config = create_test_config();

    // Create a few issues for pagination testing
    // (actual page size is 250, so we test with fewer items and verify pagination structure)
    for i in 0..25 {
        create_test_issue(
            &db.pool,
            project.id,
            &format!("Error{}", i),
            &format!("Message {}", i),
        )
        .await;
    }

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // First page - should return all 25 issues (less than page size of 250)
    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let issues = body["items"].as_array().unwrap();
    assert_eq!(issues.len(), 25);
    // With only 25 items and page size 250, there should be no more pages
    assert_eq!(body["has_more"], false);
    // next_cursor should be null when no more pages
    assert!(body["next_cursor"].is_null());
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_list_issues_invalid_cursor() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Invalid Cursor Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues?cursor=invalid_cursor_value",
            project.id
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
async fn test_issue_response_format() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Format Project").await;
    let config = create_test_config();

    let issue = create_test_issue(
        &db.pool,
        project.id,
        "TypeError",
        "Cannot read property 'x' of null",
    )
    .await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues/{}", project.id, issue.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;

    // Verify all expected fields are present
    assert!(body["id"].is_string());
    assert!(body["project_id"].is_number());
    assert!(body["short_id"].is_string());
    assert!(body["title"].is_string());
    assert!(body["first_seen"].is_string());
    assert!(body["last_seen"].is_string());
    assert!(body["event_count"].is_number());
    assert!(body.get("level").is_some());
    assert!(body.get("platform").is_some());
    assert!(body.get("is_resolved").is_some());
    assert!(body.get("is_muted").is_some());

    // Verify short_id format (PROJECT-N)
    let short_id = body["short_id"].as_str().unwrap();
    assert!(short_id.starts_with(&project.slug.to_uppercase()));
    assert!(short_id.contains("-"));
}
