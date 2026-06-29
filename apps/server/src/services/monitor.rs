//! Monitor service: schedule math + read queries for Sentry Crons.

use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::check_in::{CheckInResponse, MonitorResponse};
use chrono::{DateTime, Duration, Months, Utc};
use chrono_tz::Tz;
use cron::Schedule;
use sqlx::Row;
use std::str::FromStr;
use uuid::Uuid;

/// Read + maintenance queries for monitors.
pub struct MonitorService;

impl MonitorService {
    /// Lists all monitors for a project, most-recently-active first.
    pub async fn list_monitors(pool: &DbPool, project_id: i32) -> AppResult<Vec<MonitorResponse>> {
        let rows = sqlx::query(
            r#"
            SELECT id, slug, status,
                   schedule_type, schedule_value, schedule_unit, timezone,
                   checkin_margin, max_runtime,
                   last_check_in_at, last_check_in_status, next_expected_at, created_at
            FROM monitors
            WHERE project_id = $1
            ORDER BY COALESCE(last_check_in_at, created_at) DESC, slug ASC
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        Ok(rows
            .iter()
            .map(|row| MonitorResponse {
                id: row.get("id"),
                slug: row.get("slug"),
                status: row.get("status"),
                schedule_type: row.get("schedule_type"),
                schedule_value: row.get("schedule_value"),
                schedule_unit: row.get("schedule_unit"),
                timezone: row.get("timezone"),
                checkin_margin: row.get("checkin_margin"),
                max_runtime: row.get("max_runtime"),
                last_check_in_at: row.get("last_check_in_at"),
                last_check_in_status: row.get("last_check_in_status"),
                next_expected_at: row.get("next_expected_at"),
                created_at: row.get("created_at"),
            })
            .collect())
    }

    /// Lists check-ins for one monitor (by slug) with offset pagination,
    /// newest first. Returns `(rows, total)`. An unknown slug yields an empty page.
    pub async fn list_check_ins(
        pool: &DbPool,
        project_id: i32,
        slug: &str,
        page: i64,
        per_page: i64,
    ) -> AppResult<(Vec<CheckInResponse>, i64)> {
        let page = page.max(1);
        let per_page = per_page.clamp(1, 100);
        let offset = (page - 1) * per_page;

        let total: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM check_ins ci
            JOIN monitors m ON m.id = ci.monitor_id
            WHERE ci.project_id = $1 AND m.slug = $2
            "#,
        )
        .bind(project_id)
        .bind(slug)
        .fetch_one(pool)
        .await?;

        let rows = sqlx::query(
            r#"
            SELECT ci.id, ci.status, ci.duration, ci.environment, ci.trace_id, ci.timestamp
            FROM check_ins ci
            JOIN monitors m ON m.id = ci.monitor_id
            WHERE ci.project_id = $1 AND m.slug = $2
            ORDER BY ci.timestamp DESC, ci.id DESC
            LIMIT $3 OFFSET $4
            "#,
        )
        .bind(project_id)
        .bind(slug)
        .bind(per_page)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let check_ins = rows
            .iter()
            .map(|row| CheckInResponse {
                id: row.get("id"),
                status: row.get("status"),
                duration: row.get("duration"),
                environment: row.get("environment"),
                trace_id: row.get("trace_id"),
                timestamp: row.get("timestamp"),
            })
            .collect();

        Ok((check_ins, total.0))
    }

    /// Marks monitors whose expected check-in is overdue (past
    /// `next_expected_at` + `checkin_margin`) as `missed`, records a missed
    /// check-in in history, and advances `next_expected_at` to the next
    /// occurrence so the same miss does not fire again. Returns the number of
    /// monitors transitioned. `now` is injected for testability.
    pub async fn process_overdue(pool: &DbPool, now: DateTime<Utc>) -> AppResult<usize> {
        Self::process_timeouts(pool, now).await?;

        let candidates = sqlx::query(
            r#"
            SELECT id, schedule_type, schedule_value, schedule_unit, timezone,
                   checkin_margin, next_expected_at
            FROM monitors
            WHERE next_expected_at IS NOT NULL
              AND status NOT IN ('missed', 'disabled')
            "#,
        )
        .fetch_all(pool)
        .await?;

        let mut transitioned = 0usize;
        for row in candidates {
            let next_expected: DateTime<Utc> = row.get("next_expected_at");
            let margin = row
                .get::<Option<i64>, _>("checkin_margin")
                .unwrap_or(0)
                .max(0);
            let deadline = next_expected + Duration::minutes(margin);
            if now <= deadline {
                continue;
            }

            let monitor_id: Uuid = row.get("id");

            // Advance the deadline past `now` from the schedule, so the next
            // tick has a fresh target instead of re-detecting this miss.
            let advanced = row
                .get::<Option<String>, _>("schedule_type")
                .and_then(|st| {
                    let sv: Option<String> = row.get("schedule_value");
                    let su: Option<String> = row.get("schedule_unit");
                    let tz: Option<String> = row.get("timezone");
                    next_expected_after(
                        &st,
                        sv.as_deref().unwrap_or_default(),
                        su.as_deref(),
                        tz.as_deref(),
                        now,
                    )
                });

            let mut tx = pool.begin().await?;

            sqlx::query(
                r#"
                UPDATE monitors SET
                    status = 'missed',
                    last_check_in_status = 'missed',
                    next_expected_at = COALESCE($1, next_expected_at),
                    updated_at = $2
                WHERE id = $3
                "#,
            )
            .bind(advanced)
            .bind(now)
            .bind(monitor_id)
            .execute(&mut *tx)
            .await?;

            sqlx::query(
                r#"
                INSERT INTO check_ins (id, monitor_id, project_id, status, timestamp, ingested_at)
                SELECT $1, id, project_id, 'missed', $2, $3 FROM monitors WHERE id = $4
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(now)
            .bind(now)
            .bind(monitor_id)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;
            transitioned += 1;
        }

        Ok(transitioned)
    }

    /// Times out in-progress check-ins whose run has exceeded the monitor's
    /// `max_runtime` (minutes): the check-in row becomes `timeout` and its
    /// monitor follows. Runs in Rust to keep the minute arithmetic dialect-safe.
    async fn process_timeouts(pool: &DbPool, now: DateTime<Utc>) -> AppResult<()> {
        let open = sqlx::query(
            r#"
            SELECT ci.id AS check_in_id, ci.timestamp AS started_at,
                   ci.monitor_id AS monitor_id, m.max_runtime AS max_runtime
            FROM check_ins ci
            JOIN monitors m ON m.id = ci.monitor_id
            WHERE ci.status = 'in_progress' AND m.max_runtime IS NOT NULL
            "#,
        )
        .fetch_all(pool)
        .await?;

        for row in open {
            let started_at: DateTime<Utc> = row.get("started_at");
            let max_runtime: i64 = row.get("max_runtime");
            if now <= started_at + Duration::minutes(max_runtime.max(0)) {
                continue;
            }

            let check_in_id: Uuid = row.get("check_in_id");
            let monitor_id: Uuid = row.get("monitor_id");

            let mut tx = pool.begin().await?;
            sqlx::query("UPDATE check_ins SET status = 'timeout', duration = $1 WHERE id = $2")
                .bind((now - started_at).num_seconds() as f64)
                .bind(check_in_id)
                .execute(&mut *tx)
                .await?;
            sqlx::query(
                "UPDATE monitors SET status = 'timeout', last_check_in_status = 'timeout', updated_at = $1 WHERE id = $2",
            )
            .bind(now)
            .bind(monitor_id)
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
        }

        Ok(())
    }
}

/// Computes the next expected check-in time strictly after `after`, from a
/// stored schedule. Returns `None` for an unparseable schedule.
///
/// - `interval`: `schedule_value` is the count, `schedule_unit` the unit
///   (minute/hour/day/week/month/year); the next time is `after + N*unit`.
/// - `crontab`: `schedule_value` is a 5-field UNIX cron expression, evaluated
///   in `timezone` (defaulting to UTC), then converted back to UTC.
pub fn next_expected_after(
    schedule_type: &str,
    schedule_value: &str,
    schedule_unit: Option<&str>,
    timezone: Option<&str>,
    after: DateTime<Utc>,
) -> Option<DateTime<Utc>> {
    match schedule_type {
        "interval" => next_interval(schedule_value, schedule_unit, after),
        "crontab" => next_crontab(schedule_value, timezone, after),
        _ => None,
    }
}

fn next_interval(value: &str, unit: Option<&str>, after: DateTime<Utc>) -> Option<DateTime<Utc>> {
    let n: i64 = value.parse().ok()?;
    if n <= 0 {
        return None;
    }
    match unit? {
        "minute" => Some(after + Duration::minutes(n)),
        "hour" => Some(after + Duration::hours(n)),
        "day" => Some(after + Duration::days(n)),
        "week" => Some(after + Duration::weeks(n)),
        "month" => after.checked_add_months(Months::new(n as u32)),
        "year" => after.checked_add_months(Months::new(n as u32 * 12)),
        _ => None,
    }
}

fn next_crontab(expr: &str, timezone: Option<&str>, after: DateTime<Utc>) -> Option<DateTime<Utc>> {
    // Sentry sends 5-field UNIX cron (min hour dom mon dow); the `cron` crate
    // wants a leading seconds field — prepend "0 " so it fires at second 0.
    if expr.split_whitespace().count() != 5 {
        return None;
    }
    let schedule = Schedule::from_str(&format!("0 {expr}")).ok()?;

    let tz: Tz = timezone
        .and_then(|t| t.parse().ok())
        .unwrap_or(chrono_tz::UTC);

    let after_tz = after.with_timezone(&tz);
    let next = schedule.after(&after_tz).next()?;
    Some(next.with_timezone(&Utc))
}
