use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::Row;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{
    span_attributes, AgentDurationPoint, AgentModelRow, AgentSummary, AgentTimeseriesPoint,
    AgentToolRow, AgentTraceSummary, GenAiBreakdownRow, SpanDetailResponse, SpanResponse,
};
use crate::services::transaction::percentile_cont;

/// Maps a row selecting the denormalized span columns into the shared
/// response shape. The queries spell the column list out literally — sqlx 0.9
/// only accepts `&'static str`, so a shared constant cannot be interpolated
/// into one; this function is what keeps the list and detail paths in step.
fn span_from_row(row: &<crate::db::Db as sqlx::Database>::Row) -> SpanResponse {
    SpanResponse {
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
        gen_ai_operation_type: row.get("gen_ai_operation_type"),
        gen_ai_agent_name: row.get("gen_ai_agent_name"),
        gen_ai_request_model: row.get("gen_ai_request_model"),
        gen_ai_response_model: row.get("gen_ai_response_model"),
        gen_ai_tool_name: row.get("gen_ai_tool_name"),
        gen_ai_conversation_id: row.get("gen_ai_conversation_id"),
        gen_ai_usage_input_tokens: row.get("gen_ai_usage_input_tokens"),
        gen_ai_usage_output_tokens: row.get("gen_ai_usage_output_tokens"),
        gen_ai_usage_total_tokens: row.get("gen_ai_usage_total_tokens"),
    }
}

/// The scope every agents-dashboard aggregate is read through.
///
/// `environment` is bound as one parameter used twice — `($n IS NULL OR
/// environment = $n)` — so an absent filter is a no-op without branching the
/// SQL. Every producer stamps `environment` at write time, transaction
/// children and promoted agent roots included, so this matches whatever the
/// SDK reported rather than only standalone spans.
///
/// It does still only match spans that *carry* one: rows ingested before that
/// stamping landed have `NULL` and stay out of any filtered view. Showing
/// fewer rows is the right way to fail here — quietly folding unlabelled
/// spans into a "production only" view would make the number a lie.
#[derive(Debug, Default, Clone)]
pub struct AgentFilters {
    pub environment: Option<String>,
}

impl AgentFilters {
    /// The `AND` clause to splice into a WHERE.
    ///
    /// `index` is the positional parameter this filter's bind occupies, which
    /// differs per query — the breakdowns already spend `$2` on the operation
    /// type. Always emitted, even with no filter set, so the bind happens in
    /// every case and the numbering of later parameters never shifts.
    fn sql(&self, index: usize) -> String {
        format!("AND (${index} IS NULL OR environment = ${index})")
    }
}

pub struct SpanService;

/// Rows of `(group_label, duration_ms, status)` reduced into per-group
/// latency and failure counts.
///
/// Percentiles are computed here rather than in SQL because
/// `percentile_cont` is a Postgres-only aggregate; pulling durations and
/// reducing in Rust is what the transaction stats already do, and it keeps
/// one code path across both dialects.
fn reduce_latency_groups(
    rows: Vec<(String, Option<f64>, Option<String>)>,
) -> Vec<(String, i64, i64, f64, f64)> {
    let mut by_group: HashMap<String, (Vec<f64>, i64, i64)> = HashMap::new();

    for (label, duration, status) in rows {
        let entry = by_group.entry(label).or_insert_with(|| (Vec::new(), 0, 0));
        entry.1 += 1;
        if let Some(ms) = duration {
            entry.0.push(ms);
        }
        if status.is_some_and(|s| s != "ok") {
            entry.2 += 1;
        }
    }

    let mut out: Vec<(String, i64, i64, f64, f64)> = by_group
        .into_iter()
        .map(|(label, (mut durations, count, errors))| {
            durations.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let avg = if durations.is_empty() {
                0.0
            } else {
                durations.iter().sum::<f64>() / durations.len() as f64
            };
            (label, count, errors, avg, percentile_cont(&durations, 0.95))
        })
        .collect();

    // Busiest first — the same ordering every other breakdown on the page
    // uses, so a reader's eye lands in the same place on each table.
    out.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    out
}

/// Optional equality filters for the span list. A `None` field matches every
/// row; a `Some` value restricts to exact matches on the denormalized column.
/// Matches spans regardless of origin (standalone or transaction-embedded) —
/// both share this table.
#[derive(Debug, Default, Clone)]
pub struct SpanFilters {
    pub op: Option<String>,
    pub status: Option<String>,
    pub trace_id: Option<String>,
    pub operation_type: Option<String>,
}

impl SpanService {
    /// Fetches one span with its full attribute bag.
    ///
    /// Scoped to the project, so a span id belonging to another project is a
    /// 404 rather than a leak. Attributes are normalized across producers by
    /// [`span_attributes`] — the raw column shape differs between the Spans
    /// Protocol v2 path and the two legacy ones, and no caller should have to
    /// know which wrote the row.
    pub async fn get_by_id(
        pool: &DbPool,
        project_id: i32,
        id: uuid::Uuid,
    ) -> AppResult<SpanDetailResponse> {
        let row = sqlx::query(
            r#"
            SELECT id, transaction_id, span_id, trace_id, parent_span_id,
                   op, description, status,
                   start_timestamp, timestamp, duration_ms, exclusive_time_ms,
                   is_segment, segment_id, platform, release, environment,
                   gen_ai_operation_type, gen_ai_agent_name,
                   gen_ai_request_model, gen_ai_response_model,
                   gen_ai_tool_name, gen_ai_conversation_id,
                   gen_ai_usage_input_tokens, gen_ai_usage_output_tokens,
                   gen_ai_usage_total_tokens,
                   tags, data
            FROM spans
            WHERE id = $1 AND project_id = $2
            "#,
        )
        .bind(id)
        .bind(project_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Span {} not found", id)))?;

        let data: serde_json::Value = row.get("data");

        Ok(SpanDetailResponse {
            span: span_from_row(&row),
            attributes: span_attributes(&data),
            tags: row.get("tags"),
        })
    }

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
              AND ($8 IS NULL OR gen_ai_operation_type = $9)
            "#,
        )
        .bind(project_id)
        .bind(filters.op.as_deref())
        .bind(filters.op.as_deref())
        .bind(filters.status.as_deref())
        .bind(filters.status.as_deref())
        .bind(filters.trace_id.as_deref())
        .bind(filters.trace_id.as_deref())
        .bind(filters.operation_type.as_deref())
        .bind(filters.operation_type.as_deref())
        .fetch_one(pool)
        .await?;

        let rows = sqlx::query(
            r#"
            SELECT id, transaction_id, span_id, trace_id, parent_span_id,
                   op, description, status,
                   start_timestamp, timestamp, duration_ms, exclusive_time_ms,
                   is_segment, segment_id, platform, release, environment,
                   gen_ai_operation_type, gen_ai_agent_name,
                   gen_ai_request_model, gen_ai_response_model,
                   gen_ai_tool_name, gen_ai_conversation_id,
                   gen_ai_usage_input_tokens, gen_ai_usage_output_tokens, gen_ai_usage_total_tokens
            FROM spans
            WHERE project_id = $1
              AND ($2 IS NULL OR op = $3)
              AND ($4 IS NULL OR status = $5)
              AND ($6 IS NULL OR trace_id = $7)
              AND ($8 IS NULL OR gen_ai_operation_type = $9)
            ORDER BY start_timestamp DESC, id DESC
            LIMIT $10 OFFSET $11
            "#,
        )
        .bind(project_id)
        .bind(filters.op.as_deref())
        .bind(filters.op.as_deref())
        .bind(filters.status.as_deref())
        .bind(filters.status.as_deref())
        .bind(filters.trace_id.as_deref())
        .bind(filters.trace_id.as_deref())
        .bind(filters.operation_type.as_deref())
        .bind(filters.operation_type.as_deref())
        .bind(per_page)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let spans: Vec<SpanResponse> = rows.iter().map(span_from_row).collect();

        Ok((spans, total_count.0))
    }

    /// Time-bucketed count of `gen_ai.operation.type = 'agent'` spans —
    /// powers the "Agent Runs" widget. `interval_hours` controls bucket
    /// width; `period_hours` is an optional lookback window (`None` = all
    /// time). Mirrors `services::session`'s dual-backend bucketing pattern.
    pub async fn agent_runs_timeseries(
        pool: &DbPool,
        project_id: i32,
        filters: &AgentFilters,
        period_hours: Option<i64>,
        interval_hours: i64,
    ) -> AppResult<Vec<AgentTimeseriesPoint>> {
        count_timeseries(
            pool,
            project_id,
            "agent",
            filters,
            period_hours,
            interval_hours,
        )
        .await
    }

    /// Time-bucketed avg/p95 duration for `agent`/`ai_client` spans — powers
    /// the "Duration" widget. Percentile is computed in Rust (continuous,
    /// linear-interpolated via `services::transaction::percentile_cont`)
    /// since SQLite lacks `percentile_cont` — same reasoning and reused
    /// helper as `TransactionService::stats`.
    pub async fn agent_duration_timeseries(
        pool: &DbPool,
        project_id: i32,
        filters: &AgentFilters,
        period_hours: Option<i64>,
        interval_hours: i64,
    ) -> AppResult<Vec<AgentDurationPoint>> {
        let interval_seconds = interval_hours.max(1) * 3600;
        let scope = filters.sql(2);

        #[cfg(feature = "postgres")]
        let rows: Vec<(DateTime<Utc>, f64)> = {
            let time_filter = pg_span_time_filter(period_hours);
            let sql = format!(
                r#"
                SELECT
                    to_timestamp(
                        floor(extract(epoch FROM start_timestamp) / {interval_seconds}) * {interval_seconds}
                    ) AS bucket,
                    duration_ms
                FROM spans
                WHERE project_id = $1
                  AND gen_ai_operation_type IN ('agent', 'ai_client')
                  AND duration_ms IS NOT NULL
                  {scope}
                  {time_filter}
                ORDER BY bucket ASC
                "#,
            );
            sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
                .bind(project_id)
                .bind(filters.environment.as_deref())
                .fetch_all(pool)
                .await?
        };

        #[cfg(not(feature = "postgres"))]
        let rows: Vec<(DateTime<Utc>, f64)> = {
            let time_filter = sqlite_span_time_filter(period_hours);
            let sql = format!(
                r#"
                SELECT
                    strftime('%Y-%m-%dT%H:%M:%SZ', (CAST(strftime('%s', start_timestamp) AS INTEGER) / {interval_seconds}) * {interval_seconds}, 'unixepoch') AS bucket,
                    duration_ms
                FROM spans
                WHERE project_id = ?1
                  AND gen_ai_operation_type IN ('agent', 'ai_client')
                  AND duration_ms IS NOT NULL
                  {scope}
                  {time_filter}
                ORDER BY bucket ASC
                "#,
            );
            let raw: Vec<(String, f64)> = sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
                .bind(project_id)
                .bind(filters.environment.as_deref())
                .fetch_all(pool)
                .await?;
            raw.into_iter()
                .map(|(bucket, duration)| {
                    let bucket = crate::models::session::parse_ts(&bucket).unwrap_or_else(Utc::now);
                    (bucket, duration)
                })
                .collect()
        };

        // Group consecutive same-bucket rows (already ORDER BY bucket ASC)
        // and compute avg/p95 per bucket in Rust.
        let mut points = Vec::new();
        let mut current_bucket: Option<DateTime<Utc>> = None;
        let mut current_durations: Vec<f64> = Vec::new();

        let flush = |bucket: DateTime<Utc>,
                     durations: &mut Vec<f64>,
                     points: &mut Vec<AgentDurationPoint>| {
            if durations.is_empty() {
                return;
            }
            durations.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let avg = durations.iter().sum::<f64>() / durations.len() as f64;
            let p95 = percentile_cont(durations, 0.95);
            points.push(AgentDurationPoint {
                bucket,
                avg_ms: avg,
                p95_ms: p95,
            });
            durations.clear();
        };

        for (bucket, duration) in rows {
            if current_bucket != Some(bucket) {
                if let Some(prev) = current_bucket {
                    flush(prev, &mut current_durations, &mut points);
                }
                current_bucket = Some(bucket);
            }
            current_durations.push(duration);
        }
        if let Some(bucket) = current_bucket {
            flush(bucket, &mut current_durations, &mut points);
        }

        Ok(points)
    }

    /// Top-`limit` models by LLM call count (`gen_ai.operation.type =
    /// 'ai_client'`) — powers the "LLM Calls by Model" widget.
    pub async fn llm_calls_by_model(
        pool: &DbPool,
        project_id: i32,
        filters: &AgentFilters,
        period_hours: Option<i64>,
        limit: i64,
    ) -> AppResult<Vec<GenAiBreakdownRow>> {
        breakdown_query(
            pool,
            project_id,
            "gen_ai_response_model",
            "ai_client",
            "CAST(COUNT(*) AS DOUBLE PRECISION)",
            period_hours,
            limit,
            filters,
        )
        .await
    }

    /// Top-`limit` models by total tokens used (`gen_ai.operation.type =
    /// 'ai_client'`) — powers the "Tokens Used by Model" widget.
    pub async fn tokens_by_model(
        pool: &DbPool,
        project_id: i32,
        filters: &AgentFilters,
        period_hours: Option<i64>,
        limit: i64,
    ) -> AppResult<Vec<GenAiBreakdownRow>> {
        breakdown_query(
            pool,
            project_id,
            "gen_ai_response_model",
            "ai_client",
            "CAST(SUM(COALESCE(gen_ai_usage_total_tokens, 0)) AS DOUBLE PRECISION)",
            period_hours,
            limit,
            filters,
        )
        .await
    }

    /// Top-`limit` tools by call count (`gen_ai.operation.type = 'tool'`) —
    /// powers the "Tool Calls by Tool" widget.
    pub async fn tool_calls_by_tool(
        pool: &DbPool,
        project_id: i32,
        filters: &AgentFilters,
        period_hours: Option<i64>,
        limit: i64,
    ) -> AppResult<Vec<GenAiBreakdownRow>> {
        breakdown_query(
            pool,
            project_id,
            "gen_ai_tool_name",
            "tool",
            "CAST(COUNT(*) AS DOUBLE PRECISION)",
            period_hours,
            limit,
            filters,
        )
        .await
    }

    /// Per-`trace_id` aggregate across all AI spans sharing that trace
    /// (standalone and transaction-embedded spans alike, since both share
    /// this table) — powers the "Traces" widget. Offset-paginated, newest
    /// trace first.
    ///
    /// Two-step: aggregate per trace_id (portable GROUP BY), then a
    /// per-trace follow-up to find the representative agent span's name and
    /// duration — same "group query, then per-group follow-up" shape as
    /// `TransactionService::stats`'s `group_durations` call.
    /// Headline totals for the dashboard, over the selected window.
    pub async fn agent_summary(
        pool: &DbPool,
        project_id: i32,
        period_hours: Option<i64>,
        filters: &AgentFilters,
    ) -> AppResult<AgentSummary> {
        #[cfg(feature = "postgres")]
        let time_filter = pg_span_time_filter(period_hours);
        #[cfg(not(feature = "postgres"))]
        let time_filter = sqlite_span_time_filter(period_hours);

        let scope = filters.sql(2);
        let sql = format!(
            r#"
            SELECT
                SUM(CASE WHEN gen_ai_operation_type = 'agent' THEN 1 ELSE 0 END) AS agent_runs,
                SUM(CASE WHEN gen_ai_operation_type = 'ai_client' THEN 1 ELSE 0 END) AS llm_calls,
                SUM(CASE WHEN gen_ai_operation_type = 'tool' THEN 1 ELSE 0 END) AS tool_calls,
                SUM(CASE WHEN status IS NOT NULL AND status <> 'ok' THEN 1 ELSE 0 END) AS error_count,
                -- CAST for the same reason agent_traces needs it: with no
                -- usage anywhere every arm is a zero literal and SQLite
                -- infers INTEGER, which then fails to decode as f64.
                CAST(SUM(CASE WHEN gen_ai_operation_type = 'agent' THEN 0
                              ELSE COALESCE(gen_ai_usage_total_tokens, 0) END)
                     AS DOUBLE PRECISION) AS total_tokens
            FROM spans
            WHERE project_id = $1
              AND gen_ai_operation_type IS NOT NULL
              {scope}
              {time_filter}
            "#
        );

        let row = sqlx::query(sqlx::AssertSqlSafe(&*sql))
            .bind(project_id)
            .bind(filters.environment.as_deref())
            .fetch_one(pool)
            .await?;

        // A project with no AI spans at all yields a single all-NULL row
        // rather than no row, so every aggregate needs its own zero default.
        let durations_sql = format!(
            r#"
            SELECT duration_ms FROM spans
            WHERE project_id = $1
              AND gen_ai_operation_type IN ('agent', 'ai_client')
              AND duration_ms IS NOT NULL
              {scope}
              {time_filter}
            "#
        );
        let durations: Vec<(f64,)> = sqlx::query_as(sqlx::AssertSqlSafe(&*durations_sql))
            .bind(project_id)
            .bind(filters.environment.as_deref())
            .fetch_all(pool)
            .await?;

        let mut values: Vec<f64> = durations.into_iter().map(|(ms,)| ms).collect();
        values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let avg_duration_ms = if values.is_empty() {
            0.0
        } else {
            values.iter().sum::<f64>() / values.len() as f64
        };

        Ok(AgentSummary {
            agent_runs: row.try_get("agent_runs").unwrap_or(0),
            llm_calls: row.try_get("llm_calls").unwrap_or(0),
            tool_calls: row.try_get("tool_calls").unwrap_or(0),
            error_count: row.try_get("error_count").unwrap_or(0),
            total_tokens: row.try_get("total_tokens").unwrap_or(0.0),
            avg_duration_ms,
            p95_duration_ms: percentile_cont(&values, 0.95),
        })
    }

    /// Per-model table: volume, failures, latency and the full token split.
    pub async fn models_table(
        pool: &DbPool,
        project_id: i32,
        period_hours: Option<i64>,
        filters: &AgentFilters,
    ) -> AppResult<Vec<AgentModelRow>> {
        #[cfg(feature = "postgres")]
        let time_filter = pg_span_time_filter(period_hours);
        #[cfg(not(feature = "postgres"))]
        let time_filter = sqlite_span_time_filter(period_hours);

        let scope = filters.sql(2);
        // Response model where reported, request model otherwise: a failed
        // call never gets a response model but still names what it called,
        // and dropping those rows would understate exactly the models that
        // are breaking.
        let sql = format!(
            r#"
            SELECT COALESCE(gen_ai_response_model, gen_ai_request_model) AS model,
                   duration_ms,
                   status,
                   COALESCE(gen_ai_usage_input_tokens, 0)            AS input_tokens,
                   COALESCE(gen_ai_usage_cached_input_tokens, 0)     AS cached_input_tokens,
                   COALESCE(gen_ai_usage_output_tokens, 0)           AS output_tokens,
                   COALESCE(gen_ai_usage_reasoning_output_tokens, 0) AS reasoning_output_tokens,
                   COALESCE(gen_ai_usage_total_tokens, 0)            AS total_tokens
            FROM spans
            WHERE project_id = $1
              AND gen_ai_operation_type = 'ai_client'
              AND COALESCE(gen_ai_response_model, gen_ai_request_model) IS NOT NULL
              {scope}
              {time_filter}
            "#
        );

        let rows = sqlx::query(sqlx::AssertSqlSafe(&*sql))
            .bind(project_id)
            .bind(filters.environment.as_deref())
            .fetch_all(pool)
            .await?;

        let mut tokens: HashMap<String, [f64; 5]> = HashMap::new();
        let mut latency_rows = Vec::with_capacity(rows.len());

        for row in &rows {
            let model: String = row.get("model");
            let entry = tokens.entry(model.clone()).or_insert([0.0; 5]);
            // Read as f64 with a fallback: SQLite hands back INTEGER for a
            // column whose every value is a zero literal.
            let read = |key: &str| -> f64 {
                row.try_get::<f64, _>(key)
                    .or_else(|_| row.try_get::<i64, _>(key).map(|v| v as f64))
                    .unwrap_or(0.0)
            };
            entry[0] += read("input_tokens");
            entry[1] += read("cached_input_tokens");
            entry[2] += read("output_tokens");
            entry[3] += read("reasoning_output_tokens");
            entry[4] += read("total_tokens");

            latency_rows.push((model, row.get("duration_ms"), row.get("status")));
        }

        Ok(reduce_latency_groups(latency_rows)
            .into_iter()
            .map(|(model, requests, errors, avg_ms, p95_ms)| {
                let t = tokens.get(&model).copied().unwrap_or([0.0; 5]);
                AgentModelRow {
                    model,
                    requests,
                    errors,
                    avg_ms,
                    p95_ms,
                    input_tokens: t[0],
                    cached_input_tokens: t[1],
                    output_tokens: t[2],
                    reasoning_output_tokens: t[3],
                    total_tokens: t[4],
                }
            })
            .collect())
    }

    /// Per-tool table: call volume, failures and latency.
    pub async fn tools_table(
        pool: &DbPool,
        project_id: i32,
        period_hours: Option<i64>,
        filters: &AgentFilters,
    ) -> AppResult<Vec<AgentToolRow>> {
        #[cfg(feature = "postgres")]
        let time_filter = pg_span_time_filter(period_hours);
        #[cfg(not(feature = "postgres"))]
        let time_filter = sqlite_span_time_filter(period_hours);

        let scope = filters.sql(2);
        let sql = format!(
            r#"
            SELECT gen_ai_tool_name AS tool, duration_ms, status
            FROM spans
            WHERE project_id = $1
              AND gen_ai_operation_type = 'tool'
              AND gen_ai_tool_name IS NOT NULL
              {scope}
              {time_filter}
            "#
        );

        let rows: Vec<(String, Option<f64>, Option<String>)> =
            sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
                .bind(project_id)
                .bind(filters.environment.as_deref())
                .fetch_all(pool)
                .await?;

        Ok(reduce_latency_groups(rows)
            .into_iter()
            .map(|(tool, calls, errors, avg_ms, p95_ms)| AgentToolRow {
                tool,
                calls,
                errors,
                avg_ms,
                p95_ms,
            })
            .collect())
    }

    /// Environments present in this project's AI spans — the options the
    /// filter offers, rather than a hardcoded production/staging pair.
    pub async fn agent_environments(pool: &DbPool, project_id: i32) -> AppResult<Vec<String>> {
        let rows: Vec<(String,)> = sqlx::query_as(
            r#"
            SELECT DISTINCT environment FROM spans
            WHERE project_id = $1
              AND gen_ai_operation_type IS NOT NULL
              AND environment IS NOT NULL
            ORDER BY environment ASC
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().map(|(env,)| env).collect())
    }

    pub async fn agent_traces(
        pool: &DbPool,
        project_id: i32,
        page: i64,
        per_page: i64,
        period_hours: Option<i64>,
        filters: &AgentFilters,
    ) -> AppResult<(Vec<AgentTraceSummary>, i64)> {
        let per_page = per_page.clamp(1, 100);
        let offset = (page.max(1) - 1) * per_page;

        let scope = filters.sql(2);
        #[cfg(feature = "postgres")]
        let time_filter = pg_span_time_filter(period_hours);
        #[cfg(not(feature = "postgres"))]
        let time_filter = sqlite_span_time_filter(period_hours);

        let total_sql = format!(
            r#"
            SELECT COUNT(*) FROM (
                SELECT 1 FROM spans
                WHERE project_id = $1 AND gen_ai_operation_type IS NOT NULL AND trace_id IS NOT NULL
                  {scope}
                  {time_filter}
                GROUP BY trace_id
            ) g
            "#
        );
        let total: (i64,) = sqlx::query_as(sqlx::AssertSqlSafe(&*total_sql))
            .bind(project_id)
            .bind(filters.environment.as_deref())
            .fetch_one(pool)
            .await?;

        // total_tokens excludes operation_type='agent' rows: an 'agent' span
        // represents orchestration, not token consumption — its own
        // gen_ai.usage.* attributes, when present, are a client-side ROLLUP
        // of its 'ai_client' children (Sentry's SDKs accumulate child totals
        // onto the trace root — see story-span-v2-protocol.md's
        // root-span-promotion follow-up). Summing both would double-count.
        // This exclusion is unconditional (matches real Sentry's Traces
        // table query exactly — no root-only fallback: a trace with only a
        // promoted root/agent span and no ai_client children legitimately
        // reports 0 tokens in Sentry too, see tracesTable.tsx).
        let group_sql = format!(
            r#"
            SELECT trace_id,
                   -- An agent span carries the aggregate usage of its own
                   -- children, so counting it alongside them doubles the
                   -- trace's tokens. Sentry's Traces table excludes agent
                   -- runs from this sum for the same reason.
                   -- CAST keeps the sum floating even when every arm is a
                   -- zero literal: SQLite would otherwise infer INTEGER for a
                   -- trace whose spans report no usage and fail to decode.
                   CAST(SUM(CASE WHEN gen_ai_operation_type = 'agent' THEN 0
                                 ELSE COALESCE(gen_ai_usage_total_tokens, 0) END)
                        AS DOUBLE PRECISION) AS total_tokens,
                   SUM(CASE WHEN gen_ai_operation_type = 'tool' THEN 1 ELSE 0 END) AS tool_call_count,
                   SUM(CASE WHEN gen_ai_operation_type = 'ai_client' THEN 1 ELSE 0 END) AS llm_call_count,
                   -- `status IS NOT NULL` matters: most spans never report a
                   -- status at all, and `status <> 'ok'` alone is NULL (not
                   -- true) for those, so the CASE would never count them --
                   -- correct here, but only by accident. Being explicit keeps
                   -- it correct if the arms are ever reordered.
                   SUM(CASE WHEN status IS NOT NULL AND status <> 'ok' THEN 1 ELSE 0 END) AS error_count,
                   MIN(start_timestamp) AS started_at
            FROM spans
            WHERE project_id = $1 AND gen_ai_operation_type IS NOT NULL AND trace_id IS NOT NULL
              {scope}
              {time_filter}
            GROUP BY trace_id
            ORDER BY started_at DESC, trace_id ASC
            LIMIT $3 OFFSET $4
            "#
        );
        let group_rows = sqlx::query(sqlx::AssertSqlSafe(&*group_sql))
            .bind(project_id)
            .bind(filters.environment.as_deref())
            .bind(per_page)
            .bind(offset)
            .fetch_all(pool)
            .await?;

        let trace_ids: Vec<String> = group_rows.iter().map(|row| row.get("trace_id")).collect();
        let mut durations = Self::representative_durations(pool, project_id, &trace_ids).await?;
        let mut agent_names = Self::trace_agent_names(pool, project_id, &trace_ids).await?;

        let mut traces = Vec::with_capacity(group_rows.len());
        for row in &group_rows {
            let trace_id: String = row.get("trace_id");
            let total_tokens: f64 = row.get("total_tokens");
            let tool_call_count: i64 = row.get("tool_call_count");
            let llm_call_count: i64 = row.get("llm_call_count");
            let error_count: i64 = row.get("error_count");
            let started_at: DateTime<Utc> = row.get("started_at");

            let duration_ms = durations.remove(&trace_id).unwrap_or(None);
            let agent_names = agent_names.remove(&trace_id).unwrap_or_default();

            traces.push(AgentTraceSummary {
                trace_id,
                agent_names,
                duration_ms,
                total_tokens,
                tool_call_count,
                llm_call_count,
                error_count,
                started_at,
            });
        }

        Ok((traces, total.0))
    }

    /// Duration of the span representing each trace: the earliest
    /// `agent`-type span if one exists, else the earliest AI span of any type.
    /// Batched over a whole page of traces — one query, not two per row.
    async fn representative_durations(
        pool: &DbPool,
        project_id: i32,
        trace_ids: &[String],
    ) -> AppResult<HashMap<String, Option<f64>>> {
        if trace_ids.is_empty() {
            return Ok(HashMap::new());
        }

        // ROW_NUMBER partitioned per trace reproduces the agent-first,
        // then-earliest preference that the two LIMIT 1 queries encoded.
        const RANKED: &str = r#"
            SELECT trace_id, duration_ms FROM (
                SELECT trace_id, duration_ms,
                       ROW_NUMBER() OVER (
                           PARTITION BY trace_id
                           ORDER BY CASE WHEN gen_ai_operation_type = 'agent' THEN 0 ELSE 1 END ASC,
                                    start_timestamp ASC
                       ) AS rn
                FROM spans
                WHERE project_id = "#;

        #[cfg(feature = "postgres")]
        let rows: Vec<(String, Option<f64>)> = sqlx::query_as(sqlx::AssertSqlSafe(format!(
            "{RANKED}$1 AND gen_ai_operation_type IS NOT NULL AND trace_id = ANY($2)
            ) t WHERE rn = 1"
        )))
        .bind(project_id)
        .bind(trace_ids)
        .fetch_all(pool)
        .await?;

        #[cfg(not(feature = "postgres"))]
        let rows: Vec<(String, Option<f64>)> = {
            use sqlx::QueryBuilder;
            let mut qb = QueryBuilder::new(RANKED);
            qb.push_bind(project_id);
            qb.push(" AND gen_ai_operation_type IS NOT NULL AND trace_id IN (");
            let mut sep = qb.separated(", ");
            for trace_id in trace_ids {
                sep.push_bind(trace_id.clone());
            }
            qb.push(")) t WHERE rn = 1");
            qb.build_query_as().fetch_all(pool).await?
        };

        Ok(rows.into_iter().collect())
    }

    /// Every distinct agent name per trace, earliest first — a trace with
    /// handoffs runs more than one agent, and Sentry's Traces table lists
    /// them all. `gen_ai_agent_name` already carries the `function_id`
    /// fallback, resolved during gen_ai normalization at ingestion.
    async fn trace_agent_names(
        pool: &DbPool,
        project_id: i32,
        trace_ids: &[String],
    ) -> AppResult<HashMap<String, Vec<String>>> {
        if trace_ids.is_empty() {
            return Ok(HashMap::new());
        }

        const SELECT: &str = r#"
            SELECT trace_id, gen_ai_agent_name
            FROM spans
            WHERE gen_ai_operation_type = 'agent'
              AND gen_ai_agent_name IS NOT NULL
              AND project_id = "#;

        #[cfg(feature = "postgres")]
        let rows: Vec<(String, String)> = sqlx::query_as(sqlx::AssertSqlSafe(format!(
            "{SELECT}$1 AND trace_id = ANY($2) ORDER BY start_timestamp ASC"
        )))
        .bind(project_id)
        .bind(trace_ids)
        .fetch_all(pool)
        .await?;

        #[cfg(not(feature = "postgres"))]
        let rows: Vec<(String, String)> = {
            use sqlx::QueryBuilder;
            let mut qb = QueryBuilder::new(SELECT);
            qb.push_bind(project_id);
            qb.push(" AND trace_id IN (");
            let mut sep = qb.separated(", ");
            for trace_id in trace_ids {
                sep.push_bind(trace_id.clone());
            }
            qb.push(") ORDER BY start_timestamp ASC");
            qb.build_query_as().fetch_all(pool).await?
        };

        let mut out: HashMap<String, Vec<String>> = HashMap::new();
        for (trace_id, agent_name) in rows {
            let names = out.entry(trace_id).or_default();
            // The same agent can span many rows; keep first-seen order.
            if !names.contains(&agent_name) {
                names.push(agent_name);
            }
        }
        Ok(out)
    }
}

/// `AND start_timestamp >= ...` time filter for a `spans` query. Empty
/// string when `period_hours` is `None` (no time filter). Mirrors
/// `services::session`'s `pg_bucket_time_filter`.
#[cfg(feature = "postgres")]
fn pg_span_time_filter(period_hours: Option<i64>) -> String {
    match period_hours {
        Some(hours) => format!("AND start_timestamp >= NOW() - '{hours} hours'::interval"),
        None => String::new(),
    }
}

#[cfg(not(feature = "postgres"))]
fn sqlite_span_time_filter(period_hours: Option<i64>) -> String {
    match period_hours {
        Some(hours) => {
            format!("AND start_timestamp >= datetime('now', '-' || '{hours}' || ' hours')")
        }
        None => String::new(),
    }
}

/// Time-bucketed `COUNT(*)` of spans matching `operation_type`.
async fn count_timeseries(
    pool: &DbPool,
    project_id: i32,
    operation_type: &str,
    filters: &AgentFilters,
    period_hours: Option<i64>,
    interval_hours: i64,
) -> AppResult<Vec<AgentTimeseriesPoint>> {
    bucketed_aggregate(
        pool,
        project_id,
        operation_type,
        "CAST(COUNT(*) AS DOUBLE PRECISION)",
        filters,
        period_hours,
        interval_hours,
    )
    .await
}

/// Shared time-bucketing core for the "Agent Runs" widget —
/// `aggregate_expr` is a pre-cast SQL expression (`CAST(... AS DOUBLE
/// PRECISION)`) so both dialects decode into `f64` uniformly. Mirrors
/// `services::session::query_session_timeseries`'s dual-backend bucketing
/// exactly (same `floor(extract(epoch...))` / `strftime` approach), just
/// scoped to `spans.start_timestamp` and gated by `gen_ai_operation_type`
/// instead of `session_counts.bucket`.
#[allow(clippy::too_many_arguments)]
async fn bucketed_aggregate(
    pool: &DbPool,
    project_id: i32,
    operation_type: &str,
    aggregate_expr: &str,
    filters: &AgentFilters,
    period_hours: Option<i64>,
    interval_hours: i64,
) -> AppResult<Vec<AgentTimeseriesPoint>> {
    let interval_seconds = interval_hours.max(1) * 3600;
    // $3, not $2: this query already spends $2 on the operation type.
    let scope = filters.sql(3);

    #[cfg(feature = "postgres")]
    {
        let time_filter = pg_span_time_filter(period_hours);
        let sql = format!(
            r#"
            SELECT
                to_timestamp(
                    floor(extract(epoch FROM start_timestamp) / {interval_seconds}) * {interval_seconds}
                ) AS bucket,
                {aggregate_expr} AS value
            FROM spans
            WHERE project_id = $1
              AND gen_ai_operation_type = $2
              {scope}
              {time_filter}
            GROUP BY 1
            ORDER BY 1 ASC
            "#,
        );
        let rows: Vec<(DateTime<Utc>, f64)> = sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
            .bind(project_id)
            .bind(operation_type)
            .bind(filters.environment.as_deref())
            .fetch_all(pool)
            .await?;
        Ok(rows
            .into_iter()
            .map(|(bucket, value)| AgentTimeseriesPoint { bucket, value })
            .collect())
    }

    #[cfg(not(feature = "postgres"))]
    {
        let time_filter = sqlite_span_time_filter(period_hours);
        let sql = format!(
            r#"
            SELECT
                strftime('%Y-%m-%dT%H:%M:%SZ', (CAST(strftime('%s', start_timestamp) AS INTEGER) / {interval_seconds}) * {interval_seconds}, 'unixepoch') AS bucket,
                {aggregate_expr} AS value
            FROM spans
            WHERE project_id = ?1
              AND gen_ai_operation_type = ?2
              {scope}
              {time_filter}
            GROUP BY 1
            ORDER BY 1 ASC
            "#,
        );
        let rows: Vec<(String, f64)> = sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
            .bind(project_id)
            .bind(operation_type)
            .bind(filters.environment.as_deref())
            .fetch_all(pool)
            .await?;
        Ok(rows
            .into_iter()
            .map(|(bucket, value)| AgentTimeseriesPoint {
                bucket: crate::models::session::parse_ts(&bucket).unwrap_or_else(Utc::now),
                value,
            })
            .collect())
    }
}

/// Shared "GROUP BY column, aggregate, top N" query for the 3 breakdown
/// widgets (LLM Calls by Model, Tokens by Model, Tool Calls by Tool).
/// `group_column`/`aggregate_expr` are Rust string literals the caller
/// controls (never user input) — safe to interpolate via `format!`, same
/// trust level as `services::session`'s interval interpolation.
// One more parameter than clippy's default ceiling. Bundling them into a
// struct would buy nothing: this is a private helper with three call sites in
// this file, all of them naming every field.
#[allow(clippy::too_many_arguments)]
async fn breakdown_query(
    pool: &DbPool,
    project_id: i32,
    group_column: &str,
    operation_type: &str,
    aggregate_expr: &str,
    period_hours: Option<i64>,
    limit: i64,
    filters: &AgentFilters,
) -> AppResult<Vec<GenAiBreakdownRow>> {
    // The `param(minimum/maximum)` on AgentBreakdownQuery is OpenAPI docs only
    // — Postgres rejects a negative LIMIT and SQLite reads it as "no cap".
    let limit = limit.clamp(1, 100);

    #[cfg(feature = "postgres")]
    let time_filter = pg_span_time_filter(period_hours);
    #[cfg(not(feature = "postgres"))]
    let time_filter = sqlite_span_time_filter(period_hours);

    let scope = filters.sql(3);

    let sql = format!(
        r#"
        SELECT {group_column} AS label, {aggregate_expr} AS value
        FROM spans
        WHERE project_id = $1
          AND gen_ai_operation_type = $2
          AND {group_column} IS NOT NULL
          {scope}
          {time_filter}
        GROUP BY {group_column}
        ORDER BY value DESC, {group_column} ASC
        LIMIT $4
        "#,
    );
    let rows: Vec<(String, f64)> = sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
        .bind(project_id)
        .bind(operation_type)
        .bind(filters.environment.as_deref())
        .bind(limit)
        .fetch_all(pool)
        .await?;

    Ok(rows
        .into_iter()
        .map(|(label, value)| GenAiBreakdownRow { label, value })
        .collect())
}
