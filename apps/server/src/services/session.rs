use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::session::ReleaseHealthRow;

#[cfg(feature = "postgres")]
type PgHealthRow = (String, String, i64, i64, i64, i64, Option<f64>, Option<f64>);

pub struct SessionService;

impl SessionService {
    /// Query per-release health stats for a project over the given period (hours).
    pub async fn release_health(
        pool: &DbPool,
        project_id: i32,
        period_hours: i64,
    ) -> AppResult<Vec<ReleaseHealthRow>> {
        let rows = query_release_health(pool, project_id, period_hours).await?;
        Ok(rows)
    }
}

async fn query_release_health(
    pool: &DbPool,
    project_id: i32,
    period_hours: i64,
) -> Result<Vec<ReleaseHealthRow>, sqlx::Error> {
    #[cfg(feature = "postgres")]
    {
        let rows: Vec<PgHealthRow> = sqlx::query_as(
            r#"
                SELECT
                    sc.release,
                    sc.environment,
                    SUM(sc.total)    AS total,
                    SUM(sc.errored)  AS errored,
                    SUM(sc.crashed)  AS crashed,
                    SUM(sc.abnormal) AS abnormal,
                    CASE WHEN SUM(sc.total) > 0
                         THEN 1.0 - SUM(sc.crashed)::float8 / NULLIF(SUM(sc.total), 0)
                         ELSE NULL END AS crash_free_sessions_rate,
                    CASE WHEN COUNT(DISTINCT su.did) > 0
                         THEN 1.0 - COUNT(DISTINCT CASE WHEN su.crashed THEN su.did END)::float8
                              / NULLIF(COUNT(DISTINCT su.did), 0)
                         ELSE NULL END AS crash_free_users_rate
                FROM session_counts sc
                LEFT JOIN session_users su
                    ON su.project_id = sc.project_id
                   AND su.release    = sc.release
                   AND su.environment = sc.environment
                   AND su.day >= (NOW() - ($2::text || ' hours')::interval)::date
                WHERE sc.project_id = $1
                  AND sc.bucket >= NOW() - ($2::text || ' hours')::interval
                GROUP BY sc.release, sc.environment
                ORDER BY SUM(sc.total) DESC
                "#,
        )
        .bind(project_id)
        .bind(period_hours)
        .fetch_all(pool)
        .await?;

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
        // SQLite: datetime arithmetic via strftime
        let rows: Vec<(String, String, i64, i64, i64, i64)> = sqlx::query_as(
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
              AND bucket >= datetime('now', '-' || ?2 || ' hours')
            GROUP BY release, environment
            ORDER BY SUM(total) DESC
            "#,
        )
        .bind(project_id)
        .bind(period_hours)
        .fetch_all(pool)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for (release, environment, total, errored, crashed, abnormal) in rows {
            // For crash-free-users we need a second query per release in SQLite
            let (total_users, crashed_users): (i64, i64) = sqlx::query_as(
                r#"
                SELECT
                    COUNT(DISTINCT did),
                    COUNT(DISTINCT CASE WHEN crashed = 1 THEN did END)
                FROM session_users
                WHERE project_id = ?1
                  AND release = ?2
                  AND environment = ?3
                  AND day >= date('now', '-' || ?4 || ' hours')
                "#,
            )
            .bind(project_id)
            .bind(&release)
            .bind(&environment)
            .bind(period_hours)
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
