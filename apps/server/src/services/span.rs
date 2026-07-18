use sqlx::Row;

use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::SpanResponse;

pub struct SpanService;

/// Optional equality filters for the span list. A `None` field matches every
/// row; a `Some` value restricts to exact matches on the denormalized column.
/// Matches spans regardless of origin (standalone or transaction-embedded) —
/// both share this table.
#[derive(Debug, Default, Clone)]
pub struct SpanFilters {
    pub op: Option<String>,
    pub status: Option<String>,
    pub trace_id: Option<String>,
}

impl SpanService {
    /// Lists spans for a project with offset-based pagination (newest by
    /// start_timestamp first), optionally filtered by op/status/trace_id.
    ///
    /// Each filter uses a `($n IS NULL OR col = $m)` guard so a `None` is a
    /// no-op — static SQL, positional binds (dialect-safe across Postgres and
    /// SQLite). Returns (rows, total).
    pub async fn list_offset(
        pool: &DbPool,
        project_id: i32,
        page: i64,
        per_page: i64,
        filters: &SpanFilters,
    ) -> AppResult<(Vec<SpanResponse>, i64)> {
        let page = page.max(1);
        let per_page = per_page.clamp(1, 100);
        let offset = (page - 1) * per_page;

        let total_count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM spans
            WHERE project_id = $1
              AND ($2 IS NULL OR op = $3)
              AND ($4 IS NULL OR status = $5)
              AND ($6 IS NULL OR trace_id = $7)
            "#,
        )
        .bind(project_id)
        .bind(filters.op.as_deref())
        .bind(filters.op.as_deref())
        .bind(filters.status.as_deref())
        .bind(filters.status.as_deref())
        .bind(filters.trace_id.as_deref())
        .bind(filters.trace_id.as_deref())
        .fetch_one(pool)
        .await?;

        let rows = sqlx::query(
            r#"
            SELECT id, transaction_id, span_id, trace_id, parent_span_id,
                   op, description, status,
                   start_timestamp, timestamp, duration_ms, exclusive_time_ms,
                   is_segment, segment_id, platform, release, environment
            FROM spans
            WHERE project_id = $1
              AND ($2 IS NULL OR op = $3)
              AND ($4 IS NULL OR status = $5)
              AND ($6 IS NULL OR trace_id = $7)
            ORDER BY start_timestamp DESC, id DESC
            LIMIT $8 OFFSET $9
            "#,
        )
        .bind(project_id)
        .bind(filters.op.as_deref())
        .bind(filters.op.as_deref())
        .bind(filters.status.as_deref())
        .bind(filters.status.as_deref())
        .bind(filters.trace_id.as_deref())
        .bind(filters.trace_id.as_deref())
        .bind(per_page)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let spans: Vec<SpanResponse> = rows
            .iter()
            .map(|row| SpanResponse {
                id: row.get("id"),
                transaction_id: row.get("transaction_id"),
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
                platform: row.get("platform"),
                release: row.get("release"),
                environment: row.get("environment"),
            })
            .collect();

        Ok((spans, total_count.0))
    }
}
