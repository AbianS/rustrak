//! Integration tests for the Digest process
//!
//! Tests the complete event digest workflow: ingest -> grouping -> issue creation.

use crate::common::process_error_event;
use crate::common::TestDb;
use chrono::Utc;
use rustrak::config::RateLimitConfig;
use rustrak::ingest::{store_event, EventMetadata};
use rustrak::models::CreateProject;
use rustrak::services::{EventService, IssueService, ProjectService};
use serde_json::json;
use tempfile::TempDir;
use uuid::Uuid;

fn create_rate_limit_config() -> RateLimitConfig {
    RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 500,
        max_events_per_project_per_hour: 5000,
    }
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
    process_error_event(
        &db.pool,
        &metadata,
        ingest_dir,
        &rate_limit_config,
        crate::common::null_sourcemap_provider(),
    )
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
async fn test_error_processor_impl_creates_issue_and_event() {
    // Parity proof: ErrorProcessor::process (the trait API) must produce the
    // exact same outcome as the legacy process_error_event() free function.
    use rustrak::digest::processors::{ErrorProcessor, Processor, ProcessorCtx};

    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "ErrorProcessor Trait Test").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

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

    let processor = ErrorProcessor::new(
        ingest_dir.to_path_buf(),
        rate_limit_config,
        crate::common::null_sourcemap_provider(),
    );
    let ctx = ProcessorCtx {
        pool: db.pool.clone(),
        project_id: project.id,
        event_id: Uuid::parse_str(&event_id).expect("Invalid event_id"),
        ingested_at: metadata.ingested_at,
        remote_addr: None,
    };

    processor
        .process(metadata, &ctx)
        .await
        .expect("ErrorProcessor failed to process event");

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

    assert_eq!(
        issues.len(),
        1,
        "ErrorProcessor must create exactly one issue"
    );
    assert_eq!(issues[0].calculated_type, "TypeError");
    assert!(issues[0].calculated_value.contains("Cannot read property"));

    let event_uuid = Uuid::parse_str(&event_id).expect("Invalid event_id");
    let exists = EventService::exists(&db.pool, project.id, event_uuid)
        .await
        .expect("Failed to check event existence");
    assert!(exists, "ErrorProcessor must store the event");
}

#[actix_web::test]
async fn test_digest_groups_similar_events() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Grouping Test Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    // Create two events with the same error type and message
    for _i in 0..2 {
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

        process_error_event(
            &db.pool,
            &metadata,
            ingest_dir,
            &rate_limit_config,
            crate::common::null_sourcemap_provider(),
        )
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

        process_error_event(
            &db.pool,
            &metadata,
            ingest_dir,
            &rate_limit_config,
            crate::common::null_sourcemap_provider(),
        )
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

        process_error_event(
            &db.pool,
            &metadata,
            ingest_dir,
            &rate_limit_config,
            crate::common::null_sourcemap_provider(),
        )
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

    process_error_event(
        &db.pool,
        &metadata,
        ingest_dir,
        &rate_limit_config,
        crate::common::null_sourcemap_provider(),
    )
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
        let _ = process_error_event(
            &db.pool,
            &metadata,
            ingest_dir,
            &rate_limit_config,
            crate::common::null_sourcemap_provider(),
        )
        .await;
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

        process_error_event(
            &db.pool,
            &metadata,
            ingest_dir,
            &rate_limit_config,
            crate::common::null_sourcemap_provider(),
        )
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

    process_error_event(
        &db.pool,
        &metadata1,
        ingest_dir,
        &rate_limit_config,
        crate::common::null_sourcemap_provider(),
    )
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

    process_error_event(
        &db.pool,
        &metadata2,
        ingest_dir,
        &rate_limit_config,
        crate::common::null_sourcemap_provider(),
    )
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

        process_error_event(
            &db.pool,
            &metadata,
            ingest_dir,
            &rate_limit_config,
            crate::common::null_sourcemap_provider(),
        )
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
// Temp File Cleanup Tests
// =============================================================================

#[actix_web::test]
async fn test_process_event_cleans_up_temp_file_on_failure() {
    let db = TestDb::new().await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path();
    let rate_limit_config = create_rate_limit_config();

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = create_event_json(&event_id);
    let event_bytes = serde_json::to_vec(&event_json).unwrap();

    store_event(ingest_dir, &event_id, &event_bytes)
        .await
        .expect("Failed to store event");

    let event_path = ingest_dir.join(format!("{}.json", event_id));
    assert!(
        event_path.exists(),
        "file must exist before calling process_event"
    );

    // project_id 99999 does not exist → process_event returns Err immediately
    let metadata = EventMetadata {
        event_id: event_id.clone(),
        project_id: 99999,
        ingested_at: Utc::now(),
        remote_addr: None,
    };

    let result = process_error_event(
        &db.pool,
        &metadata,
        ingest_dir,
        &rate_limit_config,
        crate::common::null_sourcemap_provider(),
    )
    .await;
    assert!(
        result.is_err(),
        "process_event must fail for non-existent project"
    );

    assert!(
        !event_path.exists(),
        "temp file must be deleted even when process_event fails"
    );
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
    process_error_event(
        &db.pool,
        &metadata,
        ingest_dir,
        &rate_limit_config,
        crate::common::null_sourcemap_provider(),
    )
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

    process_error_event(
        &db.pool,
        &metadata,
        ingest_dir,
        &rate_limit_config,
        crate::common::null_sourcemap_provider(),
    )
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

    process_error_event(
        &db.pool,
        &metadata,
        ingest_dir,
        &rate_limit_config,
        crate::common::null_sourcemap_provider(),
    )
    .await
    .expect("Failed to process event");

    // Verify file is deleted after processing
    assert!(!file_path.exists());
}

// =============================================================================
// Status model: regression detection, culprit & priority (GH #165)
// =============================================================================

/// Ingests a single error event with the given id through the digest pipeline.
async fn ingest_error_event(
    pool: &rustrak::db::DbPool,
    project_id: i32,
    ingest_dir: &std::path::Path,
    rate_limit_config: &RateLimitConfig,
    event_id: &str,
) {
    let event_json = create_event_json(event_id);
    let event_bytes = serde_json::to_vec(&event_json).unwrap();
    store_event(ingest_dir, event_id, &event_bytes)
        .await
        .expect("store event");
    let metadata = EventMetadata {
        event_id: event_id.to_string(),
        project_id,
        ingested_at: Utc::now(),
        remote_addr: None,
    };
    process_error_event(
        pool,
        &metadata,
        ingest_dir,
        rate_limit_config,
        crate::common::null_sourcemap_provider(),
    )
    .await
    .expect("process event");
}

#[actix_web::test]
async fn test_new_issue_has_status_priority_and_culprit() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Status Create Project").await;
    let temp_dir = TempDir::new().unwrap();
    let cfg = create_rate_limit_config();

    let event_id = Uuid::new_v4().to_string().replace("-", "");
    ingest_error_event(&db.pool, project.id, temp_dir.path(), &cfg, &event_id).await;

    let issue = IssueService::get_by_id(
        &db.pool,
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM issues WHERE project_id = $1")
            .bind(project.id)
            .fetch_one(&db.pool)
            .await
            .unwrap(),
    )
    .await
    .unwrap();

    assert_eq!(issue.status, "unresolved");
    assert_eq!(issue.substatus.as_deref(), Some("new"));
    // level "error" -> high priority
    assert_eq!(issue.priority.as_deref(), Some("high"));
    // culprit derived from the in-app frame's function
    assert_eq!(issue.culprit, "handle_request");
}

#[actix_web::test]
async fn test_resolved_issue_regresses_on_new_event() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Regression Project").await;
    let temp_dir = TempDir::new().unwrap();
    let cfg = create_rate_limit_config();

    // First event creates the issue.
    let e1 = Uuid::new_v4().to_string().replace("-", "");
    ingest_error_event(&db.pool, project.id, temp_dir.path(), &cfg, &e1).await;

    let issue_id = sqlx::query_scalar::<_, Uuid>("SELECT id FROM issues WHERE project_id = $1")
        .bind(project.id)
        .fetch_one(&db.pool)
        .await
        .unwrap();

    // Resolve it.
    IssueService::resolve(&db.pool, issue_id).await.unwrap();
    let resolved = IssueService::get_by_id(&db.pool, issue_id).await.unwrap();
    assert_eq!(resolved.status, "resolved");

    // A second event with the same grouping must reopen it as regressed.
    let e2 = Uuid::new_v4().to_string().replace("-", "");
    ingest_error_event(&db.pool, project.id, temp_dir.path(), &cfg, &e2).await;

    let reopened = IssueService::get_by_id(&db.pool, issue_id).await.unwrap();
    assert_eq!(reopened.status, "unresolved");
    assert_eq!(reopened.substatus.as_deref(), Some("regressed"));
    assert_eq!(reopened.digested_event_count, 2);
}

#[actix_web::test]
async fn test_unresolved_issue_does_not_regress() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "No Regression Project").await;
    let temp_dir = TempDir::new().unwrap();
    let cfg = create_rate_limit_config();

    let e1 = Uuid::new_v4().to_string().replace("-", "");
    ingest_error_event(&db.pool, project.id, temp_dir.path(), &cfg, &e1).await;
    let issue_id = sqlx::query_scalar::<_, Uuid>("SELECT id FROM issues WHERE project_id = $1")
        .bind(project.id)
        .fetch_one(&db.pool)
        .await
        .unwrap();

    let e2 = Uuid::new_v4().to_string().replace("-", "");
    ingest_error_event(&db.pool, project.id, temp_dir.path(), &cfg, &e2).await;

    let issue = IssueService::get_by_id(&db.pool, issue_id).await.unwrap();
    // Substatus stays whatever it was (new), never flips to regressed.
    assert_eq!(issue.status, "unresolved");
    assert_ne!(issue.substatus.as_deref(), Some("regressed"));
}

// =============================================================================
// Hashes, bulk ops, and tag/user aggregation (GH #165)
// =============================================================================

/// Ingests an event with explicit tags + user, keeping the grouping stable so
/// all events land on the same issue.
async fn ingest_event_with_tags(
    pool: &rustrak::db::DbPool,
    project_id: i32,
    ingest_dir: &std::path::Path,
    cfg: &RateLimitConfig,
    tags: serde_json::Value,
    user: serde_json::Value,
) {
    let event_id = Uuid::new_v4().to_string().replace("-", "");
    let event_json = json!({
        "event_id": event_id,
        "timestamp": Utc::now().timestamp() as f64,
        "platform": "rust",
        "level": "error",
        "transaction": "/api/users",
        "release": "v1.0.0",
        "tags": tags,
        "user": user,
        "exception": {
            "values": [{
                "type": "TypeError",
                "value": "Cannot read property 'x' of null",
                "stacktrace": { "frames": [{
                    "filename": "app.rs", "function": "handle_request",
                    "lineno": 42, "in_app": true
                }]}
            }]
        }
    });
    let bytes = serde_json::to_vec(&event_json).unwrap();
    store_event(ingest_dir, &event_id, &bytes).await.unwrap();
    let metadata = EventMetadata {
        event_id: event_id.clone(),
        project_id,
        ingested_at: Utc::now(),
        remote_addr: None,
    };
    process_error_event(pool, &metadata, ingest_dir, cfg, crate::common::null_sourcemap_provider())
        .await
        .unwrap();
}

async fn only_issue_id(pool: &rustrak::db::DbPool, project_id: i32) -> Uuid {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM issues WHERE project_id = $1 LIMIT 1")
        .bind(project_id)
        .fetch_one(pool)
        .await
        .unwrap()
}

#[actix_web::test]
async fn test_list_hashes_returns_grouping() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Hashes Project").await;
    let temp_dir = TempDir::new().unwrap();
    let cfg = create_rate_limit_config();

    let e1 = Uuid::new_v4().to_string().replace("-", "");
    ingest_error_event(&db.pool, project.id, temp_dir.path(), &cfg, &e1).await;
    let issue_id = only_issue_id(&db.pool, project.id).await;

    let hashes = IssueService::list_hashes(&db.pool, issue_id).await.unwrap();
    assert_eq!(hashes.len(), 1);
    assert_eq!(hashes[0].issue_id, issue_id);
    assert_eq!(hashes[0].grouping_key_hash.len(), 64);
}

#[actix_web::test]
async fn test_release_populated_on_issue() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Release Project").await;
    let temp_dir = TempDir::new().unwrap();
    let cfg = create_rate_limit_config();

    ingest_event_with_tags(
        &db.pool, project.id, temp_dir.path(), &cfg,
        json!({}), json!({"id": "u1"}),
    ).await;
    let issue_id = only_issue_id(&db.pool, project.id).await;
    let issue = IssueService::get_by_id(&db.pool, issue_id).await.unwrap();
    assert_eq!(issue.first_release, "v1.0.0");
    assert_eq!(issue.last_release, "v1.0.0");
}

#[actix_web::test]
async fn test_bulk_set_status_and_delete() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Bulk Project").await;

    // Two distinct issues via direct service create.
    use rustrak::services::grouping::get_denormalized_fields;
    let d1 = get_denormalized_fields(&json!({"exception":{"values":[{"type":"A","value":"a"}]}}));
    let d2 = get_denormalized_fields(&json!({"exception":{"values":[{"type":"B","value":"b"}]}}));
    let i1 = IssueService::create(&db.pool, project.id, Utc::now(), &d1, Some("error"), Some("rust")).await.unwrap();
    let i2 = IssueService::create(&db.pool, project.id, Utc::now(), &d2, Some("error"), Some("rust")).await.unwrap();

    let updated = IssueService::bulk_set_status(&db.pool, project.id, &[i1.id, i2.id], "resolved").await.unwrap();
    assert_eq!(updated, 2);
    assert_eq!(IssueService::get_by_id(&db.pool, i1.id).await.unwrap().status, "resolved");
    assert_eq!(IssueService::get_by_id(&db.pool, i2.id).await.unwrap().status, "resolved");

    let deleted = IssueService::bulk_delete(&db.pool, project.id, &[i1.id, i2.id]).await.unwrap();
    assert_eq!(deleted, 2);
    assert!(IssueService::get_by_id(&db.pool, i1.id).await.is_err());
}

#[actix_web::test]
async fn test_tag_values_and_aggregates() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Tags Project").await;
    let temp_dir = TempDir::new().unwrap();
    let cfg = create_rate_limit_config();

    ingest_event_with_tags(&db.pool, project.id, temp_dir.path(), &cfg,
        json!({"browser": "chrome"}), json!({"id": "user-1"})).await;
    ingest_event_with_tags(&db.pool, project.id, temp_dir.path(), &cfg,
        json!({"browser": "chrome"}), json!({"id": "user-2"})).await;
    ingest_event_with_tags(&db.pool, project.id, temp_dir.path(), &cfg,
        json!({"browser": "firefox"}), json!({"id": "user-1"})).await;

    let issue_id = only_issue_id(&db.pool, project.id).await;

    let values = IssueService::tag_values(&db.pool, issue_id, "browser").await.unwrap();
    // chrome (2) ranks before firefox (1)
    assert_eq!(values[0].value, "chrome");
    assert_eq!(values[0].count, 2);
    assert!(values.iter().any(|v| v.value == "firefox" && v.count == 1));

    let agg = IssueService::aggregates(&db.pool, issue_id).await.unwrap();
    assert_eq!(agg.user_count, 2); // user-1, user-2
    let browser = agg.tags.iter().find(|t| t.key == "browser").unwrap();
    assert_eq!(browser.total_values, 2);
}

#[actix_web::test]
async fn test_list_offset_search_filters_by_text() {
    use rustrak::pagination::{IssueFilter, IssueSort, SortOrder};
    use rustrak::services::grouping::get_denormalized_fields;
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Search Project").await;

    let d1 = get_denormalized_fields(&json!({"exception":{"values":[{"type":"DatabaseError","value":"connection refused"}]}}));
    let d2 = get_denormalized_fields(&json!({"exception":{"values":[{"type":"TypeError","value":"undefined is not a function"}]}}));
    IssueService::create(&db.pool, project.id, Utc::now(), &d1, Some("error"), Some("rust")).await.unwrap();
    IssueService::create(&db.pool, project.id, Utc::now(), &d2, Some("error"), Some("rust")).await.unwrap();

    // Case-insensitive match on type.
    let (hits, total) = IssueService::list_offset(
        &db.pool, project.id, IssueSort::DigestOrder, SortOrder::Desc,
        IssueFilter::All, 1, 50, Some("databaseerror"),
    ).await.unwrap();
    assert_eq!(total, 1);
    assert_eq!(hits[0].calculated_type, "DatabaseError");

    // Match on value substring.
    let (hits, _) = IssueService::list_offset(
        &db.pool, project.id, IssueSort::DigestOrder, SortOrder::Desc,
        IssueFilter::All, 1, 50, Some("undefined"),
    ).await.unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].calculated_type, "TypeError");

    // No match.
    let (_, total) = IssueService::list_offset(
        &db.pool, project.id, IssueSort::DigestOrder, SortOrder::Desc,
        IssueFilter::All, 1, 50, Some("nonexistent"),
    ).await.unwrap();
    assert_eq!(total, 0);
}

// =============================================================================
// Activity, comments, bookmarks, subscriptions, seen, user reports (GH #165)
// =============================================================================

async fn seed_user_for_social(pool: &rustrak::db::DbPool, email: &str) -> i32 {
    use rustrak::models::{CreateUserRequest, UserRole};
    use rustrak::services::users::UsersService;
    UsersService::create_user(
        pool,
        &CreateUserRequest { email: email.to_string(), password: "password123".to_string() },
        UserRole::Admin,
    )
    .await
    .unwrap()
    .id
}

async fn seed_issue_direct(pool: &rustrak::db::DbPool, project_id: i32, t: &str) -> Uuid {
    use rustrak::services::grouping::get_denormalized_fields;
    let d = get_denormalized_fields(&json!({"exception":{"values":[{"type":t,"value":"x"}]}}));
    IssueService::create(pool, project_id, Utc::now(), &d, Some("error"), Some("rust"))
        .await
        .unwrap()
        .id
}

#[actix_web::test]
async fn test_activity_log_and_comments() {
    use rustrak::services::IssueSocialService;
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Activity Project").await;
    let user_id = seed_user_for_social(&db.pool, "act@x.com").await;
    let issue_id = seed_issue_direct(&db.pool, project.id, "ActErr").await;

    IssueSocialService::record_status_change(&db.pool, issue_id, Some(user_id), "resolved").await.unwrap();
    let note = IssueSocialService::add_comment(&db.pool, issue_id, Some(user_id), "looking into it").await.unwrap();
    assert_eq!(note.activity_type, "note");
    assert!(note.data.contains("looking into it"));

    let activity = IssueSocialService::list_activity(&db.pool, issue_id).await.unwrap();
    assert_eq!(activity.len(), 2);
    // newest first → the note
    assert_eq!(activity[0].activity_type, "note");
    assert_eq!(activity[1].activity_type, "set_status");
}

#[actix_web::test]
async fn test_bookmark_and_subscription_toggle() {
    use rustrak::services::IssueSocialService;
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Bookmark Project").await;
    let user_id = seed_user_for_social(&db.pool, "bm@x.com").await;
    let issue_id = seed_issue_direct(&db.pool, project.id, "BmErr").await;

    assert!(!IssueSocialService::is_bookmarked(&db.pool, issue_id, user_id).await.unwrap());
    IssueSocialService::set_bookmark(&db.pool, issue_id, user_id, true).await.unwrap();
    assert!(IssueSocialService::is_bookmarked(&db.pool, issue_id, user_id).await.unwrap());
    // idempotent
    IssueSocialService::set_bookmark(&db.pool, issue_id, user_id, true).await.unwrap();
    IssueSocialService::set_bookmark(&db.pool, issue_id, user_id, false).await.unwrap();
    assert!(!IssueSocialService::is_bookmarked(&db.pool, issue_id, user_id).await.unwrap());

    assert!(!IssueSocialService::is_subscribed(&db.pool, issue_id, user_id).await.unwrap());
    IssueSocialService::set_subscription(&db.pool, issue_id, user_id, true, "manual").await.unwrap();
    assert!(IssueSocialService::is_subscribed(&db.pool, issue_id, user_id).await.unwrap());
}

#[actix_web::test]
async fn test_seen_tracking_resets_on_new_event() {
    use rustrak::services::IssueSocialService;
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Seen Project").await;
    let user_id = seed_user_for_social(&db.pool, "seen@x.com").await;
    let temp_dir = TempDir::new().unwrap();
    let cfg = create_rate_limit_config();

    let e1 = Uuid::new_v4().to_string().replace("-", "");
    ingest_error_event(&db.pool, project.id, temp_dir.path(), &cfg, &e1).await;
    let issue_id = only_issue_id(&db.pool, project.id).await;

    assert!(!IssueSocialService::has_seen(&db.pool, issue_id, user_id).await.unwrap());
    IssueSocialService::mark_seen(&db.pool, issue_id, user_id).await.unwrap();
    assert!(IssueSocialService::has_seen(&db.pool, issue_id, user_id).await.unwrap());

    // A new event bumps last_seen → no longer "seen".
    tokio::time::sleep(std::time::Duration::from_millis(1100)).await;
    let e2 = Uuid::new_v4().to_string().replace("-", "");
    ingest_error_event(&db.pool, project.id, temp_dir.path(), &cfg, &e2).await;
    assert!(!IssueSocialService::has_seen(&db.pool, issue_id, user_id).await.unwrap());
}

#[actix_web::test]
async fn test_user_reports() {
    use rustrak::services::IssueSocialService;
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Reports Project").await;
    let issue_id = seed_issue_direct(&db.pool, project.id, "RepErr").await;

    assert_eq!(IssueSocialService::user_report_count(&db.pool, issue_id).await.unwrap(), 0);
    IssueSocialService::create_user_report(
        &db.pool, project.id, Some(issue_id), None,
        "Jane", "jane@x.com", "it broke when I clicked save",
    ).await.unwrap();

    let reports = IssueSocialService::list_user_reports(&db.pool, issue_id).await.unwrap();
    assert_eq!(reports.len(), 1);
    assert_eq!(reports[0].name, "Jane");
    assert_eq!(IssueSocialService::user_report_count(&db.pool, issue_id).await.unwrap(), 1);
}

// =============================================================================
// Stats timeseries + resolve-in-next-release + deploy finalization (GH #165)
// =============================================================================

#[actix_web::test]
async fn test_issue_stats_timeseries() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Stats Project").await;
    let temp_dir = TempDir::new().unwrap();
    let cfg = create_rate_limit_config();

    let e1 = Uuid::new_v4().to_string().replace("-", "");
    ingest_error_event(&db.pool, project.id, temp_dir.path(), &cfg, &e1).await;
    let issue_id = only_issue_id(&db.pool, project.id).await;

    let series = IssueService::stats(&db.pool, issue_id, 3600, 24).await.unwrap();
    assert_eq!(series.len(), 24);
    let total: i64 = series.iter().map(|(_, c)| *c).sum();
    assert_eq!(total, 1, "the one event should be counted exactly once");
    // It lands in one of the most recent buckets (alignment is relative to the
    // window start, so allow the last two).
    let recent: i64 = series.iter().rev().take(2).map(|(_, c)| *c).sum();
    assert_eq!(recent, 1);
    assert!(series[0].0 < series[23].0, "buckets ascend in time");
}

#[actix_web::test]
async fn test_resolve_in_next_release_suppresses_same_release_regression() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "RINR Project").await;
    let temp_dir = TempDir::new().unwrap();
    let cfg = create_rate_limit_config();

    // First event (release v1.0.0) creates the issue.
    ingest_event_with_tags(&db.pool, project.id, temp_dir.path(), &cfg,
        json!({}), json!({"id": "u1"})).await;
    let issue_id = only_issue_id(&db.pool, project.id).await;

    // Resolve in next release.
    IssueService::resolve_in_next_release(&db.pool, issue_id).await.unwrap();
    let i = IssueService::get_by_id(&db.pool, issue_id).await.unwrap();
    assert_eq!(i.status, "resolved");
    assert!(i.status_details.contains("in_next_release"));

    // A new event from the SAME release must NOT regress it.
    ingest_event_with_tags(&db.pool, project.id, temp_dir.path(), &cfg,
        json!({}), json!({"id": "u2"})).await;
    let i = IssueService::get_by_id(&db.pool, issue_id).await.unwrap();
    assert_eq!(i.status, "resolved", "same-release event should not regress");
}

#[actix_web::test]
async fn test_finalize_release_clears_marker() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Deploy Project").await;
    let temp_dir = TempDir::new().unwrap();
    let cfg = create_rate_limit_config();

    ingest_event_with_tags(&db.pool, project.id, temp_dir.path(), &cfg,
        json!({}), json!({"id": "u1"})).await; // last_release = v1.0.0
    let issue_id = only_issue_id(&db.pool, project.id).await;
    IssueService::resolve_in_next_release(&db.pool, issue_id).await.unwrap();

    // Deploy a different version → marker cleared.
    let finalized = IssueService::finalize_release(&db.pool, project.id, "v2.0.0").await.unwrap();
    assert_eq!(finalized, 1);
    let i = IssueService::get_by_id(&db.pool, issue_id).await.unwrap();
    assert!(!i.status_details.contains("in_next_release"));
    assert_eq!(i.status, "resolved");
}
