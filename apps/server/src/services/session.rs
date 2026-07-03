#[cfg(feature = "postgres")]
use chrono::DateTime;
use chrono::Utc;

use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::session::{ReleaseHealthRow, SessionSummary, SessionTimeseriesPoint};

#[cfg(feature = "postgres")]
type PgHealthRow = (String, String, i64, i64, i64, i64, Option<f64>, Option<f64>);

pub struct SessionService;

impl SessionService {
    /// Query per-release health stats for a project.
    /// If `period_hours` is `None`, all data is returned (no time filter).
    pub async fn release_health(
        pool: &DbPool,
        project_id: i32,
        period_hours: Option<i64>,
    ) -> AppResult<Vec<ReleaseHealthRow>> {
        let rows = query_release_health(pool, project_id, period_hours, None).await?;
        Ok(rows)
    }

    /// Same as [`Self::release_health`], scoped server-side to a single release
    /// (all environments) instead of returning every release in the project.
    /// Powers the release detail page, which only needs one release's rows.
    pub async fn release_health_for_release(
        pool: &DbPool,
        project_id: i32,
        release: &str,
        period_hours: Option<i64>,
    ) -> AppResult<Vec<ReleaseHealthRow>> {
        let rows = query_release_health(pool, project_id, period_hours, Some(release)).await?;
        Ok(rows)
    }

    /// Query project-wide session health, aggregated across all releases and environments.
    /// If `period_hours` is `None`, all data is returned (no time filter).
    pub async fn project_summary(
        pool: &DbPool,
        project_id: i32,
        period_hours: Option<i64>,
    ) -> AppResult<SessionSummary> {
        let summary = query_project_summary(pool, project_id, period_hours).await?;
        Ok(summary)
    }

    /// Query a time-bucketed session trend for a project, aggregated across all
    /// releases and environments. `interval_hours` controls bucket width (e.g. 1
    /// for hourly points, 24 for daily). If `period_hours` is `None`, all data
    /// is returned (no time filter). Ordered chronologically (oldest first).
    pub async fn session_timeseries(
        pool: &DbPool,
        project_id: i32,
        period_hours: Option<i64>,
        interval_hours: i64,
    ) -> AppResult<Vec<SessionTimeseriesPoint>> {
        let points =
            query_session_timeseries(pool, project_id, period_hours, interval_hours).await?;
        Ok(points)
    }
}

async fn query_release_health(
    pool: &DbPool,
    project_id: i32,
    period_hours: Option<i64>,
    release: Option<&str>,
) -> Result<Vec<ReleaseHealthRow>, sqlx::Error> {
    #[cfg(feature = "postgres")]
    {
        let (time_filter_sc, time_filter_su) = if let Some(hours) = period_hours {
            (
                format!("AND bucket >= NOW() - '{} hours'::interval", hours),
                format!("AND day >= (NOW() - '{} hours'::interval)::date", hours),
            )
        } else {
            (String::new(), String::new())
        };
        let release_filter = if release.is_some() {
            "AND release = $2"
        } else {
            ""
        };

        // session_counts and session_users are aggregated in separate subqueries
        // (each producing at most one row per release+environment) and then
        // joined 1:1. A direct LEFT JOIN on (project_id, release, environment)
        // alone is a many-to-many join — session_counts has one row per bucket
        // and session_users one row per (day, did), so every counts row would
        // be duplicated once per matching users row, inflating SUM(total) etc.
        // by the distinct-user count.
        let sql = format!(
            r#"
                SELECT
                    counts.release,
                    counts.environment,
                    counts.total,
                    counts.errored,
                    counts.crashed,
                    counts.abnormal,
                    counts.crash_free_sessions_rate,
                    users.crash_free_users_rate
                FROM (
                    SELECT
                        release,
                        environment,
                        SUM(total)::bigint    AS total,
                        SUM(errored)::bigint  AS errored,
                        SUM(crashed)::bigint  AS crashed,
                        SUM(abnormal)::bigint AS abnormal,
                        CASE WHEN SUM(total) > 0
                             THEN 1.0 - SUM(crashed)::float8 / NULLIF(SUM(total), 0)
                             ELSE NULL END AS crash_free_sessions_rate
                    FROM session_counts
                    WHERE project_id = $1
                      {time_filter_sc}
                      {release_filter}
                    GROUP BY release, environment
                ) counts
                LEFT JOIN (
                    SELECT
                        release,
                        environment,
                        CASE WHEN COUNT(DISTINCT did) > 0
                             THEN 1.0 - COUNT(DISTINCT CASE WHEN crashed THEN did END)::float8
                                  / NULLIF(COUNT(DISTINCT did), 0)
                             ELSE NULL END AS crash_free_users_rate
                    FROM session_users
                    WHERE project_id = $1
                      {time_filter_su}
                      {release_filter}
                    GROUP BY release, environment
                ) users
                ON users.release = counts.release AND users.environment = counts.environment
                ORDER BY counts.total DESC
                "#,
        );

        let mut query = sqlx::query_as(sqlx::AssertSqlSafe(&*sql)).bind(project_id);
        if let Some(r) = release {
            query = query.bind(r);
        }
        let rows: Vec<PgHealthRow> = query.fetch_all(pool).await?;

        Ok(rows
            .into_iter()
            .map(
                |(release, environment, total, errored, crashed, abnormal, cfsr, cfur)| {
                    let healthy = total - errored - crashed - abnormal;
                    ReleaseHealthRow {
                        release,
                        environment,
                        total,
                        errored,
                        crashed,
                        abnormal,
                        healthy,
                        crash_free_sessions_rate: cfsr,
                        crash_free_users_rate: cfur,
                    }
                },
            )
            .collect())
    }

    #[cfg(not(feature = "postgres"))]
    {
        let time_filter_sc = if let Some(hours) = period_hours {
            format!(
                "AND bucket >= datetime('now', '-' || '{}' || ' hours')",
                hours
            )
        } else {
            String::new()
        };

        let time_filter_su = if let Some(hours) = period_hours {
            format!("AND day >= date('now', '-' || '{}' || ' hours')", hours)
        } else {
            String::new()
        };
        let release_filter = if release.is_some() {
            "AND release = ?2"
        } else {
            ""
        };

        let sql = format!(
            r#"
            SELECT
                release,
                environment,
                SUM(total)    AS total,
                SUM(errored)  AS errored,
                SUM(crashed)  AS crashed,
                SUM(abnormal) AS abnormal
            FROM session_counts
            WHERE project_id = ?1
              {time_filter_sc}
              {release_filter}
            GROUP BY release, environment
            ORDER BY SUM(total) DESC
            "#,
        );

        let mut count_query = sqlx::query_as(sqlx::AssertSqlSafe(&*sql)).bind(project_id);
        if let Some(r) = release {
            count_query = count_query.bind(r);
        }
        let rows: Vec<(String, String, i64, i64, i64, i64)> = count_query.fetch_all(pool).await?;

        let mut result = Vec::with_capacity(rows.len());
        for (release, environment, total, errored, crashed, abnormal) in rows {
            let user_sql = format!(
                r#"
                SELECT
                    COUNT(DISTINCT did),
                    COUNT(DISTINCT CASE WHEN crashed = 1 THEN did END)
                FROM session_users
                WHERE project_id = ?1
                  AND release = ?2
                  AND environment = ?3
                  {}
                "#,
                time_filter_su
            );

            let (total_users, crashed_users): (i64, i64) =
                sqlx::query_as(sqlx::AssertSqlSafe(&*user_sql))
                    .bind(project_id)
                    .bind(&release)
                    .bind(&environment)
                    .fetch_one(pool)
                    .await?;

            let crash_free_sessions_rate = if total > 0 {
                Some(1.0 - crashed as f64 / total as f64)
            } else {
                None
            };
            let crash_free_users_rate = if total_users > 0 {
                Some(1.0 - crashed_users as f64 / total_users as f64)
            } else {
                None
            };

            let healthy = total - errored - crashed - abnormal;
            result.push(ReleaseHealthRow {
                release,
                environment,
                total,
                errored,
                crashed,
                abnormal,
                healthy,
                crash_free_sessions_rate,
                crash_free_users_rate,
            });
        }
        Ok(result)
    }
}

async fn query_project_summary(
    pool: &DbPool,
    project_id: i32,
    period_hours: Option<i64>,
) -> Result<SessionSummary, sqlx::Error> {
    #[cfg(feature = "postgres")]
    {
        let (time_filter_sc, time_filter_su) = if let Some(hours) = period_hours {
            (
                format!("AND bucket >= NOW() - '{} hours'::interval", hours),
                format!("AND day >= (NOW() - '{} hours'::interval)::date", hours),
            )
        } else {
            (String::new(), String::new())
        };

        // Two independent scalar subqueries (each always returns exactly one
        // row) combined with CROSS JOIN, instead of a single LEFT JOIN between
        // session_counts and session_users on (project_id, release,
        // environment) alone — that join has no day/did constraint, so it's
        // many-to-many and inflates SUM(total) etc. by the distinct-user count.
        let sql = format!(
            r#"
                SELECT
                    counts.total,
                    counts.errored,
                    counts.crashed,
                    counts.abnormal,
                    counts.crash_free_sessions_rate,
                    users.crash_free_users_rate,
                    counts.active_releases
                FROM (
                    SELECT
                        COALESCE(SUM(total), 0)::bigint    AS total,
                        COALESCE(SUM(errored), 0)::bigint  AS errored,
                        COALESCE(SUM(crashed), 0)::bigint  AS crashed,
                        COALESCE(SUM(abnormal), 0)::bigint AS abnormal,
                        CASE WHEN SUM(total) > 0
                             THEN 1.0 - SUM(crashed)::float8 / NULLIF(SUM(total), 0)
                             ELSE NULL END AS crash_free_sessions_rate,
                        COUNT(DISTINCT CASE WHEN total > 0 THEN release END)::bigint AS active_releases
                    FROM session_counts
                    WHERE project_id = $1
                      {}
                ) counts
                CROSS JOIN (
                    SELECT
                        CASE WHEN COUNT(DISTINCT did) > 0
                             THEN 1.0 - COUNT(DISTINCT CASE WHEN crashed THEN did END)::float8
                                  / NULLIF(COUNT(DISTINCT did), 0)
                             ELSE NULL END AS crash_free_users_rate
                    FROM session_users
                    WHERE project_id = $1
                      {}
                ) users
                "#,
            time_filter_sc, time_filter_su
        );

        let (
            total,
            errored,
            crashed,
            abnormal,
            crash_free_sessions_rate,
            crash_free_users_rate,
            active_releases,
        ): (i64, i64, i64, i64, Option<f64>, Option<f64>, i64) =
            sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
                .bind(project_id)
                .fetch_one(pool)
                .await?;

        Ok(SessionSummary {
            total,
            errored,
            crashed,
            abnormal,
            crash_free_sessions_rate,
            crash_free_users_rate,
            active_releases,
        })
    }

    #[cfg(not(feature = "postgres"))]
    {
        let time_filter_sc = if let Some(hours) = period_hours {
            format!(
                "AND bucket >= datetime('now', '-' || '{}' || ' hours')",
                hours
            )
        } else {
            String::new()
        };

        let sql = format!(
            r#"
            SELECT
                COALESCE(SUM(total), 0)    AS total,
                COALESCE(SUM(errored), 0)  AS errored,
                COALESCE(SUM(crashed), 0)  AS crashed,
                COALESCE(SUM(abnormal), 0) AS abnormal,
                COUNT(DISTINCT CASE WHEN total > 0 THEN release END) AS active_releases
            FROM session_counts
            WHERE project_id = ?1
              {}
            "#,
            time_filter_sc
        );

        let (total, errored, crashed, abnormal, active_releases): (i64, i64, i64, i64, i64) =
            sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
                .bind(project_id)
                .fetch_one(pool)
                .await?;

        let time_filter_su = if let Some(hours) = period_hours {
            format!("AND day >= date('now', '-' || '{}' || ' hours')", hours)
        } else {
            String::new()
        };

        let user_sql = format!(
            r#"
            SELECT
                COUNT(DISTINCT did),
                COUNT(DISTINCT CASE WHEN crashed = 1 THEN did END)
            FROM session_users
            WHERE project_id = ?1
              {}
            "#,
            time_filter_su
        );

        let (total_users, crashed_users): (i64, i64) =
            sqlx::query_as(sqlx::AssertSqlSafe(&*user_sql))
                .bind(project_id)
                .fetch_one(pool)
                .await?;

        let crash_free_sessions_rate = if total > 0 {
            Some(1.0 - crashed as f64 / total as f64)
        } else {
            None
        };
        let crash_free_users_rate = if total_users > 0 {
            Some(1.0 - crashed_users as f64 / total_users as f64)
        } else {
            None
        };

        Ok(SessionSummary {
            total,
            errored,
            crashed,
            abnormal,
            crash_free_sessions_rate,
            crash_free_users_rate,
            active_releases,
        })
    }
}

async fn query_session_timeseries(
    pool: &DbPool,
    project_id: i32,
    period_hours: Option<i64>,
    interval_hours: i64,
) -> Result<Vec<SessionTimeseriesPoint>, sqlx::Error> {
    let interval_seconds = interval_hours.max(1) * 3600;

    #[cfg(feature = "postgres")]
    {
        let time_filter = if let Some(hours) = period_hours {
            format!("AND bucket >= NOW() - '{} hours'::interval", hours)
        } else {
            String::new()
        };

        let sql = format!(
            r#"
                SELECT
                    to_timestamp(
                        floor(extract(epoch FROM bucket) / {interval_seconds}) * {interval_seconds}
                    ) AS bucket,
                    SUM(total)::bigint   AS total,
                    SUM(crashed)::bigint AS crashed,
                    CASE WHEN SUM(total) > 0
                         THEN 1.0 - SUM(crashed)::float8 / NULLIF(SUM(total), 0)
                         ELSE NULL END AS crash_free_sessions_rate
                FROM session_counts
                WHERE project_id = $1
                  {time_filter}
                GROUP BY 1
                ORDER BY 1 ASC
                "#,
        );

        let rows: Vec<(DateTime<Utc>, i64, i64, Option<f64>)> =
            sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
                .bind(project_id)
                .fetch_all(pool)
                .await?;

        Ok(rows
            .into_iter()
            .map(
                |(bucket, total, crashed, crash_free_sessions_rate)| SessionTimeseriesPoint {
                    bucket,
                    total,
                    crashed,
                    crash_free_sessions_rate,
                },
            )
            .collect())
    }

    #[cfg(not(feature = "postgres"))]
    {
        let time_filter = if let Some(hours) = period_hours {
            format!(
                "AND bucket >= datetime('now', '-' || '{}' || ' hours')",
                hours
            )
        } else {
            String::new()
        };

        let sql = format!(
            r#"
            SELECT
                datetime((CAST(strftime('%s', bucket) AS INTEGER) / {interval_seconds}) * {interval_seconds}, 'unixepoch') AS bucket,
                SUM(total)   AS total,
                SUM(crashed) AS crashed
            FROM session_counts
            WHERE project_id = ?1
              {time_filter}
            GROUP BY 1
            ORDER BY 1 ASC
            "#,
        );

        let rows: Vec<(String, i64, i64)> = sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
            .bind(project_id)
            .fetch_all(pool)
            .await?;

        Ok(rows
            .into_iter()
            .map(|(bucket, total, crashed)| {
                let bucket = crate::models::session::parse_ts(&bucket).unwrap_or_else(Utc::now);
                let crash_free_sessions_rate = if total > 0 {
                    Some(1.0 - crashed as f64 / total as f64)
                } else {
                    None
                };
                SessionTimeseriesPoint {
                    bucket,
                    total,
                    crashed,
                    crash_free_sessions_rate,
                }
            })
            .collect())
    }
}
