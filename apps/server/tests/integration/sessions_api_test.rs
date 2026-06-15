//! Integration tests for SessionService::release_health
//!
//! These tests insert raw rows directly into session_counts / session_users
//! and verify that the query:
//!   - sums counters correctly across buckets (regression for SUM(BIGINT)→NUMERIC issue)
//!   - computes healthy = total - errored - crashed - abnormal
//!   - computes crash-free rates
//!   - respects the time-window filter
//!   - filters by project_id
//!   - orders by total DESC

use crate::common::TestDb;
use rustrak::db::DbPool;
use rustrak::services::session::SessionService;

// ── seed helpers ─────────────────────────────────────────────────────────────

/// Insert one row into session_counts.
/// `hours_ago` controls how old the bucket timestamp is.
#[allow(clippy::too_many_arguments)]
async fn seed_count(
    pool: &DbPool,
    project_id: i32,
    release: &str,
    env: &str,
    hours_ago: i64,
    total: i64,
    errored: i64,
    crashed: i64,
    abnormal: i64,
) {
    #[cfg(feature = "postgres")]
    sqlx::query(
        r#"
        INSERT INTO session_counts
            (project_id, release, environment, bucket, total, errored, crashed, abnormal)
        VALUES ($1, $2, $3, NOW() - ($4::text || ' hours')::interval, $5, $6, $7, $8)
        "#,
    )
    .bind(project_id)
    .bind(release)
    .bind(env)
    .bind(hours_ago.to_string())
    .bind(total)
    .bind(errored)
    .bind(crashed)
    .bind(abnormal)
    .execute(pool)
    .await
    .expect("seed_count failed");

    #[cfg(not(feature = "postgres"))]
    sqlx::query(
        r#"
        INSERT INTO session_counts
            (project_id, release, environment, bucket, total, errored, crashed, abnormal)
        VALUES (?1, ?2, ?3, datetime('now', '-' || ?4 || ' hours'), ?5, ?6, ?7, ?8)
        "#,
    )
    .bind(project_id)
    .bind(release)
    .bind(env)
    .bind(hours_ago.to_string())
    .bind(total)
    .bind(errored)
    .bind(crashed)
    .bind(abnormal)
    .execute(pool)
    .await
    .expect("seed_count failed");
}

/// Insert one row into session_users using today's date.
async fn seed_user(
    pool: &DbPool,
    project_id: i32,
    release: &str,
    env: &str,
    did: &str,
    crashed: bool,
) {
    #[cfg(feature = "postgres")]
    sqlx::query(
        r#"
        INSERT INTO session_users (project_id, release, environment, day, did, crashed)
        VALUES ($1, $2, $3, CURRENT_DATE, $4, $5)
        ON CONFLICT (project_id, release, environment, day, did)
        DO UPDATE SET crashed = session_users.crashed OR EXCLUDED.crashed
        "#,
    )
    .bind(project_id)
    .bind(release)
    .bind(env)
    .bind(did)
    .bind(crashed)
    .execute(pool)
    .await
    .expect("seed_user failed");

    #[cfg(not(feature = "postgres"))]
    sqlx::query(
        r#"
        INSERT INTO session_users (project_id, release, environment, day, did, crashed)
        VALUES (?1, ?2, ?3, date('now'), ?4, ?5)
        ON CONFLICT (project_id, release, environment, day, did)
        DO UPDATE SET crashed = MAX(session_users.crashed, excluded.crashed)
        "#,
    )
    .bind(project_id)
    .bind(release)
    .bind(env)
    .bind(did)
    .bind(if crashed { 1i64 } else { 0i64 })
    .execute(pool)
    .await
    .expect("seed_user failed");
}

/// Create a project and return its id.
async fn create_project(pool: &DbPool, name: &str) -> i32 {
    rustrak::services::ProjectService::create(
        pool,
        rustrak::models::CreateProject {
            name: name.to_string(),
            slug: None,
        },
    )
    .await
    .expect("create_project failed")
    .id
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_release_health_empty_returns_empty() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Empty Project").await;

    let rows = SessionService::release_health(&db.pool, project_id, 24)
        .await
        .expect("query failed");

    assert!(rows.is_empty());
}

#[actix_web::test]
async fn test_release_health_sums_across_buckets() {
    // This is the primary regression test for the SUM(BIGINT)→NUMERIC issue.
    // Two buckets for the same release — totals must be summed, not returned as separate rows.
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Sum Project").await;

    seed_count(&db.pool, project_id, "1.0.0", "production", 1, 100, 5, 3, 2).await;
    seed_count(
        &db.pool,
        project_id,
        "1.0.0",
        "production",
        2,
        200,
        10,
        6,
        4,
    )
    .await;

    let rows = SessionService::release_health(&db.pool, project_id, 24)
        .await
        .expect("query failed");

    assert_eq!(rows.len(), 1);
    let row = &rows[0];
    assert_eq!(row.release, "1.0.0");
    assert_eq!(row.environment, "production");
    assert_eq!(row.total, 300);
    assert_eq!(row.errored, 15);
    assert_eq!(row.crashed, 9);
    assert_eq!(row.abnormal, 6);
}

#[actix_web::test]
async fn test_release_health_healthy_is_total_minus_unhealthy() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Healthy Project").await;

    // total=100, errored=5, crashed=3, abnormal=2 → healthy=90
    seed_count(&db.pool, project_id, "2.0.0", "staging", 1, 100, 5, 3, 2).await;

    let rows = SessionService::release_health(&db.pool, project_id, 24)
        .await
        .expect("query failed");

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].healthy, 90);
}

#[actix_web::test]
async fn test_release_health_excludes_buckets_outside_window() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Window Project").await;

    // 1h ago: inside 24h window
    seed_count(&db.pool, project_id, "3.0.0", "production", 1, 50, 0, 0, 0).await;
    // 48h ago: outside 24h window — must be excluded
    seed_count(
        &db.pool,
        project_id,
        "3.0.0",
        "production",
        48,
        9999,
        0,
        0,
        0,
    )
    .await;

    let rows = SessionService::release_health(&db.pool, project_id, 24)
        .await
        .expect("query failed");

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].total, 50, "old bucket must not contribute to total");
}

#[actix_web::test]
async fn test_release_health_excludes_other_projects() {
    let db = TestDb::new().await;
    let project_a = create_project(&db.pool, "Project A").await;
    let project_b = create_project(&db.pool, "Project B").await;

    seed_count(&db.pool, project_a, "1.0.0", "prod", 1, 10, 0, 0, 0).await;
    seed_count(&db.pool, project_b, "1.0.0", "prod", 1, 999, 0, 0, 0).await;

    let rows = SessionService::release_health(&db.pool, project_a, 24)
        .await
        .expect("query failed");

    assert_eq!(rows.len(), 1);
    assert_eq!(
        rows[0].total, 10,
        "other project's data must not be visible"
    );
}

#[actix_web::test]
async fn test_release_health_orders_by_total_desc() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Order Project").await;

    seed_count(&db.pool, project_id, "small", "prod", 1, 10, 0, 0, 0).await;
    seed_count(&db.pool, project_id, "large", "prod", 1, 500, 0, 0, 0).await;
    seed_count(&db.pool, project_id, "medium", "prod", 1, 100, 0, 0, 0).await;

    let rows = SessionService::release_health(&db.pool, project_id, 24)
        .await
        .expect("query failed");

    assert_eq!(rows.len(), 3);
    assert_eq!(rows[0].release, "large");
    assert_eq!(rows[1].release, "medium");
    assert_eq!(rows[2].release, "small");
}

#[actix_web::test]
async fn test_release_health_crash_free_sessions_rate() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "CFR Sessions Project").await;

    // 100 total, 10 crashed → crash_free_sessions_rate = 0.90
    seed_count(&db.pool, project_id, "1.0.0", "prod", 1, 100, 0, 10, 0).await;

    let rows = SessionService::release_health(&db.pool, project_id, 24)
        .await
        .expect("query failed");

    assert_eq!(rows.len(), 1);
    let rate = rows[0]
        .crash_free_sessions_rate
        .expect("crash_free_sessions_rate must be Some when total > 0");
    assert!((rate - 0.9).abs() < 1e-9, "expected 0.9, got {}", rate);
}

#[actix_web::test]
async fn test_release_health_crash_free_sessions_rate_is_none_when_no_sessions() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Zero Sessions Project").await;

    // 0 total → rate must be None (CASE WHEN total > 0)
    seed_count(&db.pool, project_id, "1.0.0", "prod", 1, 0, 0, 0, 0).await;

    let rows = SessionService::release_health(&db.pool, project_id, 24)
        .await
        .expect("query failed");

    // A bucket with all zeros should still surface via GROUP BY:
    assert_eq!(
        rows.len(),
        1,
        "zero-total bucket should produce one grouped row"
    );
    assert!(
        rows[0].crash_free_sessions_rate.is_none(),
        "rate must be None when total is 0"
    );
}

#[actix_web::test]
async fn test_release_health_crash_free_users_rate() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "CFR Users Project").await;

    seed_count(&db.pool, project_id, "1.0.0", "prod", 1, 10, 0, 2, 0).await;

    // 4 distinct users, 2 of them crashed → crash_free_users_rate = 0.50
    seed_user(&db.pool, project_id, "1.0.0", "prod", "user-1", false).await;
    seed_user(&db.pool, project_id, "1.0.0", "prod", "user-2", false).await;
    seed_user(&db.pool, project_id, "1.0.0", "prod", "user-3", true).await;
    seed_user(&db.pool, project_id, "1.0.0", "prod", "user-4", true).await;

    let rows = SessionService::release_health(&db.pool, project_id, 24)
        .await
        .expect("query failed");

    assert_eq!(rows.len(), 1);
    let rate = rows[0]
        .crash_free_users_rate
        .expect("crash_free_users_rate must be Some when users exist");
    assert!((rate - 0.5).abs() < 1e-9, "expected 0.5, got {}", rate);
}

#[actix_web::test]
async fn test_release_health_multiple_releases_independent() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Multi Release Project").await;

    seed_count(&db.pool, project_id, "1.0.0", "prod", 1, 100, 5, 10, 2).await;
    seed_count(&db.pool, project_id, "2.0.0", "prod", 1, 50, 1, 0, 0).await;

    let rows = SessionService::release_health(&db.pool, project_id, 24)
        .await
        .expect("query failed");

    assert_eq!(rows.len(), 2);
    // rows[0] = 1.0.0 (total=100), rows[1] = 2.0.0 (total=50)
    let r1 = rows.iter().find(|r| r.release == "1.0.0").unwrap();
    let r2 = rows.iter().find(|r| r.release == "2.0.0").unwrap();

    assert_eq!(r1.total, 100);
    assert_eq!(r1.healthy, 83); // 100-5-10-2
    assert_eq!(r2.total, 50);
    assert_eq!(r2.healthy, 49); // 50-1-0-0
}
