//! Unit tests for the Sentry monitor check-in model (Crons).
//!
//! Ground truth: relay-monitors/src/lib.rs (`CheckIn`, `process_check_in`).
//! A check-in carries a monitor slug, a status, and optional schedule config
//! used to upsert the monitor.

use rustrak::digest::processors::{route, Route};
use rustrak::ingest::envelope::EnvelopeItemKind;
use rustrak::models::check_in::{CheckInPayload, CheckInStatus};

#[test]
fn test_check_in_item_routes_to_check_in_processor() {
    let kind = EnvelopeItemKind::CheckIn(b"{}".to_vec());
    assert_eq!(route(&kind), Route::CheckIn);
}

#[test]
fn test_check_in_does_not_require_event_id() {
    let kind = EnvelopeItemKind::CheckIn(b"{}".to_vec());
    assert!(!kind.requires_event());
}

#[test]
fn test_parse_check_in_payload() {
    let body = br#"{
        "check_in_id":"a460c25ff2554577b920fcfacae4e5eb",
        "monitor_slug":"my-monitor",
        "status":"in_progress",
        "environment":"production",
        "duration":21.0
    }"#;

    let c = CheckInPayload::parse(body).unwrap();

    assert_eq!(c.monitor_slug, "my-monitor");
    assert_eq!(c.status, CheckInStatus::InProgress);
    assert_eq!(c.environment.as_deref(), Some("production"));
    assert_eq!(c.duration, Some(21.0));
}

#[test]
fn test_normalize_rejects_empty_slug() {
    let mut c = CheckInPayload::parse(br#"{"monitor_slug":"","status":"ok"}"#).unwrap();
    assert!(c.normalize().is_err(), "empty slug must be rejected");
}

#[test]
fn test_normalize_truncates_slug_to_50_chars() {
    let long = "a".repeat(100);
    let json = format!(r#"{{"monitor_slug":"{long}","status":"ok"}}"#);
    let mut c = CheckInPayload::parse(json.as_bytes()).unwrap();
    c.normalize().unwrap();
    assert_eq!(c.monitor_slug.chars().count(), 50);
}

#[test]
fn test_normalize_rejects_overlong_environment() {
    let env = "e".repeat(65);
    let json = format!(r#"{{"monitor_slug":"m","status":"ok","environment":"{env}"}}"#);
    let mut c = CheckInPayload::parse(json.as_bytes()).unwrap();
    assert!(
        c.normalize().is_err(),
        "environment >64 chars must be rejected"
    );
}

#[test]
fn test_normalize_coerces_missed_to_unknown() {
    // `missed` is computed server-side; an SDK cannot ingest it directly.
    let mut c = CheckInPayload::parse(br#"{"monitor_slug":"m","status":"missed"}"#).unwrap();
    c.normalize().unwrap();
    assert_eq!(c.status, CheckInStatus::Unknown);
}

// =============================================================================
// Level 2 — CheckInProcessor DB behavior (#[tokio::test] + TestDb)
// =============================================================================

#[cfg(test)]
mod level2 {
    use crate::common::TestDb;
    use chrono::Utc;
    use rustrak::digest::processors::{CheckInProcessor, Processor, ProcessorCtx};
    use rustrak::models::CreateProject;
    use rustrak::services::ProjectService;
    use sqlx::Row;
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
    async fn test_check_in_creates_monitor_and_row() {
        // A check-in for an unseen slug upserts a monitor row and records the
        // check-in. This is the auto-create behavior (no pre-provisioning).
        let db = TestDb::new().await;
        let project_id = new_project(&db.pool, "crons-create").await;

        let body = br#"{"check_in_id":"a460c25ff2554577b920fcfacae4e5eb","monitor_slug":"nightly","status":"ok"}"#.to_vec();
        CheckInProcessor
            .process(body, &ctx(&db.pool, project_id))
            .await
            .unwrap();

        let slug: String = sqlx::query_scalar("SELECT slug FROM monitors WHERE project_id = ?")
            .bind(project_id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(slug, "nightly");

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM check_ins WHERE project_id = ?")
            .bind(project_id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(count, 1, "one check-in row recorded");

        let status: String = sqlx::query("SELECT status FROM check_ins WHERE project_id = ?")
            .bind(project_id)
            .fetch_one(&db.pool)
            .await
            .unwrap()
            .get("status");
        assert_eq!(status, "ok");
    }

    #[tokio::test]
    async fn test_monitor_config_upserts_crontab_schedule() {
        // A check-in carrying monitor_config provisions the monitor's schedule.
        let db = TestDb::new().await;
        let project_id = new_project(&db.pool, "crons-cfg").await;

        let body = br#"{
            "monitor_slug":"cfg",
            "status":"ok",
            "monitor_config":{
                "schedule":{"type":"crontab","value":"0 * * * *"},
                "checkin_margin":5,
                "max_runtime":30,
                "timezone":"America/New_York",
                "owner":"user:1"
            }
        }"#
        .to_vec();
        CheckInProcessor
            .process(body, &ctx(&db.pool, project_id))
            .await
            .unwrap();

        let row = sqlx::query(
            "SELECT schedule_type, schedule_value, checkin_margin, max_runtime, timezone, owner FROM monitors WHERE project_id = ?",
        )
        .bind(project_id)
        .fetch_one(&db.pool)
        .await
        .unwrap();

        let st: String = row.get("schedule_type");
        let sv: String = row.get("schedule_value");
        let margin: i64 = row.get("checkin_margin");
        let max_rt: i64 = row.get("max_runtime");
        let tz: String = row.get("timezone");
        let owner: String = row.get("owner");
        assert_eq!(st, "crontab");
        assert_eq!(sv, "0 * * * *");
        assert_eq!(margin, 5);
        assert_eq!(max_rt, 30);
        assert_eq!(tz, "America/New_York");
        assert_eq!(owner, "user:1");
    }

    #[tokio::test]
    async fn test_monitor_config_upserts_interval_schedule() {
        let db = TestDb::new().await;
        let project_id = new_project(&db.pool, "crons-interval").await;

        let body = br#"{
            "monitor_slug":"iv",
            "status":"ok",
            "monitor_config":{"schedule":{"type":"interval","value":5,"unit":"day"}}
        }"#
        .to_vec();
        CheckInProcessor
            .process(body, &ctx(&db.pool, project_id))
            .await
            .unwrap();

        let row = sqlx::query(
            "SELECT schedule_type, schedule_value, schedule_unit FROM monitors WHERE project_id = ?",
        )
        .bind(project_id)
        .fetch_one(&db.pool)
        .await
        .unwrap();
        let st: String = row.get("schedule_type");
        let sv: String = row.get("schedule_value");
        let unit: String = row.get("schedule_unit");
        assert_eq!(st, "interval");
        assert_eq!(sv, "5");
        assert_eq!(unit, "day");
    }

    #[tokio::test]
    async fn test_check_in_lifecycle_updates_open_row() {
        // in_progress then ok sharing a check_in_id must update the open row
        // (one row, closed as ok with its duration), not insert a second one.
        let db = TestDb::new().await;
        let project_id = new_project(&db.pool, "crons-lifecycle").await;
        let id = "a460c25ff2554577b920fcfacae4e5eb";

        let open =
            format!(r#"{{"check_in_id":"{id}","monitor_slug":"job","status":"in_progress"}}"#);
        CheckInProcessor
            .process(open.into_bytes(), &ctx(&db.pool, project_id))
            .await
            .unwrap();

        let close = format!(
            r#"{{"check_in_id":"{id}","monitor_slug":"job","status":"ok","duration":12.5}}"#
        );
        CheckInProcessor
            .process(close.into_bytes(), &ctx(&db.pool, project_id))
            .await
            .unwrap();

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM check_ins WHERE project_id = ?")
            .bind(project_id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(count, 1, "lifecycle updates the open row, not a new one");

        let row = sqlx::query("SELECT status, duration FROM check_ins WHERE project_id = ?")
            .bind(project_id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
        let status: String = row.get("status");
        let duration: f64 = row.get("duration");
        assert_eq!(status, "ok");
        assert_eq!(duration, 12.5);
    }

    #[tokio::test]
    async fn test_check_ins_without_id_are_not_deduplicated() {
        // Two check-ins with no SDK id are distinct executions → two rows.
        let db = TestDb::new().await;
        let project_id = new_project(&db.pool, "crons-noid").await;

        for _ in 0..2 {
            let body = br#"{"monitor_slug":"job","status":"ok"}"#.to_vec();
            CheckInProcessor
                .process(body, &ctx(&db.pool, project_id))
                .await
                .unwrap();
        }

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM check_ins WHERE project_id = ?")
            .bind(project_id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(count, 2, "idless check-ins must not collapse together");
    }

    #[tokio::test]
    async fn test_monitor_status_reflects_latest_terminal_check_in() {
        // A terminal check-in (ok/error) drives the monitor's derived status and
        // its last_check_in fields; a later error flips it.
        let db = TestDb::new().await;
        let project_id = new_project(&db.pool, "crons-status").await;

        CheckInProcessor
            .process(
                br#"{"monitor_slug":"j","status":"ok"}"#.to_vec(),
                &ctx(&db.pool, project_id),
            )
            .await
            .unwrap();

        let row = sqlx::query(
            "SELECT status, last_check_in_status, last_check_in_at FROM monitors WHERE project_id = ?",
        )
        .bind(project_id)
        .fetch_one(&db.pool)
        .await
        .unwrap();
        let status: String = row.get("status");
        let last_status: String = row.get("last_check_in_status");
        let last_at: Option<chrono::DateTime<chrono::Utc>> = row.get("last_check_in_at");
        assert_eq!(status, "ok");
        assert_eq!(last_status, "ok");
        assert!(last_at.is_some(), "last_check_in_at must be set");

        CheckInProcessor
            .process(
                br#"{"monitor_slug":"j","status":"error"}"#.to_vec(),
                &ctx(&db.pool, project_id),
            )
            .await
            .unwrap();
        let status: String = sqlx::query_scalar("SELECT status FROM monitors WHERE project_id = ?")
            .bind(project_id)
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(
            status, "error",
            "a failing check-in flips the monitor to error"
        );
    }

    #[tokio::test]
    async fn test_next_expected_at_computed_from_schedule() {
        // With a known schedule, each check-in advances next_expected_at so the
        // missed worker has a fresh deadline.
        let db = TestDb::new().await;
        let project_id = new_project(&db.pool, "crons-next").await;

        let t0 = Utc::now();
        let body = br#"{"monitor_slug":"sch","status":"ok","monitor_config":{"schedule":{"type":"interval","value":1,"unit":"hour"}}}"#.to_vec();
        CheckInProcessor
            .process(body, &ctx(&db.pool, project_id))
            .await
            .unwrap();

        let next: Option<chrono::DateTime<chrono::Utc>> =
            sqlx::query_scalar("SELECT next_expected_at FROM monitors WHERE project_id = ?")
                .bind(project_id)
                .fetch_one(&db.pool)
                .await
                .unwrap();
        let next = next.expect("next_expected_at must be set when schedule is known");
        // ~1 hour ahead of the check-in time.
        assert!(next > t0 + chrono::Duration::minutes(55));
        assert!(next < t0 + chrono::Duration::minutes(65));
    }

    #[tokio::test]
    async fn test_list_monitors_returns_created_monitor() {
        use rustrak::services::monitor::MonitorService;
        let db = TestDb::new().await;
        let project_id = new_project(&db.pool, "crons-list").await;

        CheckInProcessor
            .process(
                br#"{"monitor_slug":"daily","status":"ok","monitor_config":{"schedule":{"type":"crontab","value":"0 0 * * *"}}}"#.to_vec(),
                &ctx(&db.pool, project_id),
            )
            .await
            .unwrap();

        let monitors = MonitorService::list_monitors(&db.pool, project_id)
            .await
            .unwrap();
        assert_eq!(monitors.len(), 1);
        assert_eq!(monitors[0].slug, "daily");
        assert_eq!(monitors[0].status, "ok");
        assert_eq!(monitors[0].schedule_type.as_deref(), Some("crontab"));
    }

    #[tokio::test]
    async fn test_list_check_ins_for_monitor_newest_first() {
        use rustrak::services::monitor::MonitorService;
        let db = TestDb::new().await;
        let project_id = new_project(&db.pool, "crons-ci-list").await;

        // Two distinct (id-less) check-ins on the same monitor.
        CheckInProcessor
            .process(
                br#"{"monitor_slug":"job","status":"ok"}"#.to_vec(),
                &ctx(&db.pool, project_id),
            )
            .await
            .unwrap();
        CheckInProcessor
            .process(
                br#"{"monitor_slug":"job","status":"error"}"#.to_vec(),
                &ctx(&db.pool, project_id),
            )
            .await
            .unwrap();

        let (check_ins, total) = MonitorService::list_check_ins(&db.pool, project_id, "job", 1, 50)
            .await
            .unwrap();
        assert_eq!(total, 2);
        assert_eq!(check_ins.len(), 2);
        // Both statuses are present; ordering is by timestamp desc.
        let statuses: Vec<&str> = check_ins.iter().map(|c| c.status.as_str()).collect();
        assert!(statuses.contains(&"ok") && statuses.contains(&"error"));
    }
}
