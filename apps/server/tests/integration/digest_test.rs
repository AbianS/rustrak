//! Integration tests for the Digest process
//!
//! Tests the complete event digest workflow: ingest -> grouping -> issue creation.

use chrono::Utc;
use rustrak::config::RateLimitConfig;
use rustrak::digest::worker::process_event;
use rustrak::ingest::{store_event, EventMetadata};
use rustrak::models::CreateProject;
use rustrak::services::{EventService, IssueService, ProjectService};
use serde_json::json;
use sqlx::PgPool;
use tempfile::TempDir;
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

fn create_rate_limit_config() -> RateLimitConfig {
    RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 500,
        max_events_per_project_per_hour: 5000,
    }
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

fn create_event_json(event_id: &str) -> serde_json::Value {
    json!({
        "event_id": event_id,
        "timestamp": Utc::now().timestamp() as f64,
        "platform": "rust",
        "level": "error",
        "transaction": "/api/users",
        "exception": {
            "values": [{
                "type": "TypeError",
                "value": "Cannot read property 'x' of null",
                "stacktrace": {
                    "frames": [{
                        "filename": "app.rs",
                        "function": "handle_request",
                        "lineno": 42,
                        "in_app": true
                    }]
                }
            }]
        }
    })
}

// =============================================================================
// Basic Digest Tests
// =============================================================================

#[actix_web::test]
async fn test_digest_creates_issue_and_event() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Digest Test Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = create_event_json(&event_id);
    let event_bytes = serde_json::to_vec(&event_json).unwrap();

    // Store event in temp storage
    store_event(ingest_dir, &event_id, &event_bytes)
        .await
        .expect("Failed to store event");

    let metadata = EventMetadata {
        event_id: event_id.clone(),
        project_id: project.id,
        ingested_at: Utc::now(),
        remote_addr: None,
    };

    // Process the event
    process_event(&db.pool, &metadata, ingest_dir, &rate_limit_config)
        .await
        .expect("Failed to process event");

    // Verify issue was created
    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].calculated_type, "TypeError");
    assert!(issues[0].calculated_value.contains("Cannot read property"));
    assert_eq!(issues[0].digested_event_count, 1);

    // Verify event was created
    let event_uuid = Uuid::parse_str(&event_id).expect("Invalid event_id");
    let exists = EventService::exists(&db.pool, project.id, event_uuid)
        .await
        .expect("Failed to check event existence");
    assert!(exists);
}

#[actix_web::test]
async fn test_digest_groups_similar_events() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Grouping Test Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    // Create two events with the same error type and message
    for i in 0..2 {
        let event_id = Uuid::new_v4().to_string().replace("-", "");
        let event_json = json!({
            "event_id": &event_id,
            "timestamp": Utc::now().timestamp() as f64,
            "platform": "rust",
            "level": "error",
            "transaction": "/api/users",
            "exception": {
                "values": [{
                    "type": "DatabaseError",
                    "value": "Connection refused"
                }]
            }
        });
        let event_bytes = serde_json::to_vec(&event_json).unwrap();

        store_event(ingest_dir, &event_id, &event_bytes)
            .await
            .expect("Failed to store event");

        let metadata = EventMetadata {
            event_id: event_id.clone(),
            project_id: project.id,
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        process_event(&db.pool, &metadata, ingest_dir, &rate_limit_config)
            .await
            .expect("Failed to process event");
    }

    // Should have only 1 issue with 2 events
    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].digested_event_count, 2);
}

#[actix_web::test]
async fn test_digest_creates_separate_issues_for_different_errors() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Different Errors Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    // Create events with different error types
    let errors = vec![
        ("TypeError", "Cannot read property"),
        ("ValueError", "Invalid value"),
        ("IOError", "File not found"),
    ];

    for (error_type, error_msg) in errors {
        let event_id = Uuid::new_v4().to_string().replace("-", "");
        let event_json = json!({
            "event_id": &event_id,
            "timestamp": Utc::now().timestamp() as f64,
            "platform": "rust",
            "level": "error",
            "exception": {
                "values": [{
                    "type": error_type,
                    "value": error_msg
                }]
            }
        });
        let event_bytes = serde_json::to_vec(&event_json).unwrap();

        store_event(ingest_dir, &event_id, &event_bytes)
            .await
            .expect("Failed to store event");

        let metadata = EventMetadata {
            event_id: event_id.clone(),
            project_id: project.id,
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        process_event(&db.pool, &metadata, ingest_dir, &rate_limit_config)
            .await
            .expect("Failed to process event");
    }

    // Should have 3 separate issues
    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(issues.len(), 3);
}

#[actix_web::test]
async fn test_digest_handles_custom_fingerprint() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Custom Fingerprint Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    // Create two events with same fingerprint but different errors
    for i in 0..2 {
        let event_id = Uuid::new_v4().to_string().replace("-", "");
        let event_json = json!({
            "event_id": &event_id,
            "timestamp": Utc::now().timestamp() as f64,
            "platform": "rust",
            "level": "error",
            "fingerprint": ["custom-group-key"],
            "exception": {
                "values": [{
                    "type": format!("Error{}", i),
                    "value": format!("Different error {}", i)
                }]
            }
        });
        let event_bytes = serde_json::to_vec(&event_json).unwrap();

        store_event(ingest_dir, &event_id, &event_bytes)
            .await
            .expect("Failed to store event");

        let metadata = EventMetadata {
            event_id: event_id.clone(),
            project_id: project.id,
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        process_event(&db.pool, &metadata, ingest_dir, &rate_limit_config)
            .await
            .expect("Failed to process event");
    }

    // Should have 1 issue because of custom fingerprint
    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].digested_event_count, 2);
}

#[actix_web::test]
async fn test_digest_handles_default_fingerprint_placeholder() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Default Fingerprint Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    // Event with {{ default }} fingerprint should use default grouping
    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = json!({
        "event_id": &event_id,
        "timestamp": Utc::now().timestamp() as f64,
        "platform": "rust",
        "level": "error",
        "fingerprint": ["{{ default }}", "extra-context"],
        "exception": {
            "values": [{
                "type": "TestError",
                "value": "Test message"
            }]
        }
    });
    let event_bytes = serde_json::to_vec(&event_json).unwrap();

    store_event(ingest_dir, &event_id, &event_bytes)
        .await
        .expect("Failed to store event");

    let metadata = EventMetadata {
        event_id: event_id.clone(),
        project_id: project.id,
        ingested_at: Utc::now(),
        remote_addr: None,
    };

    process_event(&db.pool, &metadata, ingest_dir, &rate_limit_config)
        .await
        .expect("Failed to process event");

    // Verify issue was created with expanded fingerprint
    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(issues.len(), 1);
}

// =============================================================================
// Duplicate Handling Tests
// =============================================================================

#[actix_web::test]
async fn test_digest_ignores_duplicate_event_id() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Duplicate Event Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = create_event_json(&event_id);
    let event_bytes = serde_json::to_vec(&event_json).unwrap();

    // Process same event twice
    for _ in 0..2 {
        store_event(ingest_dir, &event_id, &event_bytes)
            .await
            .expect("Failed to store event");

        let metadata = EventMetadata {
            event_id: event_id.clone(),
            project_id: project.id,
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        // Second processing should silently ignore the duplicate
        let _ = process_event(&db.pool, &metadata, ingest_dir, &rate_limit_config).await;
    }

    // Should only have 1 issue with 1 event
    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].digested_event_count, 1);
}

// =============================================================================
// Log Message Grouping Tests
// =============================================================================

#[actix_web::test]
async fn test_digest_groups_log_messages() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Log Message Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    // Create events with same log message (no exception)
    for _ in 0..2 {
        let event_id = Uuid::new_v4().to_string().replace("-", "");
        let event_json = json!({
            "event_id": &event_id,
            "timestamp": Utc::now().timestamp() as f64,
            "platform": "rust",
            "level": "warning",
            "logentry": {
                "message": "User %s failed to authenticate",
                "formatted": "User john@example.com failed to authenticate"
            }
        });
        let event_bytes = serde_json::to_vec(&event_json).unwrap();

        store_event(ingest_dir, &event_id, &event_bytes)
            .await
            .expect("Failed to store event");

        let metadata = EventMetadata {
            event_id: event_id.clone(),
            project_id: project.id,
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        process_event(&db.pool, &metadata, ingest_dir, &rate_limit_config)
            .await
            .expect("Failed to process event");
    }

    // Should have 1 issue grouped by log message
    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].calculated_type, "Log Message");
    assert_eq!(issues[0].digested_event_count, 2);
}

// =============================================================================
// Issue Statistics Tests
// =============================================================================

#[actix_web::test]
async fn test_digest_updates_issue_last_seen() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Last Seen Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    // Create first event
    let event_id1 = Uuid::new_v4().to_string().replace("-", "");
    let event_json1 = json!({
        "event_id": &event_id1,
        "timestamp": Utc::now().timestamp() as f64,
        "platform": "rust",
        "level": "error",
        "exception": {
            "values": [{
                "type": "TestError",
                "value": "Test"
            }]
        }
    });
    let event_bytes1 = serde_json::to_vec(&event_json1).unwrap();

    store_event(ingest_dir, &event_id1, &event_bytes1)
        .await
        .expect("Failed to store event");

    let metadata1 = EventMetadata {
        event_id: event_id1.clone(),
        project_id: project.id,
        ingested_at: Utc::now(),
        remote_addr: None,
    };

    process_event(&db.pool, &metadata1, ingest_dir, &rate_limit_config)
        .await
        .expect("Failed to process event");

    let (issues_before, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    let first_seen = issues_before[0].first_seen;
    let last_seen_before = issues_before[0].last_seen;

    // Small delay
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    // Create second event (same error type)
    let event_id2 = Uuid::new_v4().to_string().replace("-", "");
    let event_json2 = json!({
        "event_id": &event_id2,
        "timestamp": Utc::now().timestamp() as f64,
        "platform": "rust",
        "level": "error",
        "exception": {
            "values": [{
                "type": "TestError",
                "value": "Test"
            }]
        }
    });
    let event_bytes2 = serde_json::to_vec(&event_json2).unwrap();

    store_event(ingest_dir, &event_id2, &event_bytes2)
        .await
        .expect("Failed to store event");

    let metadata2 = EventMetadata {
        event_id: event_id2.clone(),
        project_id: project.id,
        ingested_at: Utc::now(),
        remote_addr: None,
    };

    process_event(&db.pool, &metadata2, ingest_dir, &rate_limit_config)
        .await
        .expect("Failed to process event");

    let (issues_after, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    // first_seen should stay the same
    assert_eq!(issues_after[0].first_seen, first_seen);
    // last_seen should be updated
    assert!(issues_after[0].last_seen >= last_seen_before);
}

// =============================================================================
// Project Counter Tests
// =============================================================================

#[actix_web::test]
async fn test_digest_updates_project_counters() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Counter Test Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    let initial_count = project.stored_event_count;

    // Process some events
    for _ in 0..3 {
        let event_id = Uuid::new_v4().to_string().replace("-", "");
        let event_json = create_event_json(&event_id);
        let event_bytes = serde_json::to_vec(&event_json).unwrap();

        store_event(ingest_dir, &event_id, &event_bytes)
            .await
            .expect("Failed to store event");

        let metadata = EventMetadata {
            event_id: event_id.clone(),
            project_id: project.id,
            ingested_at: Utc::now(),
            remote_addr: None,
        };

        process_event(&db.pool, &metadata, ingest_dir, &rate_limit_config)
            .await
            .expect("Failed to process event");
    }

    // Check project counters
    let updated_project = ProjectService::get_by_id(&db.pool, project.id)
        .await
        .expect("Failed to get project");

    assert_eq!(updated_project.stored_event_count, initial_count + 3);
}

// =============================================================================
// Edge Cases
// =============================================================================

#[actix_web::test]
async fn test_digest_handles_missing_exception() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "No Exception Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    // Event without exception or message
    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = json!({
        "event_id": &event_id,
        "timestamp": Utc::now().timestamp() as f64,
        "platform": "rust",
        "level": "error"
    });
    let event_bytes = serde_json::to_vec(&event_json).unwrap();

    store_event(ingest_dir, &event_id, &event_bytes)
        .await
        .expect("Failed to store event");

    let metadata = EventMetadata {
        event_id: event_id.clone(),
        project_id: project.id,
        ingested_at: Utc::now(),
        remote_addr: None,
    };

    // Should still process successfully with fallback grouping
    process_event(&db.pool, &metadata, ingest_dir, &rate_limit_config)
        .await
        .expect("Failed to process event");

    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(issues.len(), 1);
}

#[actix_web::test]
async fn test_digest_handles_multiline_error_value() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Multiline Error Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = json!({
        "event_id": &event_id,
        "timestamp": Utc::now().timestamp() as f64,
        "platform": "rust",
        "level": "error",
        "exception": {
            "values": [{
                "type": "AssertionError",
                "value": "Expected 1 but got 2\n  at test.rs:42\n  at main.rs:10"
            }]
        }
    });
    let event_bytes = serde_json::to_vec(&event_json).unwrap();

    store_event(ingest_dir, &event_id, &event_bytes)
        .await
        .expect("Failed to store event");

    let metadata = EventMetadata {
        event_id: event_id.clone(),
        project_id: project.id,
        ingested_at: Utc::now(),
        remote_addr: None,
    };

    process_event(&db.pool, &metadata, ingest_dir, &rate_limit_config)
        .await
        .expect("Failed to process event");

    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        rustrak::pagination::IssueSort::DigestOrder,
        rustrak::pagination::SortOrder::Desc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(issues.len(), 1);
    // Should only use first line in title
    assert!(!issues[0].title().contains('\n'));
}

#[actix_web::test]
async fn test_digest_cleans_up_temp_file() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Cleanup Test Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = create_event_json(&event_id);
    let event_bytes = serde_json::to_vec(&event_json).unwrap();

    store_event(ingest_dir, &event_id, &event_bytes)
        .await
        .expect("Failed to store event");

    // Verify file exists before processing
    let file_path = ingest_dir.join(format!("{}.json", event_id));
    assert!(file_path.exists());

    let metadata = EventMetadata {
        event_id: event_id.clone(),
        project_id: project.id,
        ingested_at: Utc::now(),
        remote_addr: None,
    };

    process_event(&db.pool, &metadata, ingest_dir, &rate_limit_config)
        .await
        .expect("Failed to process event");

    // Verify file is deleted after processing
    assert!(!file_path.exists());
}
