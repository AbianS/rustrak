//! Integration tests for the Issues API
//!
//! Tests the complete Issues API with a real PostgreSQL database.

use crate::common::TestDb;
use actix_web::{test, web, App};
use chrono::Utc;
use rustrak::config::{Config, DatabaseConfig, RateLimitConfig};
use rustrak::models::CreateProject;
use rustrak::routes;
use rustrak::services::grouping::DenormalizedFields;
use rustrak::services::{AuthTokenService, IssueService, ProjectService};
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
        dashboard_dir: "./static".to_string(),
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
            platform: None,
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
        culprit: "test_function".to_string(),
        logger: String::new(),
        release: String::new(),
    }
}

async fn create_test_issue(
    pool: &rustrak::db::DbPool,
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

    // Offset pagination (GH #165), not the old cursor shape: items/total_count/
    // page/per_page/total_pages.
    let body: Value = test::read_body_json(resp).await;
    assert!(body["items"].as_array().unwrap().is_empty());
    assert_eq!(body["total_count"], 0);
    assert_eq!(body["total_pages"], 0);
}

#[actix_web::test]
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

    // `include_resolved=true` is the old boolean param; the current API uses
    // `is:all` -- the status filter travels in `q` like every other one.
    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues?q=is%3Aall", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let issues = body["items"].as_array().unwrap();
    assert_eq!(issues.len(), 2);
}

#[actix_web::test]
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
            "/api/projects/{}/issues?sort=-last_seen",
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

#[actix_web::test]
async fn test_list_issues_sort_by_event_count() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Event Count Sort Project").await;
    let config = create_test_config();

    let low = create_test_issue(&db.pool, project.id, "TypeError", "Low count").await;
    let high = create_test_issue(&db.pool, project.id, "ValueError", "High count").await;

    sqlx::query("UPDATE issues SET digested_event_count = 5 WHERE id = $1")
        .bind(low.id)
        .execute(&db.pool)
        .await
        .expect("failed to bump low issue event count");
    sqlx::query("UPDATE issues SET digested_event_count = 500 WHERE id = $1")
        .bind(high.id)
        .execute(&db.pool)
        .await
        .expect("failed to bump high issue event count");

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues?sort=-events", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let issues = body["items"].as_array().unwrap();
    assert_eq!(issues.len(), 2);
    assert!(issues[0]["title"].as_str().unwrap().contains("High count"));
    assert!(issues[1]["title"].as_str().unwrap().contains("Low count"));
}

// =============================================================================
// top_issues_for_release Tests
// =============================================================================

async fn set_first_release(pool: &rustrak::db::DbPool, issue_id: uuid::Uuid, release: &str) {
    sqlx::query("UPDATE issues SET first_release = $1 WHERE id = $2")
        .bind(release)
        .bind(issue_id)
        .execute(pool)
        .await
        .expect("failed to set first_release");
}

#[actix_web::test]
async fn test_top_issues_for_release_empty_when_no_matching_release() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Empty Release Project").await;

    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Some error").await;
    set_first_release(&db.pool, issue.id, "1.0.0").await;

    let issues = IssueService::top_issues_for_release(&db.pool, project.id, "2.0.0", 10)
        .await
        .expect("query failed");

    assert!(issues.is_empty());
}

#[actix_web::test]
async fn test_top_issues_for_release_filters_by_release() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Release Filter Project").await;

    let in_release = create_test_issue(&db.pool, project.id, "TypeError", "In release").await;
    set_first_release(&db.pool, in_release.id, "1.0.0").await;

    let other_release =
        create_test_issue(&db.pool, project.id, "ValueError", "Other release").await;
    set_first_release(&db.pool, other_release.id, "0.9.0").await;

    let issues = IssueService::top_issues_for_release(&db.pool, project.id, "1.0.0", 10)
        .await
        .expect("query failed");

    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].id, in_release.id);
}

#[actix_web::test]
async fn test_top_issues_for_release_filters_by_project() {
    let db = TestDb::new().await;
    let project_a = create_test_project(&db.pool, "Release Project A").await;
    let project_b = create_test_project(&db.pool, "Release Project B").await;

    let issue_a = create_test_issue(&db.pool, project_a.id, "TypeError", "Project A").await;
    set_first_release(&db.pool, issue_a.id, "1.0.0").await;

    let issue_b = create_test_issue(&db.pool, project_b.id, "TypeError", "Project B").await;
    set_first_release(&db.pool, issue_b.id, "1.0.0").await;

    let issues = IssueService::top_issues_for_release(&db.pool, project_a.id, "1.0.0", 10)
        .await
        .expect("query failed");

    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].id, issue_a.id);
}

#[actix_web::test]
async fn test_top_issues_for_release_orders_by_first_seen_desc() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Release Order Project").await;

    let older = create_test_issue(&db.pool, project.id, "TypeError", "Older").await;
    set_first_release(&db.pool, older.id, "1.0.0").await;
    tokio::time::sleep(StdDuration::from_millis(10)).await;
    let newer = create_test_issue(&db.pool, project.id, "ValueError", "Newer").await;
    set_first_release(&db.pool, newer.id, "1.0.0").await;

    let issues = IssueService::top_issues_for_release(&db.pool, project.id, "1.0.0", 10)
        .await
        .expect("query failed");

    assert_eq!(issues.len(), 2);
    assert_eq!(issues[0].id, newer.id, "most recently introduced first");
    assert_eq!(issues[1].id, older.id);
}

#[actix_web::test]
async fn test_top_issues_for_release_respects_limit() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Release Limit Project").await;

    for i in 0..5 {
        let issue =
            create_test_issue(&db.pool, project.id, "TypeError", &format!("Error {i}")).await;
        set_first_release(&db.pool, issue.id, "1.0.0").await;
    }

    let issues = IssueService::top_issues_for_release(&db.pool, project.id, "1.0.0", 3)
        .await
        .expect("query failed");

    assert_eq!(issues.len(), 3);
}

// =============================================================================
// Get Issue Tests
// =============================================================================

#[actix_web::test]
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
async fn test_resolve_issue() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Resolve Project").await;
    let config = create_test_config();

    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    assert!(!issue.is_resolved());

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
async fn test_unmute_shim_is_noop_on_resolved_issue() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Unmute Noop Project").await;
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
        .set_json(json!({"is_muted": false}))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(
        body["status"], "resolved",
        "a defensive {{is_muted: false}} call must not reopen a resolved issue"
    );
}

#[actix_web::test]
async fn test_unmute_shim_transitions_ignored_issue_to_unresolved() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Unmute Ignored Project").await;
    let config = create_test_config();

    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    IssueService::mute(&db.pool, issue.id).await.unwrap();

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
        .set_json(json!({"is_muted": false}))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "unresolved");
}

#[actix_web::test]
async fn test_unresolve_shim_is_noop_on_ignored_issue() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Unresolve Noop Project").await;
    let config = create_test_config();

    let issue = create_test_issue(&db.pool, project.id, "TypeError", "Error").await;
    IssueService::mute(&db.pool, issue.id).await.unwrap();

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
    assert_eq!(
        body["status"], "ignored",
        "a defensive {{is_resolved: false}} call must not un-ignore a muted issue"
    );
}

#[actix_web::test]
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

    // Verify issue row is hard-deleted from the database
    let row: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM issues WHERE id = $1")
        .bind(issue.id)
        .fetch_optional(&db.pool)
        .await
        .expect("DB query failed");
    assert!(row.is_none(), "issue row should be gone after hard delete");

    // Verify GET on the deleted issue returns 404
    let get_req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues/{}", project.id, issue.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    let get_resp = test::call_service(&app, get_req).await;
    assert_eq!(get_resp.status(), 404);
}

#[actix_web::test]
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

    // Verify the issue row was NOT deleted (cross-project isolation)
    let row: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM issues WHERE id = $1")
        .bind(issue.id)
        .fetch_optional(&db.pool)
        .await
        .expect("DB query failed");
    assert!(
        row.is_some(),
        "issue row should still exist after wrong-project delete attempt"
    );
}

// =============================================================================
// Pagination Tests
// =============================================================================

#[actix_web::test]
async fn test_list_issues_pagination() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Pagination Project").await;
    let config = create_test_config();

    // Create 25 issues — more than the default page size (PAGE_SIZE = 20,
    // pagination/mod.rs:8), so pagination structure is actually exercised.
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

    // First page: 20 items, 25 total, 2 pages.
    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let issues = body["items"].as_array().unwrap();
    assert_eq!(issues.len(), 20);
    assert_eq!(body["total_count"], 25);
    assert_eq!(body["page"], 1);
    assert_eq!(body["per_page"], 20);
    assert_eq!(body["total_pages"], 2);

    // Second page: the remaining 5 items.
    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues?page=2", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let issues = body["items"].as_array().unwrap();
    assert_eq!(issues.len(), 5);
    assert_eq!(body["page"], 2);
}

#[actix_web::test]
async fn test_list_issues_invalid_page_param() {
    // `cursor` doesn't exist as a query param on the offset-paginated
    // endpoint anymore (`?page=` replaced it); a non-numeric `page` is the
    // current equivalent of a malformed pagination param and must 400 via
    // actix's `Query<ListIssuesQuery>` extraction failure.
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Invalid Page Project").await;
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
            "/api/projects/{}/issues?page=not_a_number",
            project.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

#[actix_web::test]
async fn test_list_issues_page_zero_is_the_first_page() {
    // `page=0` once produced a negative SQL OFFSET, which SQLite tolerated and
    // Postgres would have 500'd on. The list contract clamps it to the first
    // page: a stale link should show the list, not an error nobody can act on.
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Page Zero Project").await;
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
        .uri(&format!("/api/projects/{}/issues?page=0", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["page"], 1);
}

// =============================================================================
// Response Format Tests
// =============================================================================

#[actix_web::test]
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

// =============================================================================
// Bulk Operations Tests (through the real HTTP handlers, not IssueService
// directly — closes the coverage gap where digest_test.rs's bulk tests only
// exercised the service layer and never touched access::require, the
// resolvedInNextRelease branch, or the size-cap/IDOR checks in routes/issues.rs)
// =============================================================================

#[actix_web::test]
async fn test_bulk_update_issues_via_http_sets_status_and_priority() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Bulk HTTP Project").await;
    let config = create_test_config();

    let i1 = create_test_issue(&db.pool, project.id, "TypeError", "a").await;
    let i2 = create_test_issue(&db.pool, project.id, "ValueError", "b").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::put()
        .uri(&format!("/api/projects/{}/issues", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(json!({
            "ids": [i1.id, i2.id],
            "status": "resolved",
            "priority": "high",
        }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["updated"], 2);

    let updated1 = IssueService::get_by_id(&db.pool, i1.id).await.unwrap();
    assert_eq!(updated1.status, "resolved");
    assert_eq!(updated1.priority.as_deref(), Some("high"));
    let updated2 = IssueService::get_by_id(&db.pool, i2.id).await.unwrap();
    assert_eq!(updated2.status, "resolved");
    assert_eq!(updated2.priority.as_deref(), Some("high"));
}

#[actix_web::test]
async fn test_bulk_update_issues_rejects_oversized_batch() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Bulk Oversized Project").await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // 1001 random ids (over MAX_BULK_IDS = 1000, matching Sentry's own
    // BULK_MUTATION_LIMIT) — none need to exist, the size cap must reject
    // the request before any DB lookup happens.
    let ids: Vec<Uuid> = (0..1001).map(|_| Uuid::new_v4()).collect();
    let req = test::TestRequest::put()
        .uri(&format!("/api/projects/{}/issues", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(json!({ "ids": ids, "status": "resolved" }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

#[actix_web::test]
async fn test_bulk_delete_issues_via_http_scoped_to_project() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Bulk Delete HTTP Project").await;
    let other_project = create_test_project(&db.pool, "Other HTTP Project").await;
    let config = create_test_config();

    let mine = create_test_issue(&db.pool, project.id, "TypeError", "a").await;
    let theirs = create_test_issue(&db.pool, other_project.id, "TypeError", "b").await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    // A bulk-delete request scoped to `project` must not delete an issue
    // belonging to `other_project`, even though its id is included (IDOR
    // check on the bulk path, not just single-issue delete).
    let req = test::TestRequest::delete()
        .uri(&format!("/api/projects/{}/issues", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(json!({ "ids": [mine.id, theirs.id] }))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["deleted"], 1);

    assert!(IssueService::get_by_id(&db.pool, mine.id).await.is_err());
    assert!(IssueService::get_by_id(&db.pool, theirs.id).await.is_ok());
}

#[actix_web::test]
async fn test_get_issue_tag_values_returns_bare_list_not_wrapped() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Tag Values HTTP Project").await;
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

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/projects/{}/issues/{}/tags/browser",
            project.id, issue.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    // Real Sentry returns a bare list per value (`{key, name, value, count,
    // firstSeen/lastSeen}` each), not a `{key, values: [...]}` wrapper —
    // no events with this tag exist yet, so the list is empty, but the
    // response itself must be a JSON array, not an object.
    let body: Value = test::read_body_json(resp).await;
    assert!(
        body.is_array(),
        "expected a bare list response, got: {}",
        body
    );
    assert_eq!(body.as_array().unwrap().len(), 0);
}

/// `level:` narrows to the severities named, and it takes several: an operator
/// triaging a fire wants `error,fatal` and nothing else in the way.
#[actix_web::test]
async fn test_list_issues_filters_by_level() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Level Filter Project").await;
    let config = create_test_config();

    for (kind, level) in [
        ("TypeError", "error"),
        ("PanicUnwrap", "fatal"),
        ("DeprecationWarning", "warning"),
    ] {
        let issue = create_test_issue(&db.pool, project.id, kind, kind).await;
        sqlx::query("UPDATE issues SET level = $1 WHERE id = $2")
            .bind(level)
            .bind(issue.id)
            .execute(&db.pool)
            .await
            .expect("failed to set the issue level");
    }

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
            "/api/projects/{}/issues?q=level%3Aerror%2Cfatal",
            project.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let titles: Vec<&str> = body["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|issue| issue["title"].as_str().unwrap())
        .collect();

    assert_eq!(titles.len(), 2, "only the two severities named: {titles:?}");
    assert!(titles.iter().any(|title| title.contains("TypeError")));
    assert!(titles.iter().any(|title| title.contains("PanicUnwrap")));
}

/// `is:` takes several statuses at once, which is what a "resolved or muted"
/// tab asks for. A value the resource does not know is not a narrowing to
/// nothing: an empty list is a bad answer to a typo.
#[actix_web::test]
async fn test_list_issues_status_filter_takes_several_and_survives_a_typo() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Status Filter Project").await;
    let config = create_test_config();

    create_test_issue(&db.pool, project.id, "TypeError", "Still open").await;
    let resolved = create_test_issue(&db.pool, project.id, "ValueError", "Done").await;
    let muted = create_test_issue(&db.pool, project.id, "KeyError", "Quiet").await;

    for (issue, status) in [(resolved.id, "resolved"), (muted.id, "ignored")] {
        sqlx::query("UPDATE issues SET status = $1 WHERE id = $2")
            .bind(status)
            .bind(issue)
            .execute(&db.pool)
            .await
            .expect("failed to set the issue status");
    }

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    for (q, expected, why) in [
        ("is%3Aresolved%2Cmuted", 2, "both statuses named"),
        (
            "is%3Anonsense",
            1,
            "a status nobody recognises falls back to open, not to nothing",
        ),
    ] {
        let req = test::TestRequest::get()
            .uri(&format!("/api/projects/{}/issues?q={}", project.id, q))
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["items"].as_array().unwrap().len(), expected, "{why}");
    }
}

/// `events:` is a range with either end open, the same `a..b` the projects
/// list already takes. It is the one column on this table whose figure is
/// stored rather than computed per page, so it is the one that can be filtered.
#[actix_web::test]
async fn test_list_issues_filters_by_event_count_range() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Event Range Project").await;
    let config = create_test_config();

    for (kind, count) in [("Quiet", 3), ("Busy", 400), ("Loud", 9000)] {
        let issue = create_test_issue(&db.pool, project.id, kind, kind).await;
        sqlx::query("UPDATE issues SET digested_event_count = $1 WHERE id = $2")
            .bind(count as i64)
            .bind(issue.id)
            .execute(&db.pool)
            .await
            .expect("failed to set the event count");
    }

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    for (q, expected, why) in [
        ("events%3A100..", 2, "at least a hundred"),
        ("events%3A..500", 2, "at most five hundred"),
        ("events%3A100..500", 1, "both ends"),
    ] {
        let req = test::TestRequest::get()
            .uri(&format!("/api/projects/{}/issues?q={}", project.id, q))
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["items"].as_array().unwrap().len(), expected, "{why}");
    }
}

/// `seen:` is a window in days, the number the table's date filter serialises.
/// The cutoff is computed here rather than in SQL, so the statement is the same
/// one on SQLite and on PostgreSQL.
#[actix_web::test]
async fn test_list_issues_filters_by_last_seen_window() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Seen Window Project").await;
    let config = create_test_config();

    let recent = create_test_issue(&db.pool, project.id, "Recent", "Recent").await;
    let stale = create_test_issue(&db.pool, project.id, "Stale", "Stale").await;

    sqlx::query("UPDATE issues SET last_seen = $1 WHERE id = $2")
        .bind(chrono::Utc::now() - chrono::Duration::days(30))
        .bind(stale.id)
        .execute(&db.pool)
        .await
        .expect("failed to backdate the stale issue");
    assert_eq!(recent.project_id, project.id);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .configure(routes::issues::configure)
            .configure(routes::projects::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/issues?q=seen%3A7", project.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let items = body["items"].as_array().unwrap();
    assert_eq!(items.len(), 1, "only what was seen in the last seven days");
    assert!(items[0]["title"].as_str().unwrap().contains("Recent"));
}

/// A `seen:` window nobody could live through is still a request.
///
/// `chrono::Duration::days` panics rather than returns, and `1e300` reaches it
/// as `i64::MAX`. The window goes through `ListParams::days`, which has the
/// ceiling, so a query string somebody typed is a page rather than a 500.
#[actix_web::test]
async fn test_list_issues_survives_a_seen_window_nobody_could_live_through() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Absurd Window Project").await;
    let config = create_test_config();

    create_test_issue(&db.pool, project.id, "Recent", "Recent").await;

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
            "/api/projects/{}/issues?q=seen%3A1e300",
            project.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let items = body["items"].as_array().unwrap();
    assert_eq!(items.len(), 1, "a century back is every issue there is");
}

/// Free text and a range in the same `q`.
///
/// They are built into the statement in one order and bound in another, so
/// this is the combination that catches a placeholder pointing at the wrong
/// value. On its own each filter looks fine.
#[actix_web::test]
async fn test_list_issues_combines_free_text_with_a_range() {
    let db = TestDb::new().await;
    let token = create_test_token(&db.pool).await;
    let project = create_test_project(&db.pool, "Combined Filter Project").await;
    let config = create_test_config();

    for (kind, count) in [
        ("TimeoutQuiet", 3),
        ("TimeoutLoud", 900),
        ("OtherLoud", 900),
    ] {
        let issue = create_test_issue(&db.pool, project.id, kind, kind).await;
        sqlx::query("UPDATE issues SET digested_event_count = $1 WHERE id = $2")
            .bind(count as i64)
            .bind(issue.id)
            .execute(&db.pool)
            .await
            .expect("failed to set the event count");
    }

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
            "/api/projects/{}/issues?q=timeout%20events%3A100..",
            project.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: Value = test::read_body_json(resp).await;
    let items = body["items"].as_array().unwrap();
    assert_eq!(items.len(), 1, "loud, and named timeout");
    assert!(items[0]["title"].as_str().unwrap().contains("TimeoutLoud"));
}
