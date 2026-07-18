use super::{Processor, ProcessorCtx};
use crate::error::{AppError, AppResult};
use crate::services::gen_ai::{extract_gen_ai_columns, GenAiColumns};
use chrono::{DateTime, TimeZone, Utc};
use uuid::Uuid;

pub struct SpanProcessor;

impl Processor for SpanProcessor {
    type Input = Vec<u8>;

    /// Stores a standalone span payload (Sentry "span" item type — Relay's
    /// legacy schema, one flat span object per envelope item, NOT a
    /// container like logs) into the shared `spans` table with
    /// `transaction_id = NULL`. Mirrors `TransactionProcessor::insert_span`'s
    /// column extraction so both producers write a consistent row shape.
    async fn process(&self, work: Vec<u8>, ctx: &ProcessorCtx) -> AppResult<()> {
        let mut data: serde_json::Value = serde_json::from_slice(&work)
            .map_err(|e| AppError::Validation(format!("Invalid span JSON: {}", e)))?;

        // Mirrors Relay's DiscardReason::InvalidSpan — span_id and trace_id
        // are required for a standalone span to be accepted.
        let span_id = data
            .get("span_id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .ok_or_else(|| AppError::Validation("span missing span_id".to_string()))?;
        let trace_id = data
            .get("trace_id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .ok_or_else(|| AppError::Validation("span missing trace_id".to_string()))?;

        // Both timestamps are required for a standalone span — Relay's
        // `validate_standalone_span` rejects the span outright when either is
        // absent, so accepting it here would store rows Sentry would discard.
        let start_timestamp = extract_timestamp(&data, "start_timestamp")
            .ok_or_else(|| AppError::Validation("span missing start_timestamp".to_string()))?;
        let timestamp = extract_timestamp(&data, "timestamp")
            .ok_or_else(|| AppError::Validation("span missing timestamp".to_string()))?;

        // Mirrors Relay's DiscardReason::Timestamp.
        if start_timestamp > timestamp {
            return Err(AppError::Validation(
                "span start_timestamp is after timestamp".to_string(),
            ));
        }

        let duration_ms = (timestamp - start_timestamp)
            .num_microseconds()
            .map(|us| (us as f64 / 1000.0).max(0.0));
        // Relay's exclusive_time is already in milliseconds.
        let exclusive_time_ms = data.get("exclusive_time").and_then(|v| v.as_f64());

        let op = data.get("op").and_then(|v| v.as_str()).map(str::to_string);

        // gen_ai.* normalization + cost, on the span's own `data` attributes
        // bag. Mutates data["data"] in place, so must run before the other
        // fields are read as borrows and before the final `data` bind below.
        let gen_ai = match data.get_mut("data") {
            Some(span_data) => extract_gen_ai_columns(span_data, op.as_deref()),
            None => GenAiColumns::default(),
        };

        let parent_span_id = data
            .get("parent_span_id")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let description = data
            .get("description")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let status = data
            .get("status")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let segment_id = data
            .get("segment_id")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let is_segment = data
            .get("is_segment")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        // A standalone span has no parent transaction row to inherit these
        // from, so it carries its own (or they stay NULL).
        let platform = data
            .get("platform")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let release = data
            .get("release")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let environment = data
            .get("environment")
            .and_then(|v| v.as_str())
            .map(str::to_string);

        let tags = data.get("tags").cloned();

        sqlx::query(
            r#"
            INSERT INTO spans (
                id, transaction_id, project_id,
                span_id, trace_id, parent_span_id,
                op, description, status,
                start_timestamp, timestamp, duration_ms, exclusive_time_ms,
                is_segment, segment_id,
                platform, release, environment,
                tags, data,
                gen_ai_operation_type, gen_ai_agent_name,
                gen_ai_request_model, gen_ai_response_model,
                gen_ai_tool_name, gen_ai_conversation_id,
                gen_ai_usage_input_tokens, gen_ai_usage_output_tokens, gen_ai_usage_total_tokens
            ) VALUES (
                $1, NULL, $2,
                $3, $4, $5,
                $6, $7, $8,
                $9, $10, $11, $12,
                $13, $14,
                $15, $16, $17,
                $18, $19,
                $20, $21,
                $22, $23,
                $24, $25,
                $26, $27, $28
            )
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(ctx.project_id)
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
        .bind(platform)
        .bind(release)
        .bind(environment)
        .bind(tags)
        .bind(serde_json::json!(data))
        .bind(gen_ai.operation_type)
        .bind(gen_ai.agent_name)
        .bind(gen_ai.request_model)
        .bind(gen_ai.response_model)
        .bind(gen_ai.tool_name)
        .bind(gen_ai.conversation_id)
        .bind(gen_ai.usage_input_tokens)
        .bind(gen_ai.usage_output_tokens)
        .bind(gen_ai.usage_total_tokens)
        .execute(&ctx.pool)
        .await?;

        Ok(())
    }
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
