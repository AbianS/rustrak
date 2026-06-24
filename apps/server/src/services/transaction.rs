use chrono::DateTime;
use sqlx::Row;
use uuid::Uuid;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use std::collections::HashMap;

use crate::models::{
    SpanResponse, TransactionDetailResponse, TransactionResponse, TransactionStatsResponse,
};

pub struct TransactionService;

/// Optional equality filters for the transaction list. A `None` field matches
/// every row; a `Some` value restricts to exact matches on the denormalized
/// column. Mirrors the op/status/environment/release facets Sentry exposes.
#[derive(Debug, Default, Clone)]
pub struct TransactionFilters {
    /// Exact transaction_name match — used to list one group's samples.
    pub name: Option<String>,
    pub op: Option<String>,
    pub status: Option<String>,
    pub environment: Option<String>,
    pub release: Option<String>,
}

impl TransactionService {
    /// Lists transactions for a project with offset-based pagination (newest first),
    /// optionally filtered by op/status/environment/release.
    ///
    /// Each filter uses a `($n IS NULL OR col = $m)` guard so a `None` is a no-op
    /// — static SQL, positional binds, no parameter reuse (dialect-safe across
    /// Postgres and SQLite). Ordered by ingested_at DESC. Returns (rows, total).
    pub async fn list_offset(
        pool: &DbPool,
        project_id: i32,
        page: i64,
        per_page: i64,
        filters: &TransactionFilters,
    ) -> AppResult<(Vec<TransactionResponse>, i64)> {
        let per_page = per_page.clamp(1, 100);
        let offset = (page - 1) * per_page;

        let total_count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM transactions
            WHERE project_id = $1
              AND ($2 IS NULL OR transaction_name = $3)
              AND ($4 IS NULL OR op = $5)
              AND ($6 IS NULL OR status = $7)
              AND ($8 IS NULL OR environment = $9)
              AND ($10 IS NULL OR release = $11)
            "#,
        )
        .bind(project_id)
        .bind(filters.name.as_deref())
        .bind(filters.name.as_deref())
        .bind(filters.op.as_deref())
        .bind(filters.op.as_deref())
        .bind(filters.status.as_deref())
        .bind(filters.status.as_deref())
        .bind(filters.environment.as_deref())
        .bind(filters.environment.as_deref())
        .bind(filters.release.as_deref())
        .bind(filters.release.as_deref())
        .fetch_one(pool)
        .await?;

        let rows = sqlx::query(
            r#"
            SELECT id, event_id, transaction_name,
                   timestamp, start_timestamp, duration_ms,
                   platform, environment, release, ingested_at
            FROM transactions
            WHERE project_id = $1
              AND ($2 IS NULL OR transaction_name = $3)
              AND ($4 IS NULL OR op = $5)
              AND ($6 IS NULL OR status = $7)
              AND ($8 IS NULL OR environment = $9)
              AND ($10 IS NULL OR release = $11)
            ORDER BY ingested_at DESC, id DESC
            LIMIT $12 OFFSET $13
            "#,
        )
        .bind(project_id)
        .bind(filters.name.as_deref())
        .bind(filters.name.as_deref())
        .bind(filters.op.as_deref())
        .bind(filters.op.as_deref())
        .bind(filters.status.as_deref())
        .bind(filters.status.as_deref())
        .bind(filters.environment.as_deref())
        .bind(filters.environment.as_deref())
        .bind(filters.release.as_deref())
        .bind(filters.release.as_deref())
        .bind(per_page)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let transactions: Vec<TransactionResponse> = rows
            .iter()
            .map(|row| {
                let timestamp: DateTime<chrono::Utc> = row.get("timestamp");
                let start_timestamp: Option<DateTime<chrono::Utc>> = row.get("start_timestamp");
                TransactionResponse {
                    id: row.get("id"),
                    event_id: row.get("event_id"),
                    transaction_name: row.get("transaction_name"),
                    timestamp,
                    start_timestamp,
                    duration_ms: row.get("duration_ms"),
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
            SELECT id, event_id, transaction_name,
                   timestamp, start_timestamp, duration_ms,
                   platform, environment, release, ingested_at, data
            FROM transactions
            WHERE id = $1
              AND project_id = $2
            "#,
        )
        .bind(id)
        .bind(project_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Transaction {} not found", id)))?;

        let timestamp: DateTime<chrono::Utc> = row.get("timestamp");
        let start_timestamp: Option<DateTime<chrono::Utc>> = row.get("start_timestamp");

        Ok(TransactionDetailResponse {
            id: row.get("id"),
            event_id: row.get("event_id"),
            transaction_name: row.get("transaction_name"),
            timestamp,
            start_timestamp,
            duration_ms: row.get("duration_ms"),
            platform: row.get("platform"),
            environment: row.get("environment"),
            release: row.get("release"),
            ingested_at: row.get("ingested_at"),
            data: row.get("data"),
        })
    }

    /// Lists the indexed spans extracted from a transaction, ordered by
    /// start_timestamp (waterfall order). Scoped to the project so a foreign
    /// transaction id yields an empty list rather than leaking spans.
    pub async fn list_spans(
        pool: &DbPool,
        project_id: i32,
        transaction_id: Uuid,
    ) -> AppResult<Vec<SpanResponse>> {
        let rows = sqlx::query(
            r#"
            SELECT id, span_id, trace_id, parent_span_id,
                   op, description, status,
                   start_timestamp, timestamp, duration_ms, exclusive_time_ms,
                   is_segment, segment_id
            FROM spans
            WHERE transaction_id = $1
              AND project_id = $2
            ORDER BY start_timestamp ASC, id ASC
            "#,
        )
        .bind(transaction_id)
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        let spans = rows
            .iter()
            .map(|row| SpanResponse {
                id: row.get("id"),
                span_id: row.get("span_id"),
                trace_id: row.get("trace_id"),
                parent_span_id: row.get("parent_span_id"),
                op: row.get("op"),
                description: row.get("description"),
                status: row.get("status"),
                start_timestamp: row.get("start_timestamp"),
                timestamp: row.get("timestamp"),
                duration_ms: row.get("duration_ms"),
                exclusive_time_ms: row.get("exclusive_time_ms"),
                is_segment: row.get("is_segment"),
                segment_id: row.get("segment_id"),
            })
            .collect();

        Ok(spans)
    }

    /// Aggregate latency/throughput/failure stats per (transaction_name, op).
    ///
    /// Percentiles are computed in Rust (continuous, linear-interpolated —
    /// matching Postgres `percentile_cont`) so the same code path works on both
    /// Postgres and SQLite, which lacks `percentile_cont`. Groups are returned
    /// most-frequent first, ready for the performance overview table.
    pub async fn stats(
        pool: &DbPool,
        project_id: i32,
        page: i64,
        per_page: i64,
    ) -> AppResult<(Vec<TransactionStatsResponse>, i64)> {
        let rows = sqlx::query(
            r#"
            SELECT transaction_name, op, duration_ms, status
            FROM transactions
            WHERE project_id = $1
              AND duration_ms IS NOT NULL
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        // Accumulate durations + failure counts per (name, op) group.
        struct Acc {
            durations: Vec<f64>,
            failures: i64,
        }
        let mut groups: HashMap<(String, Option<String>), Acc> = HashMap::new();

        for row in &rows {
            let name: String = row.get("transaction_name");
            let op: Option<String> = row.get("op");
            let duration_ms: f64 = row.get("duration_ms");
            let status: Option<String> = row.get("status");

            let acc = groups.entry((name, op)).or_insert_with(|| Acc {
                durations: Vec::new(),
                failures: 0,
            });
            acc.durations.push(duration_ms);
            // A transaction "failed" when it carries a status other than "ok".
            if status.as_deref().is_some_and(|s| s != "ok") {
                acc.failures += 1;
            }
        }

        let mut stats: Vec<TransactionStatsResponse> = groups
            .into_iter()
            .map(|((transaction_name, op), mut acc)| {
                acc.durations
                    .sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                let count = acc.durations.len() as i64;
                TransactionStatsResponse {
                    transaction_name,
                    op,
                    count,
                    p50_ms: percentile_cont(&acc.durations, 0.50),
                    p95_ms: percentile_cont(&acc.durations, 0.95),
                    p99_ms: percentile_cont(&acc.durations, 0.99),
                    failure_rate: if count > 0 {
                        acc.failures as f64 / count as f64
                    } else {
                        0.0
                    },
                }
            })
            .collect();

        // Most frequent transactions first; tie-break by name for a stable
        // order across pages.
        stats.sort_by(|a, b| {
            b.count
                .cmp(&a.count)
                .then_with(|| a.transaction_name.cmp(&b.transaction_name))
        });

        // Paginate the grouped result (the aggregation itself scans all rows —
        // a known cost; pagination here bounds the payload, not the scan).
        let total = stats.len() as i64;
        let per_page = per_page.clamp(1, 100);
        let offset = ((page.max(1) - 1) * per_page).max(0) as usize;
        let page_items = stats
            .into_iter()
            .skip(offset)
            .take(per_page as usize)
            .collect();

        Ok((page_items, total))
    }
}

/// Continuous percentile over a pre-sorted slice (linear interpolation between
/// closest ranks), matching Postgres `percentile_cont`. `p` is in [0.0, 1.0].
fn percentile_cont(sorted: &[f64], p: f64) -> f64 {
    match sorted.len() {
        0 => 0.0,
        1 => sorted[0],
        n => {
            let rank = p * (n - 1) as f64;
            let lo = rank.floor() as usize;
            let hi = rank.ceil() as usize;
            if lo == hi {
                sorted[lo]
            } else {
                let frac = rank - lo as f64;
                sorted[lo] + (sorted[hi] - sorted[lo]) * frac
            }
        }
    }
}
