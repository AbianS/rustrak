//! Unit tests for the missed/timeout detection worker logic
//! (`MonitorService::process_overdue`). The worker loop is a thin wrapper; the
//! detection logic is exercised here by passing an explicit `now`.

use crate::common::TestDb;
use chrono::{Duration, Utc};
use rustrak::digest::processors::{CheckInProcessor, Processor, ProcessorCtx};
use rustrak::models::CreateProject;
use rustrak::services::monitor::MonitorService;
use rustrak::services::ProjectService;
use uuid::Uuid;

async fn new_project(pool: &rustrak::db::DbPool, name: &str) -> i32 {
    ProjectService::create(
        pool,
        CreateProject {
            name: name.to_string(),
            slug: None,
        },
    )
    .await
    .unwrap()
    .id
}

fn ctx(pool: &rustrak::db::DbPool, project_id: i32) -> ProcessorCtx {
    ProcessorCtx {
        pool: pool.clone(),
        project_id,
        event_id: Uuid::new_v4(),
        ingested_at: Utc::now(),
        remote_addr: None,
    }
}

#[tokio::test]
async fn test_overdue_monitor_marked_missed() {
    let db = TestDb::new().await;
    let project_id = new_project(&db.pool, "worker-missed").await;

    // Hourly monitor; an ok check-in sets next_expected ≈ now + 1h.
    let body = br#"{"monitor_slug":"hourly","status":"ok","monitor_config":{"schedule":{"type":"interval","value":1,"unit":"hour"}}}"#.to_vec();
    CheckInProcessor
        .process(body, &ctx(&db.pool, project_id))
        .await
        .unwrap();

    // Two hours later the expected check-in never arrived → missed.
    let future = Utc::now() + Duration::hours(2);
    MonitorService::process_overdue(&db.pool, future)
        .await
        .unwrap();

    let status: String = sqlx::query_scalar("SELECT status FROM monitors WHERE project_id = $1")
        .bind(project_id)
        .fetch_one(&db.pool)
        .await
        .unwrap();
    assert_eq!(status, "missed");

    let missed_rows: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM check_ins WHERE project_id = $1 AND status = 'missed'",
    )
    .bind(project_id)
    .fetch_one(&db.pool)
    .await
    .unwrap();
    assert_eq!(missed_rows, 1, "a missed check-in is recorded in history");

    // The deadline advances past `future` so it doesn't fire again next tick.
    let next: chrono::DateTime<chrono::Utc> =
        sqlx::query_scalar("SELECT next_expected_at FROM monitors WHERE project_id = $1")
            .bind(project_id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
    assert!(next > future, "next_expected_at must advance beyond now");
}

#[tokio::test]
async fn test_not_yet_due_monitor_stays_ok() {
    let db = TestDb::new().await;
    let project_id = new_project(&db.pool, "worker-ok").await;

    let body = br#"{"monitor_slug":"hourly","status":"ok","monitor_config":{"schedule":{"type":"interval","value":1,"unit":"hour"}}}"#.to_vec();
    CheckInProcessor
        .process(body, &ctx(&db.pool, project_id))
        .await
        .unwrap();

    // Only 10 minutes later — well within the hour.
    let soon = Utc::now() + Duration::minutes(10);
    MonitorService::process_overdue(&db.pool, soon)
        .await
        .unwrap();

    let status: String = sqlx::query_scalar("SELECT status FROM monitors WHERE project_id = $1")
        .bind(project_id)
        .fetch_one(&db.pool)
        .await
        .unwrap();
    assert_eq!(status, "ok", "a monitor within its window is untouched");
}

#[tokio::test]
async fn test_in_progress_exceeding_max_runtime_marked_timeout() {
    let db = TestDb::new().await;
    let project_id = new_project(&db.pool, "worker-timeout").await;

    // A run that opened (in_progress) but never closed, max_runtime 30 min.
    let body = br#"{"monitor_slug":"job","status":"in_progress","monitor_config":{"schedule":{"type":"interval","value":1,"unit":"hour"},"max_runtime":30}}"#.to_vec();
    CheckInProcessor
        .process(body, &ctx(&db.pool, project_id))
        .await
        .unwrap();

    // 45 min later: past the 30-min runtime, but before the 1h next check-in.
    let future = Utc::now() + Duration::minutes(45);
    MonitorService::process_overdue(&db.pool, future)
        .await
        .unwrap();

    let ci_status: String =
        sqlx::query_scalar("SELECT status FROM check_ins WHERE project_id = $1")
            .bind(project_id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
    assert_eq!(
        ci_status, "timeout",
        "an overrunning in_progress run times out"
    );

    let mon_status: String =
        sqlx::query_scalar("SELECT status FROM monitors WHERE project_id = $1")
            .bind(project_id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
    assert_eq!(mon_status, "timeout");
}
