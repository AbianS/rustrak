use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{Grouping, Issue};
use crate::pagination::{IssueCursor, IssueFilter, IssueSort, SortOrder};
use crate::services::grouping::DenormalizedFields;
use serde::Serialize;
use std::collections::HashMap;

/// A tag value with its event count within an issue.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct TagValueCount {
    pub value: String,
    pub count: i64,
}

/// A tag key with its most common values within an issue.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct TagSummary {
    pub key: String,
    pub total_values: usize,
    pub top_values: Vec<TagValueCount>,
}

/// Per-issue aggregates computed from recent events (capped scan).
#[derive(Debug, Serialize, Default)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct IssueAggregates {
    pub user_count: i64,
    pub tags: Vec<TagSummary>,
}

/// Max events scanned when computing per-issue aggregates (tags, user count).
const AGGREGATE_SCAN_CAP: i64 = 1000;

pub struct IssueService;

/// Derives an initial issue priority from the event level, mirroring Sentry's
/// default priority assignment (high for errors/fatal, medium for warnings,
/// low otherwise).
pub(crate) fn derive_priority(level: Option<&str>) -> &'static str {
    match level {
        Some("fatal") | Some("error") | None => "high",
        Some("warning") => "medium",
        _ => "low",
    }
}

/// Extracts (key, value) tag pairs from an event payload. Handles both the
/// object form (`tags: {k: v}`) and the normalized array form
/// (`tags: [[k, v]]` or `tags: [{"key": k, "value": v}]`).
fn extract_tags(data: &serde_json::Value) -> Vec<(String, String)> {
    let Some(tags) = data.get("tags") else {
        return Vec::new();
    };
    let mut out = Vec::new();
    match tags {
        serde_json::Value::Object(map) => {
            for (k, v) in map {
                if let Some(s) = value_to_tag_string(v) {
                    out.push((k.clone(), s));
                }
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                if let Some(arr) = item.as_array() {
                    if arr.len() == 2 {
                        if let (Some(k), Some(v)) =
                            (arr[0].as_str(), value_to_tag_string(&arr[1]))
                        {
                            out.push((k.to_string(), v));
                        }
                    }
                } else if let Some(obj) = item.as_object() {
                    if let (Some(k), Some(v)) = (
                        obj.get("key").and_then(|k| k.as_str()),
                        obj.get("value").and_then(value_to_tag_string_opt),
                    ) {
                        out.push((k.to_string(), v));
                    }
                }
            }
        }
        _ => {}
    }
    out
}

fn value_to_tag_string(v: &serde_json::Value) -> Option<String> {
    match v {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn value_to_tag_string_opt(v: &serde_json::Value) -> Option<String> {
    value_to_tag_string(v)
}

/// Extracts a stable user identity (id, else email, else ip_address) for unique
/// user counting.
fn extract_user_identity(data: &serde_json::Value) -> Option<String> {
    let user = data.get("user")?;
    for field in ["id", "email", "username", "ip_address"] {
        if let Some(s) = user.get(field).and_then(|v| v.as_str()) {
            if !s.is_empty() {
                return Some(format!("{}:{}", field, s));
            }
        }
    }
    None
}

/// Sorts a value->count map into descending-count order (ties broken by value).
fn sort_counts(counts: HashMap<String, i64>) -> Vec<TagValueCount> {
    let mut v: Vec<TagValueCount> = counts
        .into_iter()
        .map(|(value, count)| TagValueCount { value, count })
        .collect();
    v.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.value.cmp(&b.value)));
    v
}

impl IssueService {
    /// Lists issues with cursor-based pagination
    ///
    /// Uses KEYSET pagination for efficient large dataset handling.
    /// Returns (issues, has_more) where has_more indicates if there are more results.
    pub async fn list_paginated(
        pool: &DbPool,
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
                        WHERE project_id = $1
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
                        WHERE project_id = $1 AND status = 'unresolved'
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
                        WHERE project_id = $1
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
                        WHERE project_id = $1 AND status = 'unresolved'
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
                        WHERE project_id = $1
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
                        WHERE project_id = $1 AND status = 'unresolved'
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
                        WHERE project_id = $1
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
                        WHERE project_id = $1 AND status = 'unresolved'
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
                        WHERE project_id = $1
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
                        WHERE project_id = $1 AND status = 'unresolved'
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
                        WHERE project_id = $1
                          AND (last_seen < $3 OR (last_seen = $3 AND id < $4))
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
                        WHERE project_id = $1 AND status = 'unresolved'
                          AND (last_seen < $3 OR (last_seen = $3 AND id < $4))
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
                        WHERE project_id = $1
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
                        WHERE project_id = $1 AND status = 'unresolved'
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
                        WHERE project_id = $1
                          AND (last_seen > $3 OR (last_seen = $3 AND id > $4))
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
                        WHERE project_id = $1 AND status = 'unresolved'
                          AND (last_seen > $3 OR (last_seen = $3 AND id > $4))
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
    #[allow(clippy::too_many_arguments)]
    pub async fn list_offset(
        pool: &DbPool,
        project_id: i32,
        sort: IssueSort,
        order: SortOrder,
        filter: IssueFilter,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> AppResult<(Vec<Issue>, i64)> {
        let offset = (page - 1) * per_page;

        // Build WHERE clause based on filter
        let status_clause = match filter {
            IssueFilter::Open => "project_id = $1 AND status = 'unresolved'",
            IssueFilter::Resolved => "project_id = $1 AND status = 'resolved'",
            IssueFilter::Muted => "project_id = $1 AND status = 'ignored'",
            IssueFilter::All => "project_id = $1",
        };

        // Build ORDER BY clause
        let order_clause = match (sort, order) {
            (IssueSort::DigestOrder, SortOrder::Desc) => "digest_order DESC",
            (IssueSort::DigestOrder, SortOrder::Asc) => "digest_order ASC",
            (IssueSort::LastSeen, SortOrder::Desc) => "last_seen DESC, id DESC",
            (IssueSort::LastSeen, SortOrder::Asc) => "last_seen ASC, id ASC",
        };

        // Normalize the search term into a case-insensitive LIKE pattern (works
        // on both Postgres and SQLite, unlike Postgres-only ILIKE).
        let pattern = search
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| format!("%{}%", s.to_lowercase()));

        if let Some(pattern) = pattern {
            // $2 = search pattern, applied to both count and select.
            let search_clause = r#"AND (
                LOWER(calculated_type) LIKE $2
                OR LOWER(calculated_value) LIKE $2
                OR LOWER("transaction") LIKE $2
                OR LOWER(culprit) LIKE $2
            )"#;
            let count_query = format!(
                "SELECT COUNT(*) FROM issues WHERE {} {}",
                status_clause, search_clause
            );
            let total_count: (i64,) = sqlx::query_as(sqlx::AssertSqlSafe(&*count_query))
                .bind(project_id)
                .bind(&pattern)
                .fetch_one(pool)
                .await?;

            let select_query = format!(
                "SELECT * FROM issues WHERE {} {} ORDER BY {} LIMIT $3 OFFSET $4",
                status_clause, search_clause, order_clause
            );
            let issues = sqlx::query_as::<_, Issue>(sqlx::AssertSqlSafe(&*select_query))
                .bind(project_id)
                .bind(&pattern)
                .bind(per_page)
                .bind(offset)
                .fetch_all(pool)
                .await?;

            return Ok((issues, total_count.0));
        }

        // Get total count
        let count_query = format!("SELECT COUNT(*) FROM issues WHERE {}", status_clause);
        let total_count: (i64,) = sqlx::query_as(sqlx::AssertSqlSafe(&*count_query))
            .bind(project_id)
            .fetch_one(pool)
            .await?;

        // Get paginated results
        let select_query = format!(
            "SELECT * FROM issues WHERE {} ORDER BY {} LIMIT $2 OFFSET $3",
            status_clause, order_clause
        );
        let issues = sqlx::query_as::<_, Issue>(sqlx::AssertSqlSafe(&*select_query))
            .bind(project_id)
            .bind(per_page)
            .bind(offset)
            .fetch_all(pool)
            .await?;

        Ok((issues, total_count.0))
    }

    /// Gets an issue by ID
    pub async fn get_by_id(pool: &DbPool, id: Uuid) -> AppResult<Issue> {
        let issue = sqlx::query_as::<_, Issue>("SELECT * FROM issues WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Issue {} not found", id)))?;

        Ok(issue)
    }

    /// Creates a new issue
    pub async fn create(
        pool: &DbPool,
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

        // Generate UUID in application for cross-DB compatibility
        let issue_id = Uuid::new_v4();

        let priority = derive_priority(level);

        let issue = sqlx::query_as::<_, Issue>(
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
        .fetch_one(pool)
        .await?;

        Ok(issue)
    }

    /// Updates an existing issue for a new event
    pub async fn update_for_new_event(
        pool: &DbPool,
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

    /// Sets an issue's status (and its matching default substatus).
    ///
    /// Accepted statuses: `unresolved`, `resolved`, `ignored`.
    pub async fn set_status(pool: &DbPool, id: Uuid, status: &str) -> AppResult<Issue> {
        let substatus: Option<&str> = match status {
            crate::models::STATUS_UNRESOLVED => Some("ongoing"),
            crate::models::STATUS_RESOLVED => None,
            crate::models::STATUS_IGNORED => Some("archived_forever"),
            other => {
                return Err(AppError::Validation(format!("Invalid status: {}", other)));
            }
        };

        let issue = sqlx::query_as::<_, Issue>(
            r#"
            UPDATE issues
            SET status = $2, substatus = $3
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(status)
        .bind(substatus)
        .fetch_one(pool)
        .await
        .map_err(|_| AppError::NotFound(format!("Issue {} not found", id)))?;

        Ok(issue)
    }

    /// Marks an issue as resolved
    pub async fn resolve(pool: &DbPool, id: Uuid) -> AppResult<Issue> {
        Self::set_status(pool, id, crate::models::STATUS_RESOLVED).await
    }

    /// Reopens an issue
    pub async fn unresolve(pool: &DbPool, id: Uuid) -> AppResult<Issue> {
        Self::set_status(pool, id, crate::models::STATUS_UNRESOLVED).await
    }

    /// Mutes (ignores) an issue
    pub async fn mute(pool: &DbPool, id: Uuid) -> AppResult<Issue> {
        Self::set_status(pool, id, crate::models::STATUS_IGNORED).await
    }

    /// Unmutes an issue (back to unresolved)
    pub async fn unmute(pool: &DbPool, id: Uuid) -> AppResult<Issue> {
        Self::set_status(pool, id, crate::models::STATUS_UNRESOLVED).await
    }

    /// Resolves an issue "in the next release": it is marked resolved now, but
    /// a regression is suppressed for further events from the current release.
    /// A subsequent deploy (see [`finalize_release`]) clears the marker.
    pub async fn resolve_in_next_release(pool: &DbPool, id: Uuid) -> AppResult<Issue> {
        sqlx::query_as::<_, Issue>(
            r#"
            UPDATE issues
            SET status = 'resolved', substatus = NULL, status_details = '{"in_next_release":true}'
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|_| AppError::NotFound(format!("Issue {} not found", id)))
    }

    /// Records a deploy of `version` for a project: clears the
    /// "resolved in next release" marker on issues whose last_release differs
    /// from the new version (the awaited release has now shipped). Returns the
    /// number of issues finalized.
    pub async fn finalize_release(
        pool: &DbPool,
        project_id: i32,
        version: &str,
    ) -> AppResult<u64> {
        let res = sqlx::query(
            r#"
            UPDATE issues
            SET status_details = '{}'
            WHERE project_id = $1
              AND status = 'resolved'
              AND status_details LIKE '%"in_next_release":true%'
              AND last_release <> $2
            "#,
        )
        .bind(project_id)
        .bind(version)
        .execute(pool)
        .await?;
        Ok(res.rows_affected())
    }

    /// Sets an issue's priority (low/medium/high).
    pub async fn set_priority(pool: &DbPool, id: Uuid, priority: &str) -> AppResult<Issue> {
        if !matches!(priority, "low" | "medium" | "high") {
            return Err(AppError::Validation(format!(
                "Invalid priority: {}",
                priority
            )));
        }
        sqlx::query_as::<_, Issue>(
            "UPDATE issues SET priority = $2, priority_locked_at = $3 WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(priority)
        .bind(Utc::now())
        .fetch_one(pool)
        .await
        .map_err(|_| AppError::NotFound(format!("Issue {} not found", id)))
    }

    /// Assigns an issue to a user (or clears the assignment when `None`).
    pub async fn assign(
        pool: &DbPool,
        id: Uuid,
        assigned_to: Option<i32>,
        assignee_type: Option<&str>,
    ) -> AppResult<Issue> {
        sqlx::query_as::<_, Issue>(
            "UPDATE issues SET assigned_to = $2, assignee_type = $3 WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(assigned_to)
        .bind(assignee_type)
        .fetch_one(pool)
        .await
        .map_err(|_| AppError::NotFound(format!("Issue {} not found", id)))
    }

    /// Lists the grouping hashes that map to an issue.
    pub async fn list_hashes(pool: &DbPool, issue_id: Uuid) -> AppResult<Vec<Grouping>> {
        let hashes = sqlx::query_as::<_, Grouping>(
            "SELECT * FROM groupings WHERE issue_id = $1 ORDER BY id ASC",
        )
        .bind(issue_id)
        .fetch_all(pool)
        .await?;
        Ok(hashes)
    }

    /// Bulk-sets the status of multiple issues in one project.
    /// Returns the number of issues updated.
    pub async fn bulk_set_status(
        pool: &DbPool,
        project_id: i32,
        ids: &[Uuid],
        status: &str,
    ) -> AppResult<u64> {
        let substatus: Option<&str> = match status {
            crate::models::STATUS_UNRESOLVED => Some("ongoing"),
            crate::models::STATUS_RESOLVED => None,
            crate::models::STATUS_IGNORED => Some("archived_forever"),
            other => return Err(AppError::Validation(format!("Invalid status: {}", other))),
        };

        let mut tx = pool.begin().await?;
        let mut updated = 0u64;
        for id in ids {
            let res = sqlx::query(
                "UPDATE issues SET status = $2, substatus = $3 WHERE id = $1 AND project_id = $4",
            )
            .bind(id)
            .bind(status)
            .bind(substatus)
            .bind(project_id)
            .execute(&mut *tx)
            .await?;
            updated += res.rows_affected();
        }
        tx.commit().await?;
        Ok(updated)
    }

    /// Bulk-deletes multiple issues in one project. Returns the number deleted.
    pub async fn bulk_delete(pool: &DbPool, project_id: i32, ids: &[Uuid]) -> AppResult<u64> {
        let mut deleted = 0u64;
        for id in ids {
            // Reuse the single-issue delete so project counters stay consistent.
            // Skip rows belonging to other projects.
            let belongs: Option<(i32,)> =
                sqlx::query_as("SELECT project_id FROM issues WHERE id = $1")
                    .bind(id)
                    .fetch_optional(pool)
                    .await?;
            if belongs.map(|(p,)| p) != Some(project_id) {
                continue;
            }
            Self::delete(pool, *id).await?;
            deleted += 1;
        }
        Ok(deleted)
    }

    /// Aggregates the distinct values (with counts) for a single tag key across
    /// an issue's recent events. Dialect-safe: scans event JSON in Rust.
    pub async fn tag_values(
        pool: &DbPool,
        issue_id: Uuid,
        key: &str,
    ) -> AppResult<Vec<TagValueCount>> {
        let rows: Vec<(serde_json::Value,)> = sqlx::query_as(
            "SELECT data FROM events WHERE issue_id = $1 ORDER BY digested_at DESC LIMIT $2",
        )
        .bind(issue_id)
        .bind(AGGREGATE_SCAN_CAP)
        .fetch_all(pool)
        .await?;

        let mut counts: HashMap<String, i64> = HashMap::new();
        for (data,) in &rows {
            for (k, v) in extract_tags(data) {
                if k == key {
                    *counts.entry(v).or_insert(0) += 1;
                }
            }
        }
        Ok(sort_counts(counts))
    }

    /// Computes per-issue aggregates (unique user count + top tags) from a
    /// capped scan of recent events. Dialect-safe.
    pub async fn aggregates(pool: &DbPool, issue_id: Uuid) -> AppResult<IssueAggregates> {
        let rows: Vec<(serde_json::Value,)> = sqlx::query_as(
            "SELECT data FROM events WHERE issue_id = $1 ORDER BY digested_at DESC LIMIT $2",
        )
        .bind(issue_id)
        .bind(AGGREGATE_SCAN_CAP)
        .fetch_all(pool)
        .await?;

        let mut tag_counts: HashMap<String, HashMap<String, i64>> = HashMap::new();
        let mut users: std::collections::HashSet<String> = std::collections::HashSet::new();

        for (data,) in &rows {
            for (k, v) in extract_tags(data) {
                *tag_counts.entry(k).or_default().entry(v).or_insert(0) += 1;
            }
            if let Some(id) = extract_user_identity(data) {
                users.insert(id);
            }
        }

        let mut tags: Vec<TagSummary> = tag_counts
            .into_iter()
            .map(|(key, values)| {
                let total_values = values.len();
                let mut top_values = sort_counts(values);
                top_values.truncate(10);
                TagSummary {
                    key,
                    total_values,
                    top_values,
                }
            })
            .collect();
        tags.sort_by(|a, b| a.key.cmp(&b.key));

        Ok(IssueAggregates {
            user_count: users.len() as i64,
            tags,
        })
    }

    /// Computes a zero-filled event-count timeseries for an issue.
    ///
    /// Returns `buckets` points of `(bucket_start_unix, count)` covering
    /// `[now - bucket_secs*buckets, now]`. Bucketed in Rust for dialect safety.
    pub async fn stats(
        pool: &DbPool,
        issue_id: Uuid,
        bucket_secs: i64,
        buckets: i64,
    ) -> AppResult<Vec<(i64, i64)>> {
        let now = Utc::now().timestamp();
        let start = now - bucket_secs * buckets;

        // Bucket entirely in Rust (dialect-safe). Binding a DateTime into a
        // WHERE comparison is unreliable across SQLite's TEXT timestamps, so we
        // fetch recent events ordered by ingested_at and filter the window here.
        let rows: Vec<(DateTime<Utc>,)> = sqlx::query_as(
            "SELECT ingested_at FROM events WHERE issue_id = $1 ORDER BY ingested_at DESC LIMIT $2",
        )
        .bind(issue_id)
        .bind(AGGREGATE_SCAN_CAP)
        .fetch_all(pool)
        .await?;

        let mut series: Vec<(i64, i64)> = (0..buckets)
            .map(|i| (start + i * bucket_secs, 0))
            .collect();

        for (ts,) in rows {
            let raw = (ts.timestamp() - start) / bucket_secs;
            if raw < 0 {
                continue; // before the window
            }
            // Fold the exclusive upper edge (ts == now) into the last bucket.
            let idx = (raw as usize).min(series.len() - 1);
            series[idx].1 += 1;
        }
        Ok(series)
    }

    /// Hard-deletes an issue and all associated events and groupings (via CASCADE)
    pub async fn delete(pool: &DbPool, id: Uuid) -> AppResult<()> {
        #[cfg(feature = "postgres")]
        {
            let result = sqlx::query(
                "WITH deleted AS (
                    DELETE FROM issues WHERE id = $1
                    RETURNING project_id, stored_event_count, digested_event_count
                )
                UPDATE projects SET
                    stored_event_count    = GREATEST(0, projects.stored_event_count    - deleted.stored_event_count),
                    digested_event_count  = GREATEST(0, projects.digested_event_count  - deleted.digested_event_count)
                FROM deleted
                WHERE projects.id = deleted.project_id",
            )
            .bind(id)
            .execute(pool)
            .await?;

            if result.rows_affected() == 0 {
                return Err(AppError::NotFound(format!("Issue {} not found", id)));
            }
        }

        #[cfg(feature = "sqlite")]
        {
            let mut tx = pool.begin().await?;

            let row = sqlx::query_as::<_, (i32, i32, i32)>(
                "SELECT project_id, stored_event_count, digested_event_count FROM issues WHERE id = $1",
            )
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?;

            let (project_id, stored, digested) = match row {
                Some(r) => r,
                None => return Err(AppError::NotFound(format!("Issue {} not found", id))),
            };

            let delete_result = sqlx::query("DELETE FROM issues WHERE id = $1")
                .bind(id)
                .execute(&mut *tx)
                .await?;

            if delete_result.rows_affected() == 0 {
                return Err(AppError::NotFound(format!("Issue {} not found", id)));
            }

            sqlx::query(
                "UPDATE projects SET
                    stored_event_count    = MAX(0, stored_event_count    - $1),
                    digested_event_count  = MAX(0, digested_event_count  - $2)
                WHERE id = $3",
            )
            .bind(stored)
            .bind(digested)
            .bind(project_id)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;
        }

        Ok(())
    }
}
