//! Integration tests for `StatsService` (project overview stats).
//!
//! These seed raw `events` and `issues` rows and verify that:
//!   - the timeseries splits volume by severity and the segments sum to total
//!   - unknown levels fold into `info` instead of vanishing
//!   - transactions never leak into the error-volume series
//!   - buckets are zero-filled across the window
//!   - counters split the current window from the one before it
//!   - everything is scoped to one project

use rustrak::db::DbPool;
use rustrak::services::stats::StatsService;
use uuid::Uuid;

use crate::common::TestDb;

// ── seed helpers ─────────────────────────────────────────────────────────────

/// Insert one row into `events`, `hours_ago` old.
async fn seed_event(
    pool: &DbPool,
    project_id: i32,
    issue_id: Option<Uuid>,
    level: &str,
    event_type: &str,
    hours_ago: i64,
) {
    #[cfg(feature = "postgres")]
    sqlx::query(
        r#"
        INSERT INTO events
            (event_id, project_id, issue_id, data, timestamp, ingested_at, level, event_type)
        VALUES (
            $1, $2, $3, '{}'::jsonb,
            NOW() - ($4::text || ' hours')::interval,
            NOW() - ($4::text || ' hours')::interval,
            $5, $6
        )
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(project_id)
    .bind(issue_id)
    .bind(hours_ago.to_string())
    .bind(level)
    .bind(event_type)
    .execute(pool)
    .await
    .expect("seed_event failed");

    #[cfg(not(feature = "postgres"))]
    sqlx::query(
        r#"
        INSERT INTO events
            (event_id, project_id, issue_id, data, timestamp, ingested_at, level, event_type)
        VALUES (
            ?1, ?2, ?3, '{}',
            datetime('now', '-' || ?4 || ' hours'),
            datetime('now', '-' || ?4 || ' hours'),
            ?5, ?6
        )
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(project_id)
    .bind(issue_id)
    .bind(hours_ago.to_string())
    .bind(level)
    .bind(event_type)
    .execute(pool)
    .await
    .expect("seed_event failed");
}

/// Insert one row into `issues`, first seen `hours_ago` ago.
async fn seed_issue(pool: &DbPool, project_id: i32, digest_order: i32, hours_ago: i64) -> Uuid {
    let id = Uuid::new_v4();

    #[cfg(feature = "postgres")]
    sqlx::query(
        r#"
        INSERT INTO issues (id, project_id, digest_order, first_seen, last_seen, status)
        VALUES (
            $1, $2, $3,
            NOW() - ($4::text || ' hours')::interval,
            NOW() - ($4::text || ' hours')::interval,
            $5
        )
        "#,
    )
    .bind(id)
    .bind(project_id)
    .bind(digest_order)
    .bind(hours_ago.to_string())
    .bind("unresolved")
    .execute(pool)
    .await
    .expect("seed_issue failed");

    #[cfg(not(feature = "postgres"))]
    sqlx::query(
        r#"
        INSERT INTO issues (id, project_id, digest_order, first_seen, last_seen, status)
        VALUES (
            ?1, ?2, ?3,
            datetime('now', '-' || ?4 || ' hours'),
            datetime('now', '-' || ?4 || ' hours'),
            ?5
        )
        "#,
    )
    .bind(id)
    .bind(project_id)
    .bind(digest_order)
    .bind(hours_ago.to_string())
    .bind("unresolved")
    .execute(pool)
    .await
    .expect("seed_issue failed");

    id
}

async fn create_project(pool: &DbPool, name: &str) -> i32 {
    rustrak::services::ProjectService::create(
        pool,
        rustrak::models::CreateProject {
            name: name.to_string(),
            slug: None,
            platform: None,
        },
    )
    .await
    .expect("create_project failed")
    .id
}

// ── timeseries ───────────────────────────────────────────────────────────────

#[actix_web::test]
async fn timeseries_on_empty_project_is_all_zeros() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Stats Empty").await;

    let points = StatsService::event_timeseries(&db.pool, project_id, Some(24), 1)
        .await
        .expect("query failed");

    // Zero-filled, not empty: a quiet day is 25 bars of height zero.
    assert_eq!(points.len(), 25);
    assert!(points.iter().all(|p| p.total == 0));
}

#[actix_web::test]
async fn timeseries_splits_volume_by_severity() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Stats Severity").await;

    seed_event(&db.pool, project_id, None, "fatal", "error", 2).await;
    seed_event(&db.pool, project_id, None, "error", "error", 2).await;
    seed_event(&db.pool, project_id, None, "error", "error", 2).await;
    seed_event(&db.pool, project_id, None, "warning", "error", 2).await;
    seed_event(&db.pool, project_id, None, "info", "error", 2).await;

    let points = StatsService::event_timeseries(&db.pool, project_id, Some(24), 1)
        .await
        .expect("query failed");

    assert_eq!(points.iter().map(|p| p.fatal).sum::<i64>(), 1);
    assert_eq!(points.iter().map(|p| p.error).sum::<i64>(), 2);
    assert_eq!(points.iter().map(|p| p.warning).sum::<i64>(), 1);
    assert_eq!(points.iter().map(|p| p.info).sum::<i64>(), 1);
    assert_eq!(points.iter().map(|p| p.total).sum::<i64>(), 5);
}

#[actix_web::test]
async fn timeseries_segments_always_sum_to_total() {
    // `debug` and any level we do not model must land in `info`, or the
    // stacked segments would not add up to the bar height.
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Stats Unknown Level").await;

    seed_event(&db.pool, project_id, None, "debug", "error", 1).await;
    seed_event(&db.pool, project_id, None, "wat", "error", 1).await;
    seed_event(&db.pool, project_id, None, "", "error", 1).await;

    let points = StatsService::event_timeseries(&db.pool, project_id, Some(24), 1)
        .await
        .expect("query failed");

    for p in &points {
        assert_eq!(p.total, p.fatal + p.error + p.warning + p.info);
    }
    assert_eq!(points.iter().map(|p| p.info).sum::<i64>(), 3);
}

#[actix_web::test]
async fn timeseries_excludes_transactions() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Stats Txn").await;

    seed_event(&db.pool, project_id, None, "error", "error", 1).await;
    seed_event(&db.pool, project_id, None, "info", "transaction", 1).await;
    seed_event(&db.pool, project_id, None, "info", "transaction", 1).await;

    let points = StatsService::event_timeseries(&db.pool, project_id, Some(24), 1)
        .await
        .expect("query failed");

    assert_eq!(points.iter().map(|p| p.total).sum::<i64>(), 1);
}

#[actix_web::test]
async fn timeseries_respects_the_window() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Stats Window").await;

    seed_event(&db.pool, project_id, None, "error", "error", 1).await;
    seed_event(&db.pool, project_id, None, "error", "error", 100).await;

    let points = StatsService::event_timeseries(&db.pool, project_id, Some(24), 1)
        .await
        .expect("query failed");

    assert_eq!(points.iter().map(|p| p.total).sum::<i64>(), 1);
}

#[actix_web::test]
async fn timeseries_is_scoped_to_one_project() {
    let db = TestDb::new().await;
    let mine = create_project(&db.pool, "Stats Mine").await;
    let theirs = create_project(&db.pool, "Stats Theirs").await;

    seed_event(&db.pool, mine, None, "error", "error", 1).await;
    seed_event(&db.pool, theirs, None, "error", "error", 1).await;
    seed_event(&db.pool, theirs, None, "error", "error", 1).await;

    let points = StatsService::event_timeseries(&db.pool, mine, Some(24), 1)
        .await
        .expect("query failed");

    assert_eq!(points.iter().map(|p| p.total).sum::<i64>(), 1);
}

#[actix_web::test]
async fn timeseries_honours_a_wider_interval() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Stats Interval").await;

    seed_event(&db.pool, project_id, None, "error", "error", 1).await;

    let points = StatsService::event_timeseries(&db.pool, project_id, Some(24), 6)
        .await
        .expect("query failed");

    // 24h in 6h buckets, inclusive at both ends.
    assert_eq!(points.len(), 5);
    assert_eq!(points.iter().map(|p| p.total).sum::<i64>(), 1);
}

// ── summary ──────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn summary_on_empty_project_is_zeroed() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Summary Empty").await;

    let summary = StatsService::project_summary(&db.pool, project_id, Some(24))
        .await
        .expect("query failed");

    assert_eq!(summary.period_hours, Some(24));
    assert_eq!(summary.events.current, 0);
    assert_eq!(summary.events.previous, Some(0));
    assert_eq!(summary.new_issues.current, 0);
    assert_eq!(summary.open_issues, 0);
}

#[actix_web::test]
async fn summary_splits_events_into_current_and_previous_windows() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Summary Events").await;

    // Inside the last 24h.
    seed_event(&db.pool, project_id, None, "error", "error", 1).await;
    seed_event(&db.pool, project_id, None, "error", "error", 10).await;
    // Inside the 24h before that.
    seed_event(&db.pool, project_id, None, "error", "error", 30).await;
    // Older than both windows, so counted in neither.
    seed_event(&db.pool, project_id, None, "error", "error", 100).await;

    let summary = StatsService::project_summary(&db.pool, project_id, Some(24))
        .await
        .expect("query failed");

    assert_eq!(summary.events.current, 2);
    assert_eq!(summary.events.previous, Some(1));
}

#[actix_web::test]
async fn summary_counts_new_issues_by_first_seen() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Summary New Issues").await;

    seed_issue(&db.pool, project_id, 1, 2).await;
    seed_issue(&db.pool, project_id, 2, 5).await;
    seed_issue(&db.pool, project_id, 3, 30).await;

    let summary = StatsService::project_summary(&db.pool, project_id, Some(24))
        .await
        .expect("query failed");

    assert_eq!(summary.new_issues.current, 2);
    assert_eq!(summary.new_issues.previous, Some(1));
}

#[actix_web::test]
async fn summary_open_issues_ignores_the_window() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Summary Open").await;

    // Far older than the 24h window: a backlog count, not a windowed rate.
    seed_issue(&db.pool, project_id, 1, 500).await;
    seed_issue(&db.pool, project_id, 2, 500).await;

    let summary = StatsService::project_summary(&db.pool, project_id, Some(24))
        .await
        .expect("query failed");

    assert_eq!(summary.new_issues.current, 0);
    assert_eq!(summary.open_issues, 2);
}

#[actix_web::test]
async fn summary_all_time_has_no_previous_period() {
    // Reporting 0 for "previous" over all time would render as a bogus +100%.
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Summary All Time").await;

    seed_event(&db.pool, project_id, None, "error", "error", 1).await;
    seed_event(&db.pool, project_id, None, "error", "error", 5_000).await;
    seed_issue(&db.pool, project_id, 1, 5_000).await;

    let summary = StatsService::project_summary(&db.pool, project_id, None)
        .await
        .expect("query failed");

    assert_eq!(summary.period_hours, None);
    assert_eq!(summary.events.current, 2);
    assert_eq!(summary.events.previous, None);
    assert_eq!(summary.new_issues.current, 1);
    assert_eq!(summary.new_issues.previous, None);
}

#[actix_web::test]
async fn summary_is_scoped_to_one_project() {
    let db = TestDb::new().await;
    let mine = create_project(&db.pool, "Summary Mine").await;
    let theirs = create_project(&db.pool, "Summary Theirs").await;

    seed_event(&db.pool, mine, None, "error", "error", 1).await;
    seed_event(&db.pool, theirs, None, "error", "error", 1).await;
    seed_issue(&db.pool, mine, 1, 1).await;
    seed_issue(&db.pool, theirs, 1, 1).await;

    let summary = StatsService::project_summary(&db.pool, mine, Some(24))
        .await
        .expect("query failed");

    assert_eq!(summary.events.current, 1);
    assert_eq!(summary.new_issues.current, 1);
    assert_eq!(summary.open_issues, 1);
}

/// The window is clamped before it reaches the query, so an absurd `?period=`
/// cannot ask the database for an inverted or unbounded range.
#[actix_web::test]
async fn summary_accepts_the_maximum_clamped_window() {
    let db = TestDb::new().await;
    let project_id = create_project(&db.pool, "Summary Max Window").await;

    seed_event(&db.pool, project_id, None, "error", "error", 1).await;

    let summary = StatsService::project_summary(&db.pool, project_id, Some(90 * 24))
        .await
        .expect("query failed");

    assert_eq!(summary.events.current, 1);
}
