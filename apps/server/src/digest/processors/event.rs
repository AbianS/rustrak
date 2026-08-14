use super::{Processor, ProcessorCtx};
use crate::config::RateLimitConfig;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::ingest::{delete_event, read_event, EventMetadata};
use crate::models::{Grouping, Issue};
use crate::services::sourcemap::SourceMapProvider;
use crate::services::{
    calculate_grouping_key, get_denormalized_fields, hash_grouping_key, AlertService,
    DenormalizedFields, EventService, ProjectService, RateLimitService,
};
use chrono::Utc;
use std::path::PathBuf;
use std::sync::Arc;
use uuid::Uuid;

/// Processes error/exception events: source-map rewrite → grouping → issue → store.
///
/// Owns the deps the error pipeline needs (`ingest_dir`, `rate_limit_config`,
/// `sourcemap_provider`) — the registry pattern, so [`ProcessorCtx`] stays lean
/// for processors that don't need them. `Input = EventMetadata`: the event body
/// lives in the durable temp store and is read inside [`Self::process`].
pub struct ErrorProcessor {
    ingest_dir: PathBuf,
    rate_limit_config: RateLimitConfig,
    sourcemap_provider: Arc<dyn SourceMapProvider>,
    /// Serializes digest writes (SQLite): digests queue here without
    /// holding a pool connection.
    #[cfg(feature = "sqlite")]
    writer_slot: Arc<tokio::sync::Semaphore>,
}

impl ErrorProcessor {
    pub fn new(
        ingest_dir: PathBuf,
        rate_limit_config: RateLimitConfig,
        sourcemap_provider: Arc<dyn SourceMapProvider>,
    ) -> Self {
        Self {
            ingest_dir,
            rate_limit_config,
            sourcemap_provider,
            #[cfg(feature = "sqlite")]
            writer_slot: Arc::new(tokio::sync::Semaphore::new(1)),
        }
    }

    /// The digest pipeline body. Guarantees the temp file is deleted on failure.
    async fn process_impl(&self, metadata: &EventMetadata, ctx: &ProcessorCtx) -> AppResult<()> {
        let pool = &ctx.pool;
        let _digested_at = Utc::now();

        // 0. Double-check rate limits (for backlog scenarios)
        let project = ProjectService::get_by_id(pool, metadata.project_id).await?;
        if let Some(_exceeded) = RateLimitService::check_quota(pool, &project).await? {
            log::warn!(
                "Event {} discarded due to quota exceeded (backlog)",
                metadata.event_id
            );
            delete_event(&self.ingest_dir, &metadata.event_id).await?;
            return Ok(());
        }

        // 1. Read event from filesystem
        let event_bytes = read_event(&self.ingest_dir, &metadata.event_id).await?;
        let mut event_data: serde_json::Value = serde_json::from_slice(&event_bytes)
            .map_err(|e| AppError::Internal(format!("Invalid event JSON: {}", e)))?;

        // 1b. Rewrite stack frames using source maps (non-fatal)
        if let Err(e) = crate::services::sourcemap::rewrite_frames(
            self.sourcemap_provider.as_ref(),
            metadata.project_id,
            &mut event_data,
        )
        .await
        {
            log::warn!(
                "source map rewriting failed for event {}: {:?}",
                metadata.event_id,
                e
            );
        }

        // 1c. Trim oversized fields (deep context windows, frame vars, huge
        // breadcrumb trails) for events whose raw payload came in above the
        // original per-item budget — see services::event_trim. Only runs for
        // the (rare) events that needed the relaxed ingest ceiling, so this
        // is a no-op for the common case.
        if event_bytes.len() > crate::ingest::parser::TARGET_EVENT_SIZE {
            crate::services::trim_oversized_event(&mut event_data);
        }

        // 2. Parse event_id as UUID
        let event_id = Uuid::parse_str(&metadata.event_id)
            .map_err(|_| AppError::Validation("Invalid event_id".to_string()))?;

        // 3. Check for duplicates
        if EventService::exists(pool, metadata.project_id, event_id).await? {
            log::warn!("Duplicate event_id: {}", metadata.event_id);
            delete_event(&self.ingest_dir, &metadata.event_id).await?;
            return Ok(());
        }

        // 4. Calculate grouping key and hash
        let grouping_key = calculate_grouping_key(&event_data);
        let grouping_key_hash = hash_grouping_key(&grouping_key);

        // 5. Extract denormalized fields
        let denormalized = get_denormalized_fields(&event_data);

        // 6. Find or create Grouping/Issue (within a transaction with advisory lock)
        let (issue, grouping, issue_created, regressed) =
            find_or_create_issue_and_grouping_with_lock(
                pool,
                &metadata.event_id,
                #[cfg(feature = "sqlite")]
                &self.writer_slot,
                metadata.project_id,
                &grouping_key,
                &grouping_key_hash,
                metadata.ingested_at,
                &denormalized,
                event_data.get("level").and_then(|l| l.as_str()),
                event_data.get("platform").and_then(|p| p.as_str()),
            )
            .await?;

        // 7. Create Event. No digest_order to compute -- events order within
        // an issue by (timestamp, id) (see idx_events_issue_timestamp), which
        // needs no per-issue counter to derive or keep in sync.
        EventService::create(
            pool,
            event_id,
            metadata.project_id,
            issue.id,
            grouping.id,
            &event_data,
            metadata.ingested_at,
            &denormalized,
            metadata.remote_addr.as_deref(),
        )
        .await?;

        // 8. Update project counters and rate limit state
        sqlx::query(
            "UPDATE projects SET stored_event_count = stored_event_count + 1 WHERE id = $1",
        )
        .bind(metadata.project_id)
        .execute(pool)
        .await?;

        // 8b. Sentry-parity platform auto-detection (set once, never overwritten)
        if let Some(event_platform) = event_data.get("platform").and_then(|p| p.as_str()) {
            ProjectService::infer_platform_from_event(pool, metadata.project_id, event_platform)
                .await?;
        }

        // Update rate limiting quotas (handles digested_event_count)
        RateLimitService::update_quota_state(pool, metadata.project_id, &self.rate_limit_config)
            .await?;

        // 9. Delete temporary file
        delete_event(&self.ingest_dir, &metadata.event_id).await?;

        log::info!(
            "Digested event {} -> issue {} ({})",
            metadata.event_id,
            issue.id,
            if issue_created { "new" } else { "existing" }
        );

        // 10. Trigger alerts for new issues and regressions
        if issue_created || regressed {
            let pool = pool.clone();
            let project = project.clone();
            let issue = issue.clone();
            let dashboard_url = std::env::var("DASHBOARD_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string());

            tokio::spawn(async move {
                let result = if issue_created {
                    AlertService::trigger_new_issue_alert(&pool, &project, &issue, &dashboard_url)
                        .await
                } else {
                    AlertService::trigger_regression_alert(&pool, &project, &issue, &dashboard_url)
                        .await
                };
                if let Err(e) = result {
                    log::error!("Failed to trigger issue alert: {}", e);
                }
            });
        }

        Ok(())
    }
}

impl Processor for ErrorProcessor {
    type Input = EventMetadata;

    async fn process(&self, metadata: EventMetadata, ctx: &ProcessorCtx) -> AppResult<()> {
        let result = self.process_impl(&metadata, ctx).await;
        if result.is_err() {
            if let Err(e) = delete_event(&self.ingest_dir, &metadata.event_id).await {
                log::warn!(
                    "Failed to clean up orphaned event file {}: {:?}",
                    metadata.event_id,
                    e
                );
            }
        }
        result
    }
}

/// Write attempts per digest on SQLite. Bounded: sustained contention
/// fails fast instead of piling up more waiters.
const MAX_SQLITE_WRITE_ATTEMPTS: usize = 3;

/// How long a digest may wait for the writer slot before the attempt
/// counts as contended (and is retried).
#[cfg(feature = "sqlite")]
const WRITER_SLOT_BUDGET: std::time::Duration = std::time::Duration::from_secs(1);

/// Backoff before retry `attempt` (0-based): 50ms, then 100ms — brief,
/// so writers that timed out together don't retry in lockstep.
fn sqlite_retry_delay(attempt: usize) -> std::time::Duration {
    std::time::Duration::from_millis(50 << attempt)
}

/// True for transient SQLite write contention: the busy family (codes 5,
/// 261, 517, 773) or a writer-slot budget expiry (pool-acquire timeout).
/// Always false on Postgres.
fn is_retryable_write_contention(err: &AppError) -> bool {
    match err.kind() {
        AppError::Database(sqlx::Error::Database(db)) => {
            db.code().as_deref().is_some_and(is_sqlite_busy_code)
        }
        #[cfg(feature = "sqlite")]
        AppError::Database(sqlx::Error::PoolTimedOut) => true,
        _ => false,
    }
}

/// Whether a SQLite extended result code string means "database is locked".
fn is_sqlite_busy_code(code: &str) -> bool {
    matches!(code, "5" | "261" | "517" | "773")
}

/// Finds the grouping or creates the issue, retrying the write tx when the
/// database is busy. Only a whole-tx restart is safe (a `BUSY_SNAPSHOT`
/// snapshot can never be resumed); SQLite attempts queue behind the writer
/// slot without holding a connection. No-op on Postgres.
#[allow(clippy::too_many_arguments)]
async fn find_or_create_issue_and_grouping_with_lock(
    pool: &DbPool,
    event_id: &str,
    #[cfg(feature = "sqlite")] writer_slot: &tokio::sync::Semaphore,
    project_id: i32,
    grouping_key: &str,
    grouping_key_hash: &str,
    timestamp: chrono::DateTime<Utc>,
    denormalized: &DenormalizedFields,
    level: Option<&str>,
    platform: Option<&str>,
) -> AppResult<(Issue, Grouping, bool, bool)> {
    let mut attempt = 0usize;
    loop {
        let result = async {
            // Take the writer slot first (SQLite only): digests queue here
            // without holding a pool connection; an expired budget counts
            // as contention and flows into the same retry loop.
            #[cfg(feature = "sqlite")]
            let _slot_permit = match tokio::time::timeout(WRITER_SLOT_BUDGET, writer_slot.acquire())
                .await
            {
                Ok(Ok(permit)) => permit,
                // Fail closed: a closed semaphore must not let the
                // digest proceed unserialized.
                Ok(Err(_)) | Err(_) => return Err(AppError::Database(sqlx::Error::PoolTimedOut)),
            };
            find_or_create_issue_and_grouping_once(
                pool,
                project_id,
                grouping_key,
                grouping_key_hash,
                timestamp,
                denormalized,
                level,
                platform,
            )
            .await
        }
        .await;

        match result {
            Err(e)
                if is_retryable_write_contention(&e) && attempt + 1 < MAX_SQLITE_WRITE_ATTEMPTS =>
            {
                // Expected under load — one debug line per failed attempt;
                // the healed episode itself is reported once at info below.
                log::debug!(
                    "SQLite write slot/lock busy for event {event_id}; attempt {}/{} failed, retrying",
                    attempt + 1,
                    MAX_SQLITE_WRITE_ATTEMPTS
                );
                tokio::time::sleep(sqlite_retry_delay(attempt)).await;
                attempt += 1;
            }
            result => {
                if attempt > 0 && result.is_ok() {
                    log::info!(
                        "SQLite write lock busy for event {event_id}; healed after {attempt} retries"
                    );
                }
                return result;
            }
        }
    }
}

/// One attempt at finding an existing grouping or creating a new issue.
///
/// Runs in a write transaction: `BEGIN IMMEDIATE` on SQLite (write lock
/// up front, so `busy_timeout` can wait on it), plus a per-project
/// advisory lock on Postgres.
#[allow(clippy::too_many_arguments)]
async fn find_or_create_issue_and_grouping_once(
    pool: &DbPool,
    project_id: i32,
    grouping_key: &str,
    grouping_key_hash: &str,
    timestamp: chrono::DateTime<Utc>,
    denormalized: &DenormalizedFields,
    level: Option<&str>,
    platform: Option<&str>,
) -> AppResult<(Issue, Grouping, bool, bool)> {
    // Start a write transaction. On SQLite this is `BEGIN IMMEDIATE` so the
    // read-then-write below (SELECT MAX(digest_order) → INSERT) takes the write
    // lock up front instead of failing with "database is locked" on upgrade.
    let mut tx = crate::db::begin_write(pool).await?;

    // Acquire advisory lock for this project (Postgres only).
    // SQLite serializes all writes, so no advisory lock needed.
    #[cfg(feature = "postgres")]
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(project_id as i64)
        .execute(&mut *tx)
        .await?;

    // Now we have exclusive access to issue creation for this project
    let result = find_or_create_issue_and_grouping_inner(
        &mut tx,
        project_id,
        grouping_key,
        grouping_key_hash,
        timestamp,
        denormalized,
        level,
        platform,
    )
    .await;

    match result {
        Ok((issue, grouping, created, regressed)) => {
            // Commit the transaction (releases the advisory lock)
            tx.commit().await?;
            Ok((issue, grouping, created, regressed))
        }
        Err(e) => {
            // Rollback on error (also releases the advisory lock)
            tx.rollback().await?;
            Err(e)
        }
    }
}

/// Inner function that performs the actual find-or-create logic within a transaction
#[cfg(feature = "postgres")]
type DbBackend = sqlx::Postgres;
#[cfg(feature = "sqlite")]
type DbBackend = sqlx::Sqlite;

#[allow(clippy::too_many_arguments)]
async fn find_or_create_issue_and_grouping_inner(
    tx: &mut sqlx::Transaction<'_, DbBackend>,
    project_id: i32,
    grouping_key: &str,
    grouping_key_hash: &str,
    timestamp: chrono::DateTime<Utc>,
    denormalized: &DenormalizedFields,
    level: Option<&str>,
    platform: Option<&str>,
) -> AppResult<(Issue, Grouping, bool, bool)> {
    // Try to find existing grouping
    let existing_grouping: Option<Grouping> = sqlx::query_as(
        r#"
        SELECT * FROM groupings
        WHERE project_id = $1 AND grouping_key_hash = $2
        "#,
    )
    .bind(project_id)
    .bind(grouping_key_hash)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(grouping) = existing_grouping {
        // Detect regression: a new event for an already-resolved issue must
        // reopen it as `regressed` (mirrors Sentry's lifecycle) — unless the
        // issue was "resolved in next release" and this event is still from the
        // same release (no new deploy yet), in which case it stays resolved.
        let prev: (String, String, String) =
            sqlx::query_as("SELECT status, status_details, last_release FROM issues WHERE id = $1")
                .bind(grouping.issue_id)
                .fetch_one(&mut **tx)
                .await?;
        let in_next_release = serde_json::from_str::<serde_json::Value>(&prev.1)
            .ok()
            .and_then(|v| v.get("in_next_release").and_then(|b| b.as_bool()))
            .unwrap_or(false);
        // An event with no release metadata can't prove it's from a newer
        // release, so treat it as the same release rather than triggering a
        // spurious regression reopen.
        let same_release = denormalized.release.is_empty() || denormalized.release == prev.2;
        let suppress = in_next_release && same_release;
        let regressed = prev.0 == crate::models::STATUS_RESOLVED && !suppress;

        // Grouping exists, update issue (reopening it if it regressed).
        let issue: Issue = if regressed {
            sqlx::query_as(
                r#"
                UPDATE issues
                SET last_seen = $2,
                    digested_event_count = digested_event_count + 1,
                    stored_event_count = stored_event_count + 1,
                    status = 'unresolved',
                    substatus = 'regressed',
                    status_details = '{}',
                    last_release = CASE WHEN $3 <> '' THEN $3 ELSE last_release END,
                    first_release = CASE WHEN first_release = '' THEN $3 ELSE first_release END
                WHERE id = $1
                RETURNING *
                "#,
            )
            .bind(grouping.issue_id)
            .bind(timestamp)
            .bind(&denormalized.release)
            .fetch_one(&mut **tx)
            .await?
        } else {
            sqlx::query_as(
                r#"
                UPDATE issues
                SET last_seen = $2,
                    digested_event_count = digested_event_count + 1,
                    stored_event_count = stored_event_count + 1,
                    last_release = CASE WHEN $3 <> '' THEN $3 ELSE last_release END,
                    first_release = CASE WHEN first_release = '' THEN $3 ELSE first_release END
                WHERE id = $1
                RETURNING *
                "#,
            )
            .bind(grouping.issue_id)
            .bind(timestamp)
            .bind(&denormalized.release)
            .fetch_one(&mut **tx)
            .await?
        };

        return Ok((issue, grouping, false, regressed));
    }

    // Get the next digest_order for this project (safe because we hold the advisory lock)
    let max_order: Option<i32> =
        sqlx::query_scalar("SELECT MAX(digest_order) FROM issues WHERE project_id = $1")
            .bind(project_id)
            .fetch_one(&mut **tx)
            .await?;

    let digest_order = max_order.unwrap_or(0) + 1;

    // Create new issue (generate UUID in application for cross-DB compatibility)
    let issue_id = Uuid::new_v4();
    let priority = crate::services::issue::derive_priority(level);
    let issue: Issue = sqlx::query_as(
        r#"
        INSERT INTO issues (
            id, project_id, digest_order, first_seen, last_seen,
            digested_event_count, stored_event_count,
            calculated_type, calculated_value, "transaction",
            last_frame_filename, last_frame_module, last_frame_function,
            level, platform, status, substatus, priority, culprit, logger,
            first_release, last_release
        )
        VALUES (
            $1, $2, $3, $4, $4, 1, 1, $5, $6, $7, $8, $9, $10, $11, $12,
            'unresolved', 'new', $13, $14, $15, $16, $16
        )
        RETURNING *
        "#,
    )
    .bind(issue_id)
    .bind(project_id)
    .bind(digest_order)
    .bind(timestamp)
    .bind(&denormalized.calculated_type)
    .bind(&denormalized.calculated_value)
    .bind(&denormalized.transaction)
    .bind(&denormalized.last_frame_filename)
    .bind(&denormalized.last_frame_module)
    .bind(&denormalized.last_frame_function)
    .bind(level)
    .bind(platform)
    .bind(priority)
    .bind(&denormalized.culprit)
    .bind(&denormalized.logger)
    .bind(&denormalized.release)
    .fetch_one(&mut **tx)
    .await?;

    // Create new grouping
    let grouping: Grouping = sqlx::query_as(
        r#"
        INSERT INTO groupings (project_id, issue_id, grouping_key, grouping_key_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(project_id)
    .bind(issue.id)
    .bind(grouping_key)
    .bind(grouping_key_hash)
    .fetch_one(&mut **tx)
    .await?;

    Ok((issue, grouping, true, false))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn busy_codes_are_recognized_and_others_are_not() {
        for code in ["5", "261", "517", "773"] {
            assert!(is_sqlite_busy_code(code), "{code} must classify as busy");
        }
        assert!(
            !is_sqlite_busy_code("2067"),
            "a unique-constraint code is not a busy error"
        );
    }

    #[test]
    fn retries_back_off_exponentially_from_50ms() {
        assert_eq!(sqlite_retry_delay(0), std::time::Duration::from_millis(50));
        assert_eq!(sqlite_retry_delay(1), std::time::Duration::from_millis(100));
    }

    #[cfg(feature = "sqlite")]
    #[test]
    fn slot_timeout_counts_as_retryable_contention() {
        let slot_busy = AppError::Database(sqlx::Error::PoolTimedOut);
        assert!(is_retryable_write_contention(&slot_busy));
        let other = AppError::Database(sqlx::Error::RowNotFound);
        assert!(!is_retryable_write_contention(&other));
    }
}
