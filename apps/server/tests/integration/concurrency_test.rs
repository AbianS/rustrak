//! Concurrency tests for the Digest process
//!
//! Tests that verify the advisory lock mechanism properly handles concurrent
//! event processing without race conditions.

use crate::common::process_error_event;
use crate::common::TestDb;
use chrono::Utc;
use rustrak::config::RateLimitConfig;
use rustrak::ingest::{store_event, EventMetadata};
use rustrak::models::CreateProject;
use rustrak::pagination::{IssueSort, SortOrder};
use rustrak::services::{IssueService, ProjectService};
use serde_json::json;
use std::collections::HashSet;
use std::sync::Arc;
use tempfile::TempDir;
use uuid::Uuid;

fn create_rate_limit_config() -> RateLimitConfig {
    RateLimitConfig {
        max_events_per_minute: 10000,
        max_events_per_hour: 100000,
        max_events_per_project_per_minute: 5000,
        max_events_per_project_per_hour: 50000,
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

fn create_unique_event_json(error_type: &str, error_msg: &str) -> (String, serde_json::Value) {
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
    (event_id, event_json)
}

// =============================================================================
// Concurrent Issue Creation Tests - Same Project
// =============================================================================

/// Test that concurrent events with DIFFERENT error types create separate issues
/// with consecutive digest_order values (no gaps, no duplicates)
#[actix_web::test]
async fn test_concurrent_different_errors_same_project_creates_sequential_issues() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Concurrent Different Errors").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path().to_path_buf();
    let rate_limit_config = Arc::new(create_rate_limit_config());
    let pool = Arc::new(db.pool.clone());

    // Create 10 events with different error types (will create 10 issues)
    let num_events = 10;
    let mut handles = Vec::new();

    for i in 0..num_events {
        let pool_clone = Arc::clone(&pool);
        let ingest_dir_clone = ingest_dir.clone();
        let rate_limit_config_clone = Arc::clone(&rate_limit_config);
        let project_id = project.id;

        let handle = tokio::spawn(async move {
            let (event_id, event_json) =
                create_unique_event_json(&format!("Error{}", i), &format!("Message {}", i));
            let event_bytes = serde_json::to_vec(&event_json).unwrap();

            store_event(&ingest_dir_clone, &event_id, &event_bytes)
                .await
                .expect("Failed to store event");

            let metadata = EventMetadata {
                event_id: event_id.clone(),
                project_id,
                ingested_at: Utc::now(),
                remote_addr: None,
            };

            process_error_event(
                &pool_clone,
                &metadata,
                &ingest_dir_clone,
                &rate_limit_config_clone,
                crate::common::null_sourcemap_provider(),
            )
            .await
            .expect("Failed to process event");
        });

        handles.push(handle);
    }

    // Wait for all concurrent tasks to complete
    for handle in handles {
        handle.await.expect("Task panicked");
    }

    // Verify we have exactly 10 issues
    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        IssueSort::DigestOrder,
        SortOrder::Asc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(
        issues.len(),
        num_events,
        "Expected {} issues, got {}",
        num_events,
        issues.len()
    );

    // Verify digest_order values are consecutive (1, 2, 3, ..., 10) with no gaps
    let digest_orders: Vec<i32> = issues.iter().map(|i| i.digest_order).collect();
    let expected_orders: Vec<i32> = (1..=num_events as i32).collect();

    // Check that we have all expected values (order doesn't matter due to concurrency)
    let digest_orders_set: HashSet<i32> = digest_orders.iter().cloned().collect();
    let expected_set: HashSet<i32> = expected_orders.iter().cloned().collect();

    assert_eq!(
        digest_orders_set, expected_set,
        "digest_order values should be consecutive 1-{} without gaps. Got: {:?}",
        num_events, digest_orders
    );
}

/// Test that concurrent events with SAME error type are grouped into one issue
#[actix_web::test]
async fn test_concurrent_same_errors_same_project_groups_into_one_issue() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Concurrent Same Errors").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path().to_path_buf();
    let rate_limit_config = Arc::new(create_rate_limit_config());
    let pool = Arc::new(db.pool.clone());

    // Create 10 events with SAME error type (should all be grouped into 1 issue)
    let num_events = 10;
    let mut handles = Vec::new();

    for _i in 0..num_events {
        let pool_clone = Arc::clone(&pool);
        let ingest_dir_clone = ingest_dir.clone();
        let rate_limit_config_clone = Arc::clone(&rate_limit_config);
        let project_id = project.id;

        let handle = tokio::spawn(async move {
            let (event_id, event_json) =
                create_unique_event_json("SameError", "Same message for grouping");
            let event_bytes = serde_json::to_vec(&event_json).unwrap();

            store_event(&ingest_dir_clone, &event_id, &event_bytes)
                .await
                .expect("Failed to store event");

            let metadata = EventMetadata {
                event_id: event_id.clone(),
                project_id,
                ingested_at: Utc::now(),
                remote_addr: None,
            };

            process_error_event(
                &pool_clone,
                &metadata,
                &ingest_dir_clone,
                &rate_limit_config_clone,
                crate::common::null_sourcemap_provider(),
            )
            .await
            .expect("Failed to process event");
        });

        handles.push(handle);
    }

    // Wait for all concurrent tasks to complete
    for handle in handles {
        handle.await.expect("Task panicked");
    }

    // Verify we have exactly 1 issue with 10 events
    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        IssueSort::DigestOrder,
        SortOrder::Asc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(issues.len(), 1, "Expected 1 issue, got {}", issues.len());
    assert_eq!(
        issues[0].digested_event_count, num_events,
        "Expected {} events in issue, got {}",
        num_events, issues[0].digested_event_count
    );
}

// =============================================================================
// Concurrent Issue Creation Tests - Different Projects
// =============================================================================

/// Test that concurrent events in DIFFERENT projects can be processed in parallel
/// (advisory locks are per-project, so they shouldn't block each other)
#[actix_web::test]
async fn test_concurrent_different_projects_process_in_parallel() {
    let db = TestDb::new().await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path().to_path_buf();
    let rate_limit_config = Arc::new(create_rate_limit_config());
    let pool = Arc::new(db.pool.clone());

    // Create 5 different projects
    let num_projects = 5;
    let mut projects = Vec::new();
    for i in 0..num_projects {
        let project = create_test_project(&db.pool, &format!("Project {}", i)).await;
        projects.push(project);
    }

    // Create 5 events per project (25 total), all with different error types
    let events_per_project = 5;
    let mut handles = Vec::new();

    for project in &projects {
        for j in 0..events_per_project {
            let pool_clone = Arc::clone(&pool);
            let ingest_dir_clone = ingest_dir.clone();
            let rate_limit_config_clone = Arc::clone(&rate_limit_config);
            let project_id = project.id;

            let handle = tokio::spawn(async move {
                let (event_id, event_json) = create_unique_event_json(
                    &format!("Error_P{}_E{}", project_id, j),
                    &format!("Message {} {}", project_id, j),
                );
                let event_bytes = serde_json::to_vec(&event_json).unwrap();

                store_event(&ingest_dir_clone, &event_id, &event_bytes)
                    .await
                    .expect("Failed to store event");

                let metadata = EventMetadata {
                    event_id: event_id.clone(),
                    project_id,
                    ingested_at: Utc::now(),
                    remote_addr: None,
                };

                process_error_event(
                    &pool_clone,
                    &metadata,
                    &ingest_dir_clone,
                    &rate_limit_config_clone,
                    crate::common::null_sourcemap_provider(),
                )
                .await
                .expect("Failed to process event");
            });

            handles.push(handle);
        }
    }

    // Wait for all concurrent tasks to complete
    for handle in handles {
        handle.await.expect("Task panicked");
    }

    // Verify each project has exactly 5 issues with consecutive digest_order
    for project in &projects {
        let (issues, _) = IssueService::list_paginated(
            &db.pool,
            project.id,
            IssueSort::DigestOrder,
            SortOrder::Asc,
            true,
            None,
            100,
        )
        .await
        .expect("Failed to list issues");

        assert_eq!(
            issues.len(),
            events_per_project,
            "Project {} should have {} issues, got {}",
            project.id,
            events_per_project,
            issues.len()
        );

        // Verify digest_order values are consecutive
        let digest_orders: HashSet<i32> = issues.iter().map(|i| i.digest_order).collect();
        let expected: HashSet<i32> = (1..=events_per_project as i32).collect();

        assert_eq!(
            digest_orders, expected,
            "Project {} digest_orders should be 1-{}, got {:?}",
            project.id, events_per_project, digest_orders
        );
    }
}

// =============================================================================
// High Concurrency Stress Test
// =============================================================================

/// Stress test with high concurrency to ensure no race conditions
#[actix_web::test]
async fn test_high_concurrency_stress_test() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Stress Test Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path().to_path_buf();
    let rate_limit_config = Arc::new(create_rate_limit_config());
    let pool = Arc::new(db.pool.clone());

    // Create 50 concurrent events with different error types
    let num_events = 50;
    let mut handles = Vec::new();

    for i in 0..num_events {
        let pool_clone = Arc::clone(&pool);
        let ingest_dir_clone = ingest_dir.clone();
        let rate_limit_config_clone = Arc::clone(&rate_limit_config);
        let project_id = project.id;

        let handle = tokio::spawn(async move {
            let (event_id, event_json) = create_unique_event_json(
                &format!("StressError{}", i),
                &format!("Stress msg {}", i),
            );
            let event_bytes = serde_json::to_vec(&event_json).unwrap();

            store_event(&ingest_dir_clone, &event_id, &event_bytes)
                .await
                .expect("Failed to store event");

            let metadata = EventMetadata {
                event_id: event_id.clone(),
                project_id,
                ingested_at: Utc::now(),
                remote_addr: None,
            };

            process_error_event(
                &pool_clone,
                &metadata,
                &ingest_dir_clone,
                &rate_limit_config_clone,
                crate::common::null_sourcemap_provider(),
            )
            .await
            .expect("Failed to process event");
        });

        handles.push(handle);
    }

    // Wait for all concurrent tasks to complete
    for handle in handles {
        handle.await.expect("Task panicked");
    }

    // Verify we have exactly 50 issues
    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        IssueSort::DigestOrder,
        SortOrder::Asc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(
        issues.len(),
        num_events,
        "Expected {} issues, got {}",
        num_events,
        issues.len()
    );

    // Verify NO GAPS in digest_order (all values 1 through 50 must exist)
    let digest_orders: HashSet<i32> = issues.iter().map(|i| i.digest_order).collect();
    let expected: HashSet<i32> = (1..=num_events as i32).collect();

    assert_eq!(
        digest_orders, expected,
        "digest_order should be consecutive 1-{} with NO GAPS. Got: {:?}",
        num_events, digest_orders
    );

    // Verify NO DUPLICATES (set size should equal vector size)
    let digest_orders_vec: Vec<i32> = issues.iter().map(|i| i.digest_order).collect();
    assert_eq!(
        digest_orders_vec.len(),
        digest_orders.len(),
        "There should be no duplicate digest_order values"
    );
}

// =============================================================================
// Edge Case: Mixed Concurrent Operations
// =============================================================================

/// Test mixed operations: some events create new issues, others update existing ones
#[actix_web::test]
async fn test_concurrent_mixed_create_and_update() {
    let db = TestDb::new().await;
    let project = create_test_project(&db.pool, "Mixed Operations Project").await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let ingest_dir = temp_dir.path().to_path_buf();
    let rate_limit_config = Arc::new(create_rate_limit_config());
    let pool = Arc::new(db.pool.clone());

    // Create events:
    // - 5 unique error types (create 5 new issues)
    // - 3 copies of each error type (update existing issues)
    // Total: 20 events, 5 issues, 4 events per issue
    let error_types = vec!["ErrorA", "ErrorB", "ErrorC", "ErrorD", "ErrorE"];
    let copies_per_error = 4;
    let mut handles = Vec::new();

    for error_type in &error_types {
        for _copy in 0..copies_per_error {
            let pool_clone = Arc::clone(&pool);
            let ingest_dir_clone = ingest_dir.clone();
            let rate_limit_config_clone = Arc::clone(&rate_limit_config);
            let project_id = project.id;
            let error_type = error_type.to_string();

            let handle = tokio::spawn(async move {
                let (event_id, event_json) =
                    create_unique_event_json(&error_type, "Same message for grouping");
                let event_bytes = serde_json::to_vec(&event_json).unwrap();

                store_event(&ingest_dir_clone, &event_id, &event_bytes)
                    .await
                    .expect("Failed to store event");

                let metadata = EventMetadata {
                    event_id: event_id.clone(),
                    project_id,
                    ingested_at: Utc::now(),
                    remote_addr: None,
                };

                process_error_event(
                    &pool_clone,
                    &metadata,
                    &ingest_dir_clone,
                    &rate_limit_config_clone,
                    crate::common::null_sourcemap_provider(),
                )
                .await
                .expect("Failed to process event");
            });

            handles.push(handle);
        }
    }

    // Wait for all concurrent tasks to complete
    for handle in handles {
        handle.await.expect("Task panicked");
    }

    // Verify we have exactly 5 issues
    let (issues, _) = IssueService::list_paginated(
        &db.pool,
        project.id,
        IssueSort::DigestOrder,
        SortOrder::Asc,
        true,
        None,
        100,
    )
    .await
    .expect("Failed to list issues");

    assert_eq!(issues.len(), 5, "Expected 5 issues, got {}", issues.len());

    // Verify each issue has 4 events
    for issue in &issues {
        assert_eq!(
            issue.digested_event_count, copies_per_error,
            "Each issue should have {} events, issue {} has {}",
            copies_per_error, issue.id, issue.digested_event_count
        );
    }

    // Verify digest_order is consecutive 1-5
    let digest_orders: HashSet<i32> = issues.iter().map(|i| i.digest_order).collect();
    let expected: HashSet<i32> = (1..=5).collect();
    assert_eq!(
        digest_orders, expected,
        "digest_order should be 1-5, got {:?}",
        digest_orders
    );
}
