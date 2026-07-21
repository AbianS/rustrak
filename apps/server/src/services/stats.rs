//! Project-wide aggregate stats for the overview dashboard.
//!
//! Distinct from `SessionService` (which aggregates the pre-rolled
//! `session_counts`/`session_users` tables) and from `IssueService::stats`
//! (which is scoped to one issue): everything here spans a whole project's
//! `events` and `issues`.

use std::collections::HashMap;

use chrono::{DateTime, Duration, Utc};

use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::stats::{EventTimeseriesPoint, MetricDelta, ProjectStatsSummary};

/// Levels the timeseries breaks out by name. Anything else (`debug`, or a
/// level an SDK invented) folds into the `info` bucket so the four series
/// always sum to `total`.
const NAMED_LEVELS: [&str; 3] = ["fatal", "error", "warning"];

pub struct StatsService;

impl StatsService {
    /// Time-bucketed error-event volume for a project, split by severity.
    ///
    /// Buckets are zero-filled across the whole window, so a quiet hour renders
    /// as a bar of height zero rather than a gap the chart would interpolate
    /// across. All-time requests (`period_hours` is `None`) are returned sparse:
    /// there is no lower bound to fill from.
    pub async fn event_timeseries(
        pool: &DbPool,
        project_id: i32,
        period_hours: Option<i64>,
        interval_hours: i64,
    ) -> AppResult<Vec<EventTimeseriesPoint>> {
        let interval_secs = interval_hours.max(1) * 3600;
        let points = query_event_timeseries(pool, project_id, period_hours, interval_secs).await?;

        let Some(hours) = period_hours else {
            return Ok(points);
        };

        Ok(zero_fill(points, hours, interval_secs, Utc::now()))
    }

    /// Project-wide counters for the window, each paired with the same counter
    /// over the window immediately before it.
    pub async fn project_summary(
        pool: &DbPool,
        project_id: i32,
        period_hours: Option<i64>,
    ) -> AppResult<ProjectStatsSummary> {
        // The comparison window is the same length, immediately before the
        // current one, so every query below scans `[previous_start, now]` once
        // and splits the two halves with a CASE rather than running twice.
        let bounds = period_hours.map(|hours| {
            let now = Utc::now();
            (
                now - Duration::hours(hours * 2),
                now - Duration::hours(hours),
            )
        });

        let events = count_events(pool, project_id, bounds).await?;
        let new_issues = count_new_issues(pool, project_id, bounds).await?;
        let open_issues = count_open_issues(pool, project_id).await?;

        Ok(ProjectStatsSummary {
            period_hours,
            events,
            new_issues,
            open_issues,
        })
    }
}

/// Expand sparse buckets to every bucket in `[now - hours, now]`.
fn zero_fill(
    points: Vec<EventTimeseriesPoint>,
    hours: i64,
    interval_secs: i64,
    now: DateTime<Utc>,
) -> Vec<EventTimeseriesPoint> {
    let align = |ts: i64| ts.div_euclid(interval_secs) * interval_secs;
    let last = align(now.timestamp());
    let first = align(now.timestamp() - hours * 3600);

    let mut by_bucket: HashMap<i64, EventTimeseriesPoint> = points
        .into_iter()
        .map(|p| (p.bucket.timestamp(), p))
        .collect();

    let mut filled = Vec::new();
    let mut ts = first;
    while ts <= last {
        filled.push(
            by_bucket
                .remove(&ts)
                .unwrap_or_else(|| EventTimeseriesPoint {
                    bucket: DateTime::from_timestamp(ts, 0).unwrap_or(now),
                    total: 0,
                    fatal: 0,
                    error: 0,
                    warning: 0,
                    info: 0,
                }),
        );
        ts += interval_secs;
    }

    // A row outside the generated range (clock skew, an event ingested with a
    // future timestamp) would otherwise be dropped silently.
    let mut leftovers: Vec<_> = by_bucket.into_values().collect();
    if !leftovers.is_empty() {
        filled.append(&mut leftovers);
        filled.sort_by_key(|p| p.bucket);
    }

    filled
}

async fn query_event_timeseries(
    pool: &DbPool,
    project_id: i32,
    period_hours: Option<i64>,
    interval_secs: i64,
) -> AppResult<Vec<EventTimeseriesPoint>> {
    let [fatal, error, warning] = NAMED_LEVELS;

    #[cfg(feature = "postgres")]
    {
        let time_filter = match period_hours {
            Some(hours) => format!("AND ingested_at >= NOW() - '{hours} hours'::interval"),
            None => String::new(),
        };

        // COALESCE(level, '') keeps the four severity buckets exhaustive: on a
        // NULL level `level NOT IN (...)` is NULL, not true, so the row would
        // count toward `total` but toward none of the segments.
        let sql = format!(
            r#"
            SELECT
                to_timestamp(
                    floor(extract(epoch FROM ingested_at) / {interval_secs}) * {interval_secs}
                ) AS bucket,
                COUNT(*)::bigint AS total,
                SUM(CASE WHEN COALESCE(level, '') = '{fatal}'   THEN 1 ELSE 0 END)::bigint AS fatal,
                SUM(CASE WHEN COALESCE(level, '') = '{error}'   THEN 1 ELSE 0 END)::bigint AS error,
                SUM(CASE WHEN COALESCE(level, '') = '{warning}' THEN 1 ELSE 0 END)::bigint AS warning,
                SUM(CASE WHEN COALESCE(level, '') NOT IN ('{fatal}', '{error}', '{warning}')
                         THEN 1 ELSE 0 END)::bigint AS info
            FROM events
            WHERE project_id = $1
              AND event_type = 'error'
              {time_filter}
            GROUP BY 1
            ORDER BY 1 ASC
            "#,
        );

        let rows: Vec<(DateTime<Utc>, i64, i64, i64, i64, i64)> =
            sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
                .bind(project_id)
                .fetch_all(pool)
                .await?;

        Ok(rows
            .into_iter()
            .map(
                |(bucket, total, fatal, error, warning, info)| EventTimeseriesPoint {
                    bucket,
                    total,
                    fatal,
                    error,
                    warning,
                    info,
                },
            )
            .collect())
    }

    #[cfg(not(feature = "postgres"))]
    {
        let time_filter = match period_hours {
            Some(hours) => format!(
                "AND datetime(ingested_at) >= datetime('now', '-' || '{hours}' || ' hours')"
            ),
            None => String::new(),
        };

        let sql = format!(
            r#"
            SELECT
                strftime(
                    '%Y-%m-%dT%H:%M:%SZ',
                    (CAST(strftime('%s', ingested_at) AS INTEGER) / {interval_secs}) * {interval_secs},
                    'unixepoch'
                ) AS bucket,
                COUNT(*) AS total,
                SUM(CASE WHEN COALESCE(level, '') = '{fatal}'   THEN 1 ELSE 0 END) AS fatal,
                SUM(CASE WHEN COALESCE(level, '') = '{error}'   THEN 1 ELSE 0 END) AS error,
                SUM(CASE WHEN COALESCE(level, '') = '{warning}' THEN 1 ELSE 0 END) AS warning,
                SUM(CASE WHEN COALESCE(level, '') NOT IN ('{fatal}', '{error}', '{warning}')
                         THEN 1 ELSE 0 END) AS info
            FROM events
            WHERE project_id = ?1
              AND event_type = 'error'
              {time_filter}
            GROUP BY 1
            ORDER BY 1 ASC
            "#,
        );

        let rows: Vec<(String, i64, i64, i64, i64, i64)> =
            sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
                .bind(project_id)
                .fetch_all(pool)
                .await?;

        Ok(rows
            .into_iter()
            .map(
                |(bucket, total, fatal, error, warning, info)| EventTimeseriesPoint {
                    bucket: crate::models::session::parse_ts(&bucket).unwrap_or_else(Utc::now),
                    total,
                    fatal,
                    error,
                    warning,
                    info,
                },
            )
            .collect())
    }
}

/// Window bounds as `(previous_start, current_start)`, or `None` for all time.
type Bounds = Option<(DateTime<Utc>, DateTime<Utc>)>;

async fn count_events(pool: &DbPool, project_id: i32, bounds: Bounds) -> AppResult<MetricDelta> {
    let Some((previous_start, current_start)) = bounds else {
        #[cfg(feature = "postgres")]
        let (total,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*)::bigint FROM events WHERE project_id = $1 AND event_type = 'error'",
        )
        .bind(project_id)
        .fetch_one(pool)
        .await?;

        #[cfg(not(feature = "postgres"))]
        let (total,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM events WHERE project_id = ?1 AND event_type = 'error'",
        )
        .bind(project_id)
        .fetch_one(pool)
        .await?;

        return Ok(MetricDelta::new(total, None));
    };

    #[cfg(feature = "postgres")]
    let (current, previous): (i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COALESCE(SUM(CASE WHEN ingested_at >= $2 THEN 1 ELSE 0 END), 0)::bigint,
            COALESCE(SUM(CASE WHEN ingested_at <  $2 THEN 1 ELSE 0 END), 0)::bigint
        FROM events
        WHERE project_id = $1
          AND event_type = 'error'
          AND ingested_at >= $3
        "#,
    )
    .bind(project_id)
    .bind(current_start)
    .bind(previous_start)
    .fetch_one(pool)
    .await?;

    #[cfg(not(feature = "postgres"))]
    let (current, previous): (i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COALESCE(SUM(CASE WHEN datetime(ingested_at) >= datetime(?2) THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN datetime(ingested_at) <  datetime(?2) THEN 1 ELSE 0 END), 0)
        FROM events
        WHERE project_id = ?1
          AND event_type = 'error'
          AND datetime(ingested_at) >= datetime(?3)
        "#,
    )
    .bind(project_id)
    .bind(current_start.naive_utc())
    .bind(previous_start.naive_utc())
    .fetch_one(pool)
    .await?;

    Ok(MetricDelta::new(current, Some(previous)))
}

async fn count_new_issues(
    pool: &DbPool,
    project_id: i32,
    bounds: Bounds,
) -> AppResult<MetricDelta> {
    let Some((previous_start, current_start)) = bounds else {
        #[cfg(feature = "postgres")]
        let (total,): (i64,) =
            sqlx::query_as("SELECT COUNT(*)::bigint FROM issues WHERE project_id = $1")
                .bind(project_id)
                .fetch_one(pool)
                .await?;

        #[cfg(not(feature = "postgres"))]
        let (total,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM issues WHERE project_id = ?1")
            .bind(project_id)
            .fetch_one(pool)
            .await?;

        return Ok(MetricDelta::new(total, None));
    };

    #[cfg(feature = "postgres")]
    let (current, previous): (i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COALESCE(SUM(CASE WHEN first_seen >= $2 THEN 1 ELSE 0 END), 0)::bigint,
            COALESCE(SUM(CASE WHEN first_seen <  $2 THEN 1 ELSE 0 END), 0)::bigint
        FROM issues
        WHERE project_id = $1
          AND first_seen >= $3
        "#,
    )
    .bind(project_id)
    .bind(current_start)
    .bind(previous_start)
    .fetch_one(pool)
    .await?;

    #[cfg(not(feature = "postgres"))]
    let (current, previous): (i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COALESCE(SUM(CASE WHEN datetime(first_seen) >= datetime(?2) THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN datetime(first_seen) <  datetime(?2) THEN 1 ELSE 0 END), 0)
        FROM issues
        WHERE project_id = ?1
          AND datetime(first_seen) >= datetime(?3)
        "#,
    )
    .bind(project_id)
    .bind(current_start.naive_utc())
    .bind(previous_start.naive_utc())
    .fetch_one(pool)
    .await?;

    Ok(MetricDelta::new(current, Some(previous)))
}

/// Issues currently unresolved. A backlog size, not a windowed rate, so it has
/// no previous-period counterpart.
async fn count_open_issues(pool: &DbPool, project_id: i32) -> AppResult<i64> {
    #[cfg(feature = "postgres")]
    let (total,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM issues WHERE project_id = $1 AND status = 'unresolved'",
    )
    .bind(project_id)
    .fetch_one(pool)
    .await?;

    #[cfg(not(feature = "postgres"))]
    let (total,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM issues WHERE project_id = ?1 AND status = 'unresolved'",
    )
    .bind(project_id)
    .fetch_one(pool)
    .await?;

    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn point(ts: i64, total: i64) -> EventTimeseriesPoint {
        EventTimeseriesPoint {
            bucket: DateTime::from_timestamp(ts, 0).unwrap(),
            total,
            fatal: 0,
            error: total,
            warning: 0,
            info: 0,
        }
    }

    /// A fixed `now` on an exact hour boundary keeps the expected bucket
    /// timestamps readable.
    fn now() -> DateTime<Utc> {
        DateTime::from_timestamp(1_800_000_000, 0).unwrap()
    }

    #[test]
    fn zero_fill_covers_every_bucket_in_the_window() {
        let hour = 3600;
        let filled = zero_fill(vec![], 6, hour, now());
        // Six hours back through the current bucket, inclusive at both ends.
        assert_eq!(filled.len(), 7);
        assert!(filled.iter().all(|p| p.total == 0));
    }

    #[test]
    fn zero_fill_keeps_existing_buckets_in_place() {
        let hour = 3600;
        let base = now().timestamp().div_euclid(hour) * hour;
        let filled = zero_fill(vec![point(base - 2 * hour, 5)], 6, hour, now());

        let hit: Vec<_> = filled.iter().filter(|p| p.total > 0).collect();
        assert_eq!(hit.len(), 1);
        assert_eq!(hit[0].total, 5);
        assert_eq!(hit[0].bucket.timestamp(), base - 2 * hour);
    }

    #[test]
    fn zero_fill_emits_buckets_in_ascending_order() {
        let hour = 3600;
        let filled = zero_fill(vec![], 12, hour, now());
        let mut sorted = filled.iter().map(|p| p.bucket).collect::<Vec<_>>();
        sorted.sort();
        assert_eq!(sorted, filled.iter().map(|p| p.bucket).collect::<Vec<_>>());
    }

    #[test]
    fn zero_fill_keeps_rows_outside_the_generated_range() {
        // An event ingested with a future timestamp still has to appear.
        let hour = 3600;
        let base = now().timestamp().div_euclid(hour) * hour;
        let filled = zero_fill(vec![point(base + 5 * hour, 3)], 6, hour, now());

        assert!(filled.iter().any(|p| p.total == 3));
        let mut sorted = filled.iter().map(|p| p.bucket).collect::<Vec<_>>();
        sorted.sort();
        assert_eq!(sorted, filled.iter().map(|p| p.bucket).collect::<Vec<_>>());
    }

    #[test]
    fn zero_fill_respects_a_multi_hour_interval() {
        let six_hours = 6 * 3600;
        let filled = zero_fill(vec![], 24, six_hours, now());
        assert_eq!(filled.len(), 5);
        for pair in filled.windows(2) {
            assert_eq!(
                pair[1].bucket.timestamp() - pair[0].bucket.timestamp(),
                six_hours
            );
        }
    }
}
