use chrono::Utc;
use sqlx::{PgPool, Postgres, Transaction};
use std::path::Path;
use uuid::Uuid;

use crate::config::RateLimitConfig;
use crate::error::{AppError, AppResult};
use crate::ingest::{delete_event, read_event, EventMetadata};
use crate::models::{Grouping, Issue};
use crate::services::{
    calculate_grouping_key, get_denormalized_fields, hash_grouping_key, AlertService,
    DenormalizedFields, EventService, ProjectService, RateLimitService,
};

/// Processes an event from temporary storage
pub async fn process_event(
    pool: &PgPool,
    metadata: &EventMetadata,
    ingest_dir: &Path,
    rate_limit_config: &RateLimitConfig,
) -> AppResult<()> {
    let _digested_at = Utc::now();

    // 0. Double-check rate limits (for backlog scenarios)
    let project = ProjectService::get_by_id(pool, metadata.project_id).await?;
    if let Some(_exceeded) = RateLimitService::check_quota(pool, &project).await? {
        log::warn!(
            "Event {} discarded due to quota exceeded (backlog)",
            metadata.event_id
        );
        delete_event(ingest_dir, &metadata.event_id).await?;
        return Ok(());
    }

    // 1. Read event from filesystem
    let event_bytes = read_event(ingest_dir, &metadata.event_id).await?;
    let event_data: serde_json::Value = serde_json::from_slice(&event_bytes)
        .map_err(|e| AppError::Internal(format!("Invalid event JSON: {}", e)))?;

    // 2. Parse event_id as UUID
    let event_id = Uuid::parse_str(&metadata.event_id)
        .map_err(|_| AppError::Validation("Invalid event_id".to_string()))?;

    // 3. Check for duplicates
    if EventService::exists(pool, metadata.project_id, event_id).await? {
        log::warn!("Duplicate event_id: {}", metadata.event_id);
        delete_event(ingest_dir, &metadata.event_id).await?;
        return Ok(());
    }

    // 4. Calculate grouping key and hash
    let grouping_key = calculate_grouping_key(&event_data);
    let grouping_key_hash = hash_grouping_key(&grouping_key);

    // 5. Extract denormalized fields
    let denormalized = get_denormalized_fields(&event_data);

    // 6. Find or create Grouping/Issue (within a transaction with advisory lock)
    let (issue, grouping, issue_created) = find_or_create_issue_and_grouping_with_lock(
        pool,
        metadata.project_id,
        &grouping_key,
        &grouping_key_hash,
        metadata.ingested_at,
        &denormalized,
        event_data.get("level").and_then(|l| l.as_str()),
        event_data.get("platform").and_then(|p| p.as_str()),
    )
    .await?;

    // 7. Create Event
    let digest_order = if issue_created {
        1
    } else {
        issue.digested_event_count
    };

    EventService::create(
        pool,
        event_id,
        metadata.project_id,
        issue.id,
        grouping.id,
        &event_data,
        metadata.ingested_at,
        &denormalized,
        digest_order,
        metadata.remote_addr.as_deref(),
    )
    .await?;

    // 8. Update project counters and rate limit state
    sqlx::query("UPDATE projects SET stored_event_count = stored_event_count + 1 WHERE id = $1")
        .bind(metadata.project_id)
        .execute(pool)
        .await?;

    // Update rate limiting quotas (handles digested_event_count)
    RateLimitService::update_quota_state(pool, metadata.project_id, rate_limit_config).await?;

    // 9. Delete temporary file
    delete_event(ingest_dir, &metadata.event_id).await?;

    log::info!(
        "Digested event {} -> issue {} ({})",
        metadata.event_id,
        issue.id,
        if issue_created { "new" } else { "existing" }
    );

    // 10. Trigger alerts for new issues
    if issue_created {
        let pool = pool.clone();
        let project = project.clone();
        let issue = issue.clone();
        let dashboard_url =
            std::env::var("DASHBOARD_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());

        tokio::spawn(async move {
            if let Err(e) =
                AlertService::trigger_new_issue_alert(&pool, &project, &issue, &dashboard_url).await
            {
                log::error!("Failed to trigger new issue alert: {}", e);
            }
        });
    }

    Ok(())
}

/// Finds an existing grouping or creates a new one along with its issue.
/// Uses a PostgreSQL advisory lock per project to prevent race conditions
/// when creating new issues with sequential digest_order values.
///
/// Advisory locks are automatically released when the transaction commits or rolls back.
/// Different projects can process events concurrently (locks are per-project).
#[allow(clippy::too_many_arguments)]
async fn find_or_create_issue_and_grouping_with_lock(
    pool: &PgPool,
    project_id: i32,
    grouping_key: &str,
    grouping_key_hash: &str,
    timestamp: chrono::DateTime<Utc>,
    denormalized: &DenormalizedFields,
    level: Option<&str>,
    platform: Option<&str>,
) -> AppResult<(Issue, Grouping, bool)> {
    // Start a transaction
    let mut tx = pool.begin().await?;

    // Acquire advisory lock for this project (released automatically on commit/rollback)
    // We use pg_advisory_xact_lock which is transaction-scoped
    // The lock key is the project_id cast to bigint
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
        Ok((issue, grouping, created)) => {
            // Commit the transaction (releases the advisory lock)
            tx.commit().await?;
            Ok((issue, grouping, created))
        }
        Err(e) => {
            // Rollback on error (also releases the advisory lock)
            tx.rollback().await?;
            Err(e)
        }
    }
}

/// Inner function that performs the actual find-or-create logic within a transaction
#[allow(clippy::too_many_arguments)]
async fn find_or_create_issue_and_grouping_inner(
    tx: &mut Transaction<'_, Postgres>,
    project_id: i32,
    grouping_key: &str,
    grouping_key_hash: &str,
    timestamp: chrono::DateTime<Utc>,
    denormalized: &DenormalizedFields,
    level: Option<&str>,
    platform: Option<&str>,
) -> AppResult<(Issue, Grouping, bool)> {
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
        // Grouping exists, update issue
        let issue: Issue = sqlx::query_as(
            r#"
            UPDATE issues
            SET last_seen = $2,
                digested_event_count = digested_event_count + 1,
                stored_event_count = stored_event_count + 1
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(grouping.issue_id)
        .bind(timestamp)
        .fetch_one(&mut **tx)
        .await?;

        return Ok((issue, grouping, false));
    }

    // Get the next digest_order for this project (safe because we hold the advisory lock)
    let max_order: Option<i32> =
        sqlx::query_scalar("SELECT MAX(digest_order) FROM issues WHERE project_id = $1")
            .bind(project_id)
            .fetch_one(&mut **tx)
            .await?;

    let digest_order = max_order.unwrap_or(0) + 1;

    // Create new issue
    let issue: Issue = sqlx::query_as(
        r#"
        INSERT INTO issues (
            project_id, digest_order, first_seen, last_seen,
            digested_event_count, stored_event_count,
            calculated_type, calculated_value, transaction,
            last_frame_filename, last_frame_module, last_frame_function,
            level, platform
        )
        VALUES ($1, $2, $3, $3, 1, 1, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
        "#,
    )
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

    Ok((issue, grouping, true))
}
