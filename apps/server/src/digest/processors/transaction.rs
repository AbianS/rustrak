use super::{Processor, ProcessorCtx};
use crate::error::{AppError, AppResult};
use crate::services::gen_ai::{extract_gen_ai_columns, GenAiColumns};
use bytes::Bytes;
use chrono::{DateTime, TimeZone, Utc};
use uuid::Uuid;

pub struct TransactionProcessor;

impl Processor for TransactionProcessor {
    type Input = Bytes;

    /// Store a transaction payload into the dedicated `transactions` table.
    /// Does NOT create an issue, grouping, or source-map rewrite.
    async fn process(&self, work: Bytes, ctx: &ProcessorCtx) -> AppResult<()> {
        // Reject malformed payloads instead of persisting a null-data row.
        // The ingest route propagates this error so the SDK can retry the envelope.
        let mut data: serde_json::Value = serde_json::from_slice(&work)
            .map_err(|e| AppError::Validation(format!("Invalid transaction JSON: {}", e)))?;

        let timestamp = extract_timestamp(&data, "timestamp").unwrap_or(ctx.ingested_at);
        let start_timestamp = extract_timestamp(&data, "start_timestamp");
        let transaction_name = extract_str(&data, "transaction");

        // Denormalize the trace context (contexts.trace.*) into queryable columns
        // — mirrors Relay, which surfaces op/status/span_id for performance views.
        let trace = data.get("contexts").and_then(|c| c.get("trace"));
        let trace_id = trace_str(trace, "trace_id");
        let span_id = trace_str(trace, "span_id");
        let parent_span_id = trace_str(trace, "parent_span_id");
        let op = trace_str(trace, "op");
        let status = trace_str(trace, "status");
        // transaction_info.source carries Relay's TransactionSource. Stored
        // verbatim (Relay keeps unrecognized values via its `Other(String)`
        // variant); defaults to "unknown" when the SDK omits transaction_info.
        let source = data
            .get("transaction_info")
            .and_then(|ti| ti.get("source"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        // Precompute duration at write time (milliseconds, microsecond precision).
        let duration_ms = start_timestamp.and_then(|st| {
            (timestamp - st)
                .num_microseconds()
                .map(|us| (us as f64 / 1000.0).max(0.0))
        });

        // Denormalize the fields the list/detail views surface so they don't
        // have to parse the JSON payload on every read.
        let platform = extract_str(&data, "platform");
        let release = extract_str(&data, "release");
        let environment = extract_str(&data, "environment");
        let server_name = extract_str(&data, "server_name");
        let level = data
            .get("level")
            .and_then(|v| v.as_str())
            .unwrap_or("info")
            .to_string();
        let sdk_name = data
            .get("sdk")
            .and_then(|s| s.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let sdk_version = data
            .get("sdk")
            .and_then(|s| s.get("version"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let id = Uuid::new_v4();

        // Parent transaction + its extracted spans are written in one DB
        // transaction, and a retry with the same event id is a no-op.
        let mut tx = ctx.pool.begin().await?;

        let inserted = sqlx::query(
            r#"
            INSERT INTO transactions (
                id, event_id, project_id,
                transaction_name,
                trace_id, span_id, parent_span_id, op, status, source,
                start_timestamp, timestamp, duration_ms,
                platform, environment, release, server_name,
                sdk_name, sdk_version, level,
                data, remote_addr, ingested_at
            ) VALUES (
                $1, $2, $3,
                $4,
                $5, $6, $7, $8, $9, $10,
                $11, $12, $13,
                $14, $15, $16, $17,
                $18, $19, $20,
                $21, $22, $23
            )
            ON CONFLICT (project_id, event_id) DO NOTHING
            "#,
        )
        .bind(id)
        .bind(ctx.event_id)
        .bind(ctx.project_id)
        .bind(&transaction_name)
        .bind(trace_id.as_deref())
        .bind(span_id.as_deref())
        .bind(parent_span_id.as_deref())
        .bind(op.as_deref())
        .bind(status.as_deref())
        .bind(source)
        .bind(start_timestamp)
        .bind(timestamp)
        .bind(duration_ms)
        .bind(&platform)
        .bind(&environment)
        .bind(&release)
        .bind(server_name)
        .bind(sdk_name)
        .bind(sdk_version)
        .bind(level)
        .bind(sqlx::types::Json(&data))
        .bind(ctx.remote_addr.as_deref())
        .bind(ctx.ingested_at)
        .execute(&mut *tx)
        .await?;

        if inserted.rows_affected() == 0 {
            return Ok(());
        }

        // Extract each span into the indexed `spans` table. Mirrors Relay's span
        // extraction (DataCategory::SpanIndexed): individually queryable rows
        // linked to the parent transaction. A span inherits the transaction's
        // trace_id when it doesn't carry its own.
        if let Some(spans) = data.get_mut("spans").and_then(|s| s.as_array_mut()) {
            // Mutate each span's own `data` attributes bag in place; the parent
            // transaction was already serialized above.
            for span in spans {
                insert_span(
                    span,
                    id,
                    ctx.project_id,
                    trace_id.as_deref(),
                    non_empty(&platform),
                    non_empty(&release),
                    non_empty(&environment),
                    &mut *tx,
                )
                .await?;
            }
        }

        // Promote contexts.trace into its own `spans` row when it's an
        // AI-instrumented trace root. Some SDKs (verified: @sentry/node +
        // Vercel AI SDK's vercelAIIntegration()) send the trace's root span
        // ("invoke_agent") inline on the transaction event's contexts.trace
        // — never as its own span item in `spans[]` — carrying
        // client-accumulated token totals in contexts.trace.data. Without
        // this, gen_ai_operation_type='agent' aggregations (the "Agent Runs"
        // widget) never see it, even though other AI spans in the same trace
        // do. Gated on is_ai_span (via extract_gen_ai_columns's own check) so
        // an ordinary, non-AI transaction's span count is unaffected —
        // verified live against a real captured trace, 2026-07-17.
        if let (Some(root_span_id), Some(root_trace_id)) = (&span_id, &trace_id) {
            let mut trace_context = data
                .get_mut("contexts")
                .and_then(|contexts| contexts.get_mut("trace"));
            let gen_ai = match trace_context
                .as_deref_mut()
                .and_then(serde_json::Value::as_object_mut)
            {
                Some(trace) => {
                    let trace_data = trace.entry("data").or_insert_with(|| serde_json::json!({}));
                    extract_gen_ai_columns(trace_data, op.as_deref())
                }
                None => GenAiColumns::default(),
            };
            if gen_ai.operation_type.is_some() {
                insert_root_span(
                    root_span_id,
                    root_trace_id,
                    parent_span_id.as_deref(),
                    op.as_deref(),
                    status.as_deref(),
                    &transaction_name,
                    start_timestamp,
                    timestamp,
                    duration_ms,
                    id,
                    ctx.project_id,
                    trace_context
                        .as_deref()
                        .expect("trace context exists when root span identifiers exist"),
                    // `extract_str` yields "" for an absent field, but the
                    // spans table's nullable columns mean "not reported" —
                    // and an empty string would surface as a filter option.
                    non_empty(&platform),
                    non_empty(&release),
                    non_empty(&environment),
                    gen_ai,
                    &mut *tx,
                )
                .await?;
            }
        }

        tx.commit().await?;

        Ok(())
    }
}

/// The concrete SQLx database backend, selected by Cargo feature.
#[cfg(feature = "postgres")]
type Db = sqlx::Postgres;
#[cfg(feature = "sqlite")]
type Db = sqlx::Sqlite;

/// Inserts a single extracted span row linked to its parent transaction.
/// Generic over the executor so it can run inside the parent's DB transaction.
/// Takes an owned `span` (not borrowed) so gen_ai normalization can mutate
/// its `data` attributes bag freely.
// Same shape as `insert_root_span`: one more parameter than clippy's
// ceiling, for the same reason -- the transaction's scope has to reach the
// row, and there is one call site.
#[allow(clippy::too_many_arguments)]
async fn insert_span<'e, E>(
    span: &mut serde_json::Value,
    transaction_id: Uuid,
    project_id: i32,
    txn_trace_id: Option<&str>,
    // The parent transaction's scope. `spans.platform/release/environment`
    // were originally documented as "standalone spans only, a child inherits
    // from its transaction row" — true for a JOIN, but the agents dashboard
    // filters `spans` directly, so leaving them NULL drops every
    // transaction-embedded AI span from an environment-filtered view.
    platform: Option<&str>,
    release: Option<&str>,
    environment: Option<&str>,
    executor: E,
) -> AppResult<()>
where
    E: sqlx::Executor<'e, Database = Db>,
{
    let span_id = span
        .get("span_id")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let parent_span_id = span
        .get("parent_span_id")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let op = span.get("op").and_then(|v| v.as_str()).map(str::to_string);
    let description = span
        .get("description")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let status = span
        .get("status")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let segment_id = span
        .get("segment_id")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let is_segment = span
        .get("is_segment")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // A span carries its own trace_id only rarely; inherit the transaction's.
    let trace_id = span
        .get("trace_id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| txn_trace_id.map(str::to_string));

    let start_timestamp = extract_timestamp(span, "start_timestamp");
    let timestamp = extract_timestamp(span, "timestamp");
    let duration_ms = match (start_timestamp, timestamp) {
        (Some(st), Some(ts)) => (ts - st)
            .num_microseconds()
            .map(|us| (us as f64 / 1000.0).max(0.0)),
        _ => None,
    };
    // Relay's exclusive_time is already in milliseconds.
    let exclusive_time_ms = span.get("exclusive_time").and_then(|v| v.as_f64());

    let tags = span.get("tags").cloned();

    // gen_ai.* normalization, on the span's own `data` attributes bag —
    // same shared function `SpanProcessor` calls for standalone spans, so
    // a transaction-embedded LLM-call child span is normalized identically.
    let gen_ai = match span.get_mut("data") {
        Some(span_data) => extract_gen_ai_columns(span_data, op.as_deref()),
        None => GenAiColumns::default(),
    };

    sqlx::query(
        r#"
        INSERT INTO spans (
            id, transaction_id, project_id,
            span_id, trace_id, parent_span_id,
            op, description, status,
            start_timestamp, timestamp, duration_ms, exclusive_time_ms,
            is_segment, segment_id, tags, data,
            platform, release, environment,
            gen_ai_operation_type, gen_ai_agent_name,
            gen_ai_request_model, gen_ai_response_model,
            gen_ai_tool_name, gen_ai_conversation_id,
            gen_ai_usage_input_tokens, gen_ai_usage_output_tokens, gen_ai_usage_total_tokens,
                    gen_ai_usage_cached_input_tokens, gen_ai_usage_reasoning_output_tokens
        ) VALUES (
            $1, $2, $3,
            $4, $5, $6,
            $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17,
            $18, $19, $20,
            $21, $22,
            $23, $24,
            $25, $26,
            $27, $28, $29,
            $30, $31
        )
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(transaction_id)
    .bind(project_id)
    .bind(span_id)
    .bind(trace_id)
    .bind(parent_span_id)
    .bind(op)
    .bind(description)
    .bind(status)
    .bind(start_timestamp)
    .bind(timestamp)
    .bind(duration_ms)
    .bind(exclusive_time_ms)
    .bind(is_segment)
    .bind(segment_id)
    .bind(tags)
    .bind(sqlx::types::Json(&*span))
    .bind(platform)
    .bind(release)
    .bind(environment)
    .bind(gen_ai.operation_type)
    .bind(gen_ai.agent_name)
    .bind(gen_ai.request_model)
    .bind(gen_ai.response_model)
    .bind(gen_ai.tool_name)
    .bind(gen_ai.conversation_id)
    .bind(gen_ai.usage_input_tokens)
    .bind(gen_ai.usage_output_tokens)
    .bind(gen_ai.usage_total_tokens)
    .bind(gen_ai.usage_cached_input_tokens)
    .bind(gen_ai.usage_reasoning_output_tokens)
    .execute(executor)
    .await?;

    Ok(())
}

/// Inserts a synthesized root/segment span row from an AI-recognized
/// `contexts.trace`, linked to its parent transaction. `trace_context` is the
/// whole `contexts.trace` object — stored verbatim as the `data` column, so
/// gen_ai fields sit at `$.data.gen_ai.*` — and `gen_ai` holds the columns
/// already extracted from its nested `data` bag. Both must be computed by the
/// caller; this function only performs the INSERT. Generic over the executor
/// so it can run inside the parent's DB transaction.
#[allow(clippy::too_many_arguments)]
async fn insert_root_span<'e, E>(
    span_id: &str,
    trace_id: &str,
    parent_span_id: Option<&str>,
    op: Option<&str>,
    status: Option<&str>,
    description: &str,
    start_timestamp: Option<DateTime<Utc>>,
    timestamp: DateTime<Utc>,
    duration_ms: Option<f64>,
    transaction_id: Uuid,
    project_id: i32,
    trace_context: &serde_json::Value,
    platform: Option<&str>,
    release: Option<&str>,
    environment: Option<&str>,
    gen_ai: GenAiColumns,
    executor: E,
) -> AppResult<()>
where
    E: sqlx::Executor<'e, Database = Db>,
{
    sqlx::query(
        r#"
        INSERT INTO spans (
            id, transaction_id, project_id,
            span_id, trace_id, parent_span_id,
            op, description, status,
            start_timestamp, timestamp, duration_ms, exclusive_time_ms,
            is_segment, segment_id, tags, data,
            platform, release, environment,
            gen_ai_operation_type, gen_ai_agent_name,
            gen_ai_request_model, gen_ai_response_model,
            gen_ai_tool_name, gen_ai_conversation_id,
            gen_ai_usage_input_tokens, gen_ai_usage_output_tokens, gen_ai_usage_total_tokens,
                    gen_ai_usage_cached_input_tokens, gen_ai_usage_reasoning_output_tokens
        ) VALUES (
            $1, $2, $3,
            $4, $5, $6,
            $7, $8, $9,
            $10, $11, $12, NULL,
            TRUE, $13, NULL, $14,
            $15, $16, $17,
            $18, $19,
            $20, $21,
            $22, $23,
            $24, $25, $26,
            $27, $28
        )
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(transaction_id)
    .bind(project_id)
    .bind(span_id)
    .bind(trace_id)
    .bind(parent_span_id)
    .bind(op)
    .bind(description)
    .bind(status)
    .bind(start_timestamp)
    .bind(timestamp)
    .bind(duration_ms)
    .bind(span_id) // segment_id: the root is its own segment
    .bind(sqlx::types::Json(trace_context))
    // Inherited from the transaction event: contexts.trace carries none of
    // these, and a promoted root with a NULL environment would vanish from
    // any environment-filtered aggregate while its own children survived.
    .bind(platform)
    .bind(release)
    .bind(environment)
    .bind(gen_ai.operation_type)
    .bind(gen_ai.agent_name)
    .bind(gen_ai.request_model)
    .bind(gen_ai.response_model)
    .bind(gen_ai.tool_name)
    .bind(gen_ai.conversation_id)
    .bind(gen_ai.usage_input_tokens)
    .bind(gen_ai.usage_output_tokens)
    .bind(gen_ai.usage_total_tokens)
    .bind(gen_ai.usage_cached_input_tokens)
    .bind(gen_ai.usage_reasoning_output_tokens)
    .execute(executor)
    .await?;

    Ok(())
}

/// Extracts a top-level string field from the payload, defaulting to empty.
/// `None` for the empty string `extract_str` returns when a field is absent.
fn non_empty(value: &str) -> Option<&str> {
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn extract_str(data: &serde_json::Value, key: &str) -> String {
    data.get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

/// Reads a string field from the `contexts.trace` object, if present.
/// Returns `None` for a missing trace, missing key, or non-string value —
/// so the column stays NULL rather than storing `""`.
fn trace_str(trace: Option<&serde_json::Value>, key: &str) -> Option<String> {
    trace
        .and_then(|t| t.get(key))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

fn extract_timestamp(data: &serde_json::Value, key: &str) -> Option<DateTime<Utc>> {
    let raw = data.get(key)?;
    if let Some(epoch) = raw.as_f64() {
        let secs = epoch.floor() as i64;
        let nanos = ((epoch - epoch.floor()) * 1_000_000_000.0) as u32;
        return Utc.timestamp_opt(secs, nanos).single();
    }
    if let Some(s) = raw.as_str() {
        return DateTime::parse_from_rfc3339(s)
            .ok()
            .map(|dt| dt.with_timezone(&Utc));
    }
    None
}
