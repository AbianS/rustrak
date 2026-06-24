use super::{Processor, ProcessorCtx};
use crate::error::{AppError, AppResult};
use chrono::{DateTime, TimeZone, Utc};
use uuid::Uuid;

pub struct TransactionProcessor;

impl Processor for TransactionProcessor {
    type Input = Vec<u8>;

    /// Store a transaction payload into the dedicated `transactions` table.
    /// Does NOT create an issue, grouping, or source-map rewrite.
    async fn process(&self, work: Vec<u8>, ctx: &ProcessorCtx) -> AppResult<()> {
        // Reject malformed payloads instead of persisting a null-data row.
        // The caller (ingest spawn) logs the error and discards — envelope still 200.
        let data: serde_json::Value = serde_json::from_slice(&work)
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

        sqlx::query(
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
            "#,
        )
        .bind(id)
        .bind(ctx.event_id)
        .bind(ctx.project_id)
        .bind(transaction_name)
        .bind(trace_id.as_deref())
        .bind(span_id)
        .bind(parent_span_id)
        .bind(op)
        .bind(status)
        .bind(source)
        .bind(start_timestamp)
        .bind(timestamp)
        .bind(duration_ms)
        .bind(platform)
        .bind(environment)
        .bind(release)
        .bind(server_name)
        .bind(sdk_name)
        .bind(sdk_version)
        .bind(level)
        .bind(serde_json::json!(data))
        .bind(ctx.remote_addr.as_deref())
        .bind(ctx.ingested_at)
        .execute(&ctx.pool)
        .await?;

        // Extract each span into the indexed `spans` table. Mirrors Relay's span
        // extraction (DataCategory::SpanIndexed): individually queryable rows
        // linked to the parent transaction. A span inherits the transaction's
        // trace_id when it doesn't carry its own.
        if let Some(spans) = data.get("spans").and_then(|s| s.as_array()) {
            for span in spans {
                insert_span(span, id, ctx.project_id, trace_id.as_deref(), &ctx.pool).await?;
            }
        }

        Ok(())
    }
}

/// Inserts a single extracted span row linked to its parent transaction.
async fn insert_span(
    span: &serde_json::Value,
    transaction_id: Uuid,
    project_id: i32,
    txn_trace_id: Option<&str>,
    pool: &crate::db::DbPool,
) -> AppResult<()> {
    let span_id = span.get("span_id").and_then(|v| v.as_str());
    let parent_span_id = span.get("parent_span_id").and_then(|v| v.as_str());
    let op = span.get("op").and_then(|v| v.as_str());
    let description = span.get("description").and_then(|v| v.as_str());
    let status = span.get("status").and_then(|v| v.as_str());
    let segment_id = span.get("segment_id").and_then(|v| v.as_str());
    let is_segment = span
        .get("is_segment")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // A span carries its own trace_id only rarely; inherit the transaction's.
    let trace_id = span
        .get("trace_id")
        .and_then(|v| v.as_str())
        .or(txn_trace_id);

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

    sqlx::query(
        r#"
        INSERT INTO spans (
            id, transaction_id, project_id,
            span_id, trace_id, parent_span_id,
            op, description, status,
            start_timestamp, timestamp, duration_ms, exclusive_time_ms,
            is_segment, segment_id, tags, data
        ) VALUES (
            $1, $2, $3,
            $4, $5, $6,
            $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17
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
    .bind(serde_json::json!(span))
    .execute(pool)
    .await?;

    Ok(())
}

/// Extracts a top-level string field from the payload, defaulting to empty.
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
