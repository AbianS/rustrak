use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::Row;

use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::{
    AgentDurationPoint, AgentTimeseriesPoint, AgentTraceSummary, GenAiBreakdownRow, SpanResponse,
};
use crate::services::transaction::percentile_cont;

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
    pub operation_type: Option<String>,
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
                gen_ai_operation_type: row.get("gen_ai_operation_type"),
                gen_ai_agent_name: row.get("gen_ai_agent_name"),
                gen_ai_request_model: row.get("gen_ai_request_model"),
                gen_ai_response_model: row.get("gen_ai_response_model"),
                gen_ai_tool_name: row.get("gen_ai_tool_name"),
                gen_ai_conversation_id: row.get("gen_ai_conversation_id"),
                gen_ai_usage_input_tokens: row.get("gen_ai_usage_input_tokens"),
                gen_ai_usage_output_tokens: row.get("gen_ai_usage_output_tokens"),
                gen_ai_usage_total_tokens: row.get("gen_ai_usage_total_tokens"),
            })
            .collect();

        Ok((spans, total_count.0))
    }

    /// Time-bucketed count of `gen_ai.operation.type = 'agent'` spans —
    /// powers the "Agent Runs" widget. `interval_hours` controls bucket
    /// width; `period_hours` is an optional lookback window (`None` = all
    /// time). Mirrors `services::session`'s dual-backend bucketing pattern.
    pub async fn agent_runs_timeseries(
        pool: &DbPool,
        project_id: i32,
        period_hours: Option<i64>,
        interval_hours: i64,
    ) -> AppResult<Vec<AgentTimeseriesPoint>> {
        count_timeseries(pool, project_id, "agent", period_hours, interval_hours).await
    }

    /// Time-bucketed avg/p95 duration for `agent`/`ai_client` spans — powers
    /// the "Duration" widget. Percentile is computed in Rust (continuous,
    /// linear-interpolated via `services::transaction::percentile_cont`)
    /// since SQLite lacks `percentile_cont` — same reasoning and reused
    /// helper as `TransactionService::stats`.
    pub async fn agent_duration_timeseries(
        pool: &DbPool,
        project_id: i32,
        period_hours: Option<i64>,
        interval_hours: i64,
    ) -> AppResult<Vec<AgentDurationPoint>> {
        let interval_seconds = interval_hours.max(1) * 3600;

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
                  {time_filter}
                ORDER BY bucket ASC
                "#,
            );
            sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
                .bind(project_id)
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
                  {time_filter}
                ORDER BY bucket ASC
                "#,
            );
            let raw: Vec<(String, f64)> = sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
                .bind(project_id)
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
        )
        .await
    }

    /// Top-`limit` models by total tokens used (`gen_ai.operation.type =
    /// 'ai_client'`) — powers the "Tokens Used by Model" widget.
    pub async fn tokens_by_model(
        pool: &DbPool,
        project_id: i32,
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
        )
        .await
    }

    /// Top-`limit` tools by call count (`gen_ai.operation.type = 'tool'`) —
    /// powers the "Tool Calls by Tool" widget.
    pub async fn tool_calls_by_tool(
        pool: &DbPool,
        project_id: i32,
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
    pub async fn agent_traces(
        pool: &DbPool,
        project_id: i32,
        page: i64,
        per_page: i64,
    ) -> AppResult<(Vec<AgentTraceSummary>, i64)> {
        let per_page = per_page.clamp(1, 100);
        let offset = (page.max(1) - 1) * per_page;

        let total: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM (
                SELECT 1 FROM spans
                WHERE project_id = $1 AND gen_ai_operation_type IS NOT NULL AND trace_id IS NOT NULL
                GROUP BY trace_id
            ) g
            "#,
        )
        .bind(project_id)
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
        let group_rows = sqlx::query(
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
                   MIN(start_timestamp) AS started_at
            FROM spans
            WHERE project_id = $1 AND gen_ai_operation_type IS NOT NULL AND trace_id IS NOT NULL
            GROUP BY trace_id
            ORDER BY started_at DESC, trace_id ASC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(project_id)
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
            let started_at: DateTime<Utc> = row.get("started_at");

            let duration_ms = durations.remove(&trace_id).unwrap_or(None);
            let agent_names = agent_names.remove(&trace_id).unwrap_or_default();

            traces.push(AgentTraceSummary {
                trace_id,
                agent_names,
                duration_ms,
                total_tokens,
                tool_call_count,
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
    period_hours: Option<i64>,
    interval_hours: i64,
) -> AppResult<Vec<AgentTimeseriesPoint>> {
    bucketed_aggregate(
        pool,
        project_id,
        operation_type,
        "CAST(COUNT(*) AS DOUBLE PRECISION)",
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
async fn bucketed_aggregate(
    pool: &DbPool,
    project_id: i32,
    operation_type: &str,
    aggregate_expr: &str,
    period_hours: Option<i64>,
    interval_hours: i64,
) -> AppResult<Vec<AgentTimeseriesPoint>> {
    let interval_seconds = interval_hours.max(1) * 3600;

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
              {time_filter}
            GROUP BY 1
            ORDER BY 1 ASC
            "#,
        );
        let rows: Vec<(DateTime<Utc>, f64)> = sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
            .bind(project_id)
            .bind(operation_type)
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
              {time_filter}
            GROUP BY 1
            ORDER BY 1 ASC
            "#,
        );
        let rows: Vec<(String, f64)> = sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
            .bind(project_id)
            .bind(operation_type)
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
async fn breakdown_query(
    pool: &DbPool,
    project_id: i32,
    group_column: &str,
    operation_type: &str,
    aggregate_expr: &str,
    period_hours: Option<i64>,
    limit: i64,
) -> AppResult<Vec<GenAiBreakdownRow>> {
    // The `param(minimum/maximum)` on AgentBreakdownQuery is OpenAPI docs only
    // — Postgres rejects a negative LIMIT and SQLite reads it as "no cap".
    let limit = limit.clamp(1, 100);

    #[cfg(feature = "postgres")]
    let time_filter = pg_span_time_filter(period_hours);
    #[cfg(not(feature = "postgres"))]
    let time_filter = sqlite_span_time_filter(period_hours);

    let sql = format!(
        r#"
        SELECT {group_column} AS label, {aggregate_expr} AS value
        FROM spans
        WHERE project_id = $1
          AND gen_ai_operation_type = $2
          AND {group_column} IS NOT NULL
          {time_filter}
        GROUP BY {group_column}
        ORDER BY value DESC, {group_column} ASC
        LIMIT $3
        "#,
    );
    let rows: Vec<(String, f64)> = sqlx::query_as(sqlx::AssertSqlSafe(&*sql))
        .bind(project_id)
        .bind(operation_type)
        .bind(limit)
        .fetch_all(pool)
        .await?;

    Ok(rows
        .into_iter()
        .map(|(label, value)| GenAiBreakdownRow { label, value })
        .collect())
}
