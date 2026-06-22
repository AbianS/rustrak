use chrono::DateTime;
use sqlx::Row;
use uuid::Uuid;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{TransactionDetailResponse, TransactionResponse};

pub struct TransactionService;

impl TransactionService {
    /// Lists transactions for a project with offset-based pagination (newest first).
    ///
    /// Transactions are events with event_type = 'transaction'. They have no issue_id.
    /// Ordered by ingested_at DESC.
    /// Returns (transactions, total_count).
    pub async fn list_offset(
        pool: &DbPool,
        project_id: i32,
        page: i64,
        per_page: i64,
    ) -> AppResult<(Vec<TransactionResponse>, i64)> {
        let offset = (page - 1) * per_page;

        let total_count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM events
            WHERE project_id = $1
              AND event_type = 'transaction'
            "#,
        )
        .bind(project_id)
        .fetch_one(pool)
        .await?;

        let rows = sqlx::query(
            r#"
            SELECT id, event_id, "transaction" AS transaction_name,
                   timestamp, start_timestamp,
                   platform, environment, release, ingested_at
            FROM events
            WHERE project_id = $1
              AND event_type = 'transaction'
            ORDER BY ingested_at DESC, id DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(project_id)
        .bind(per_page)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let transactions: Vec<TransactionResponse> = rows
            .iter()
            .map(|row| {
                let timestamp: DateTime<chrono::Utc> = row.get("timestamp");
                let start_timestamp: Option<DateTime<chrono::Utc>> = row.get("start_timestamp");
                let duration_ms =
                    start_timestamp.map(|st| (timestamp - st).num_milliseconds().max(0) as f64);
                TransactionResponse {
                    id: row.get("id"),
                    event_id: row.get("event_id"),
                    transaction_name: row.get("transaction_name"),
                    timestamp,
                    start_timestamp,
                    duration_ms,
                    platform: row.get("platform"),
                    environment: row.get("environment"),
                    release: row.get("release"),
                    ingested_at: row.get("ingested_at"),
                }
            })
            .collect();

        Ok((transactions, total_count.0))
    }

    /// Fetches a single transaction by its primary key, scoped to a project.
    ///
    /// Returns the summary fields plus the full Sentry payload (`data`) so the
    /// frontend can render the span waterfall and metrics. Only rows with
    /// `event_type = 'transaction'` are returned — an error event id yields
    /// NotFound, keeping the transaction namespace isolated.
    pub async fn get_by_id(
        pool: &DbPool,
        project_id: i32,
        id: Uuid,
    ) -> AppResult<TransactionDetailResponse> {
        let row = sqlx::query(
            r#"
            SELECT id, event_id, "transaction" AS transaction_name,
                   timestamp, start_timestamp,
                   platform, environment, release, ingested_at, data
            FROM events
            WHERE id = $1
              AND project_id = $2
              AND event_type = 'transaction'
            "#,
        )
        .bind(id)
        .bind(project_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Transaction {} not found", id)))?;

        let timestamp: DateTime<chrono::Utc> = row.get("timestamp");
        let start_timestamp: Option<DateTime<chrono::Utc>> = row.get("start_timestamp");
        let duration_ms =
            start_timestamp.map(|st| (timestamp - st).num_milliseconds().max(0) as f64);

        Ok(TransactionDetailResponse {
            id: row.get("id"),
            event_id: row.get("event_id"),
            transaction_name: row.get("transaction_name"),
            timestamp,
            start_timestamp,
            duration_ms,
            platform: row.get("platform"),
            environment: row.get("environment"),
            release: row.get("release"),
            ingested_at: row.get("ingested_at"),
            data: row.get("data"),
        })
    }
}
