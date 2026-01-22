use chrono::{Duration, Utc};
use sqlx::PgPool;

use crate::config::RateLimitConfig;
use crate::error::AppResult;
use crate::models::{Installation, Project};

pub struct RateLimitService;

/// Result when quota is exceeded
#[derive(Debug)]
pub struct QuotaExceeded {
    /// Seconds until the quota resets
    pub retry_after: u64,
    /// Which scope triggered the limit (Installation or Project)
    ///
    /// NOTE: Currently unused but kept for future detailed error responses
    /// showing which limit (global vs project) was exceeded.
    #[allow(dead_code)]
    pub scope: QuotaScope,
}

#[derive(Debug)]
pub enum QuotaScope {
    Installation,
    Project,
}

impl RateLimitService {
    /// Gets the installation singleton
    pub async fn get_installation(pool: &PgPool) -> AppResult<Installation> {
        let installation =
            sqlx::query_as::<_, Installation>("SELECT * FROM installation WHERE id = 1")
                .fetch_one(pool)
                .await?;
        Ok(installation)
    }

    /// Checks if quota is exceeded for installation or project (call during ingest)
    /// Returns Some(QuotaExceeded) if rate limited, None if allowed
    pub async fn check_quota(pool: &PgPool, project: &Project) -> AppResult<Option<QuotaExceeded>> {
        let now = Utc::now();

        // 1. Check installation (global) quota
        let installation = Self::get_installation(pool).await?;
        if let Some(until) = installation.quota_exceeded_until {
            if now < until {
                let retry_after = (until - now).num_seconds().max(1) as u64;
                return Ok(Some(QuotaExceeded {
                    retry_after,
                    scope: QuotaScope::Installation,
                }));
            }
        }

        // 2. Check project quota
        if let Some(until) = project.quota_exceeded_until {
            if now < until {
                let retry_after = (until - now).num_seconds().max(1) as u64;
                return Ok(Some(QuotaExceeded {
                    retry_after,
                    scope: QuotaScope::Project,
                }));
            }
        }

        Ok(None)
    }

    /// Updates quota state after digesting an event
    /// Call this during digest, after the event is processed
    pub async fn update_quota_state(
        pool: &PgPool,
        project_id: i32,
        config: &RateLimitConfig,
    ) -> AppResult<()> {
        let now = Utc::now();

        // Update installation quota
        Self::update_installation_quota(pool, config, now).await?;

        // Update project quota
        Self::update_project_quota(pool, project_id, config, now).await?;

        Ok(())
    }

    /// Counts events in a time window for the whole installation
    async fn count_global_events_since(
        pool: &PgPool,
        since: chrono::DateTime<Utc>,
    ) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM events WHERE digested_at >= $1")
            .bind(since)
            .fetch_one(pool)
            .await?;
        Ok(count)
    }

    /// Counts events in a time window for a specific project
    async fn count_project_events_since(
        pool: &PgPool,
        project_id: i32,
        since: chrono::DateTime<Utc>,
    ) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM events WHERE project_id = $1 AND digested_at >= $2",
        )
        .bind(project_id)
        .bind(since)
        .fetch_one(pool)
        .await?;
        Ok(count)
    }

    /// Updates installation quota state
    async fn update_installation_quota(
        pool: &PgPool,
        config: &RateLimitConfig,
        now: chrono::DateTime<Utc>,
    ) -> AppResult<()> {
        let installation = Self::get_installation(pool).await?;

        // Increment global digested count
        let new_count = installation.digested_event_count + 1;

        // Calculate minimum threshold for optimization
        let min_threshold = config.max_events_per_minute.min(config.max_events_per_hour);

        // Only do expensive COUNT if needed
        let should_check = new_count >= installation.next_quota_check
            || (installation.next_quota_check - new_count) > min_threshold;

        if should_check {
            // Count events in each window (parallel queries)
            let (count_minute, count_hour) = tokio::try_join!(
                Self::count_global_events_since(pool, now - Duration::minutes(1)),
                Self::count_global_events_since(pool, now - Duration::hours(1))
            )?;

            // Check which thresholds are exceeded
            let (exceeded_until, exceeded_reason) = if count_minute + 1
                >= config.max_events_per_minute
            {
                // Exceeded per-minute limit
                let until = now + Duration::minutes(1);
                let reason = serde_json::to_string(&("minute", 1, config.max_events_per_minute))
                    .expect("tuple serialization should not fail");
                (Some(until), Some(reason))
            } else if count_hour + 1 >= config.max_events_per_hour {
                // Exceeded per-hour limit
                let until = now + Duration::hours(1);
                let reason = serde_json::to_string(&("hour", 1, config.max_events_per_hour))
                    .expect("tuple serialization should not fail");
                (Some(until), Some(reason))
            } else {
                (None, None)
            };

            // Calculate when to check again
            let check_again_after = (config.max_events_per_minute - count_minute - 1)
                .min(config.max_events_per_hour - count_hour - 1)
                .max(1);

            sqlx::query(
                r#"
                UPDATE installation
                SET digested_event_count = $1,
                    quota_exceeded_until = $2,
                    quota_exceeded_reason = $3,
                    next_quota_check = $4
                WHERE id = 1
                "#,
            )
            .bind(new_count)
            .bind(exceeded_until)
            .bind(exceeded_reason)
            .bind(new_count + check_again_after)
            .execute(pool)
            .await?;
        } else {
            // Just increment the counter
            sqlx::query("UPDATE installation SET digested_event_count = $1 WHERE id = 1")
                .bind(new_count)
                .execute(pool)
                .await?;
        }

        Ok(())
    }

    /// Updates project quota state
    async fn update_project_quota(
        pool: &PgPool,
        project_id: i32,
        config: &RateLimitConfig,
        now: chrono::DateTime<Utc>,
    ) -> AppResult<()> {
        // Get current project state
        let project: Project = sqlx::query_as("SELECT * FROM projects WHERE id = $1")
            .bind(project_id)
            .fetch_one(pool)
            .await?;

        // Increment project digested count
        let new_count = project.digested_event_count as i64 + 1;

        // Calculate minimum threshold for optimization
        let min_threshold = config
            .max_events_per_project_per_minute
            .min(config.max_events_per_project_per_hour);

        // Only do expensive COUNT if needed
        let should_check = new_count >= project.next_quota_check
            || (project.next_quota_check - new_count) > min_threshold;

        if should_check {
            // Count events in each window (parallel queries)
            let (count_minute, count_hour) = tokio::try_join!(
                Self::count_project_events_since(pool, project_id, now - Duration::minutes(1)),
                Self::count_project_events_since(pool, project_id, now - Duration::hours(1))
            )?;

            // Check which thresholds are exceeded
            let (exceeded_until, exceeded_reason) = if count_minute + 1
                >= config.max_events_per_project_per_minute
            {
                let until = now + Duration::minutes(1);
                let reason =
                    serde_json::to_string(&("minute", 1, config.max_events_per_project_per_minute))
                        .expect("tuple serialization should not fail");
                (Some(until), Some(reason))
            } else if count_hour + 1 >= config.max_events_per_project_per_hour {
                let until = now + Duration::hours(1);
                let reason =
                    serde_json::to_string(&("hour", 1, config.max_events_per_project_per_hour))
                        .expect("tuple serialization should not fail");
                (Some(until), Some(reason))
            } else {
                (None, None)
            };

            // Calculate when to check again
            let check_again_after = (config.max_events_per_project_per_minute - count_minute - 1)
                .min(config.max_events_per_project_per_hour - count_hour - 1)
                .max(1);

            sqlx::query(
                r#"
                UPDATE projects
                SET digested_event_count = digested_event_count + 1,
                    quota_exceeded_until = $2,
                    quota_exceeded_reason = $3,
                    next_quota_check = $4
                WHERE id = $1
                "#,
            )
            .bind(project_id)
            .bind(exceeded_until)
            .bind(exceeded_reason)
            .bind(new_count + check_again_after)
            .execute(pool)
            .await?;
        } else {
            // Just increment the counter
            sqlx::query(
                "UPDATE projects SET digested_event_count = digested_event_count + 1 WHERE id = $1",
            )
            .bind(project_id)
            .execute(pool)
            .await?;
        }

        Ok(())
    }
}
