use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::Issue;
use crate::pagination::{IssueCursor, IssueFilter, IssueSort, SortOrder};
use crate::services::grouping::DenormalizedFields;

pub struct IssueService;

impl IssueService {
    /// Lists issues with cursor-based pagination
    ///
    /// Uses KEYSET pagination for efficient large dataset handling.
    /// Returns (issues, has_more) where has_more indicates if there are more results.
    pub async fn list_paginated(
        pool: &PgPool,
        project_id: i32,
        sort: IssueSort,
        order: SortOrder,
        include_resolved: bool,
        cursor: Option<&IssueCursor>,
        limit: i64,
    ) -> AppResult<(Vec<Issue>, bool)> {
        // Fetch limit+1 to determine if there are more results
        let fetch_limit = limit + 1;

        let issues = match (sort, order, cursor) {
            // digest_order DESC (default) - no cursor
            (IssueSort::DigestOrder, SortOrder::Desc, None) => {
                if include_resolved {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted
                        ORDER BY digest_order DESC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .fetch_all(pool)
                    .await?
                } else {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted AND NOT is_resolved AND NOT is_muted
                        ORDER BY digest_order DESC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .fetch_all(pool)
                    .await?
                }
            }

            // digest_order DESC - with cursor
            (IssueSort::DigestOrder, SortOrder::Desc, Some(c)) => {
                let last_order = c.last_digest_order.unwrap_or(i32::MAX);
                if include_resolved {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted
                          AND digest_order < $3
                        ORDER BY digest_order DESC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .bind(last_order)
                    .fetch_all(pool)
                    .await?
                } else {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted AND NOT is_resolved AND NOT is_muted
                          AND digest_order < $3
                        ORDER BY digest_order DESC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .bind(last_order)
                    .fetch_all(pool)
                    .await?
                }
            }

            // digest_order ASC - no cursor
            (IssueSort::DigestOrder, SortOrder::Asc, None) => {
                if include_resolved {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted
                        ORDER BY digest_order ASC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .fetch_all(pool)
                    .await?
                } else {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted AND NOT is_resolved AND NOT is_muted
                        ORDER BY digest_order ASC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .fetch_all(pool)
                    .await?
                }
            }

            // digest_order ASC - with cursor
            (IssueSort::DigestOrder, SortOrder::Asc, Some(c)) => {
                let last_order = c.last_digest_order.unwrap_or(0);
                if include_resolved {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted
                          AND digest_order > $3
                        ORDER BY digest_order ASC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .bind(last_order)
                    .fetch_all(pool)
                    .await?
                } else {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted AND NOT is_resolved AND NOT is_muted
                          AND digest_order > $3
                        ORDER BY digest_order ASC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .bind(last_order)
                    .fetch_all(pool)
                    .await?
                }
            }

            // last_seen DESC - no cursor
            (IssueSort::LastSeen, SortOrder::Desc, None) => {
                if include_resolved {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted
                        ORDER BY last_seen DESC, id DESC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .fetch_all(pool)
                    .await?
                } else {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted AND NOT is_resolved AND NOT is_muted
                        ORDER BY last_seen DESC, id DESC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .fetch_all(pool)
                    .await?
                }
            }

            // last_seen DESC - with cursor
            (IssueSort::LastSeen, SortOrder::Desc, Some(c)) => {
                let last_seen = c.last_seen.unwrap_or_else(Utc::now);
                let last_id = c.last_id.unwrap_or(Uuid::nil());
                if include_resolved {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted
                          AND (last_seen, id) < ($3, $4)
                        ORDER BY last_seen DESC, id DESC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .bind(last_seen)
                    .bind(last_id)
                    .fetch_all(pool)
                    .await?
                } else {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted AND NOT is_resolved AND NOT is_muted
                          AND (last_seen, id) < ($3, $4)
                        ORDER BY last_seen DESC, id DESC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .bind(last_seen)
                    .bind(last_id)
                    .fetch_all(pool)
                    .await?
                }
            }

            // last_seen ASC - no cursor
            (IssueSort::LastSeen, SortOrder::Asc, None) => {
                if include_resolved {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted
                        ORDER BY last_seen ASC, id ASC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .fetch_all(pool)
                    .await?
                } else {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted AND NOT is_resolved AND NOT is_muted
                        ORDER BY last_seen ASC, id ASC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .fetch_all(pool)
                    .await?
                }
            }

            // last_seen ASC - with cursor
            (IssueSort::LastSeen, SortOrder::Asc, Some(c)) => {
                let last_seen = c.last_seen.unwrap_or(DateTime::UNIX_EPOCH);
                let last_id = c.last_id.unwrap_or(Uuid::nil());
                if include_resolved {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted
                          AND (last_seen, id) > ($3, $4)
                        ORDER BY last_seen ASC, id ASC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .bind(last_seen)
                    .bind(last_id)
                    .fetch_all(pool)
                    .await?
                } else {
                    sqlx::query_as::<_, Issue>(
                        r#"
                        SELECT * FROM issues
                        WHERE project_id = $1 AND NOT is_deleted AND NOT is_resolved AND NOT is_muted
                          AND (last_seen, id) > ($3, $4)
                        ORDER BY last_seen ASC, id ASC
                        LIMIT $2
                        "#,
                    )
                    .bind(project_id)
                    .bind(fetch_limit)
                    .bind(last_seen)
                    .bind(last_id)
                    .fetch_all(pool)
                    .await?
                }
            }
        };

        let has_more = issues.len() > limit as usize;
        let issues: Vec<Issue> = issues.into_iter().take(limit as usize).collect();

        Ok((issues, has_more))
    }

    /// Lists issues with offset-based pagination
    ///
    /// Returns (issues, total_count) where total_count is the total matching issues.
    pub async fn list_offset(
        pool: &PgPool,
        project_id: i32,
        sort: IssueSort,
        order: SortOrder,
        filter: IssueFilter,
        page: i64,
        per_page: i64,
    ) -> AppResult<(Vec<Issue>, i64)> {
        let offset = (page - 1) * per_page;

        // Build WHERE clause based on filter
        let where_clause = match filter {
            IssueFilter::Open => {
                "project_id = $1 AND NOT is_deleted AND NOT is_resolved AND NOT is_muted"
            }
            IssueFilter::Resolved => "project_id = $1 AND NOT is_deleted AND is_resolved",
            IssueFilter::Muted => {
                "project_id = $1 AND NOT is_deleted AND is_muted AND NOT is_resolved"
            }
            IssueFilter::All => "project_id = $1 AND NOT is_deleted",
        };

        // Build ORDER BY clause
        let order_clause = match (sort, order) {
            (IssueSort::DigestOrder, SortOrder::Desc) => "digest_order DESC",
            (IssueSort::DigestOrder, SortOrder::Asc) => "digest_order ASC",
            (IssueSort::LastSeen, SortOrder::Desc) => "last_seen DESC, id DESC",
            (IssueSort::LastSeen, SortOrder::Asc) => "last_seen ASC, id ASC",
        };

        // Get total count
        let count_query = format!("SELECT COUNT(*) FROM issues WHERE {}", where_clause);
        let total_count: (i64,) = sqlx::query_as(&count_query)
            .bind(project_id)
            .fetch_one(pool)
            .await?;

        // Get paginated results
        let select_query = format!(
            "SELECT * FROM issues WHERE {} ORDER BY {} LIMIT $2 OFFSET $3",
            where_clause, order_clause
        );
        let issues = sqlx::query_as::<_, Issue>(&select_query)
            .bind(project_id)
            .bind(per_page)
            .bind(offset)
            .fetch_all(pool)
            .await?;

        Ok((issues, total_count.0))
    }

    /// Gets an issue by ID
    pub async fn get_by_id(pool: &PgPool, id: Uuid) -> AppResult<Issue> {
        let issue =
            sqlx::query_as::<_, Issue>("SELECT * FROM issues WHERE id = $1 AND NOT is_deleted")
                .bind(id)
                .fetch_optional(pool)
                .await?
                .ok_or_else(|| AppError::NotFound(format!("Issue {} not found", id)))?;

        Ok(issue)
    }

    /// Creates a new issue
    pub async fn create(
        pool: &PgPool,
        project_id: i32,
        timestamp: DateTime<Utc>,
        denormalized: &DenormalizedFields,
        level: Option<&str>,
        platform: Option<&str>,
    ) -> AppResult<Issue> {
        // Get the next digest_order for this project
        let max_order: Option<i32> =
            sqlx::query_scalar("SELECT MAX(digest_order) FROM issues WHERE project_id = $1")
                .bind(project_id)
                .fetch_one(pool)
                .await?;

        let digest_order = max_order.unwrap_or(0) + 1;

        let issue = sqlx::query_as::<_, Issue>(
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
        .fetch_one(pool)
        .await?;

        Ok(issue)
    }

    /// Updates an existing issue for a new event
    pub async fn update_for_new_event(
        pool: &PgPool,
        issue_id: Uuid,
        timestamp: DateTime<Utc>,
    ) -> AppResult<Issue> {
        let issue = sqlx::query_as::<_, Issue>(
            r#"
            UPDATE issues
            SET last_seen = $2,
                digested_event_count = digested_event_count + 1,
                stored_event_count = stored_event_count + 1
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(issue_id)
        .bind(timestamp)
        .fetch_one(pool)
        .await?;

        Ok(issue)
    }

    /// Marks an issue as resolved
    pub async fn resolve(pool: &PgPool, id: Uuid) -> AppResult<Issue> {
        let issue = sqlx::query_as::<_, Issue>(
            r#"
            UPDATE issues
            SET is_resolved = TRUE, is_muted = FALSE
            WHERE id = $1 AND NOT is_deleted
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|_| AppError::NotFound(format!("Issue {} not found", id)))?;

        Ok(issue)
    }

    /// Reopens an issue
    pub async fn unresolve(pool: &PgPool, id: Uuid) -> AppResult<Issue> {
        let issue = sqlx::query_as::<_, Issue>(
            r#"
            UPDATE issues
            SET is_resolved = FALSE
            WHERE id = $1 AND NOT is_deleted
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|_| AppError::NotFound(format!("Issue {} not found", id)))?;

        Ok(issue)
    }

    /// Mutes an issue
    pub async fn mute(pool: &PgPool, id: Uuid) -> AppResult<Issue> {
        let issue = sqlx::query_as::<_, Issue>(
            r#"
            UPDATE issues
            SET is_muted = TRUE
            WHERE id = $1 AND NOT is_deleted AND NOT is_resolved
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|_| AppError::NotFound(format!("Issue {} not found or already resolved", id)))?;

        Ok(issue)
    }

    /// Unmutes an issue
    pub async fn unmute(pool: &PgPool, id: Uuid) -> AppResult<Issue> {
        let issue = sqlx::query_as::<_, Issue>(
            r#"
            UPDATE issues
            SET is_muted = FALSE
            WHERE id = $1 AND NOT is_deleted
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|_| AppError::NotFound(format!("Issue {} not found", id)))?;

        Ok(issue)
    }

    /// Deletes an issue (soft delete)
    pub async fn delete(pool: &PgPool, id: Uuid) -> AppResult<()> {
        let result = sqlx::query("UPDATE issues SET is_deleted = TRUE WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(format!("Issue {} not found", id)));
        }

        Ok(())
    }
}
