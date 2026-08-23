use super::{Processor, ProcessorCtx};
use crate::error::{AppError, AppResult};
use crate::services::gen_ai::{extract_gen_ai_columns, GenAiColumns};
use bytes::Bytes;
use chrono::{DateTime, TimeZone, Utc};
use uuid::Uuid;

pub struct SpanProcessor;

struct ParsedSpan {
    span_id: String,
    trace_id: String,
    start_timestamp: DateTime<Utc>,
    timestamp: DateTime<Utc>,
    duration_ms: Option<f64>,
    exclusive_time_ms: Option<f64>,
    op: Option<String>,
    gen_ai: GenAiColumns,
    parent_span_id: Option<String>,
    description: Option<String>,
    status: Option<String>,
    segment_id: Option<String>,
    is_segment: bool,
    platform: Option<String>,
    release: Option<String>,
    environment: Option<String>,
    tags: Option<serde_json::Value>,
    data: serde_json::Value,
}

/// Bound parsed-span memory while batching.
const SPAN_BATCH_CHUNK: usize = 64;

impl SpanProcessor {
    /// Parses and validates one standalone span payload (Relay's legacy
    /// "span" schema — one flat span object per envelope item).
    fn parse_item(work: &[u8]) -> AppResult<ParsedSpan> {
        let mut data: serde_json::Value = serde_json::from_slice(work)
            .map_err(|e| AppError::Validation(format!("Invalid span JSON: {e}")))?;

        // span_id and trace_id are required for a standalone span to be
        // accepted.
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

        // Both timestamps are required — Relay's `validate_standalone_span`
        // rejects the span outright when either is absent.
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

        Ok(ParsedSpan {
            span_id,
            trace_id,
            start_timestamp,
            timestamp,
            duration_ms,
            exclusive_time_ms,
            op,
            gen_ai,
            parent_span_id,
            description,
            status,
            segment_id,
            is_segment,
            platform,
            release,
            environment,
            tags,
            data,
        })
    }

    /// Writes one chunk in one transaction.
    async fn insert_all(&self, ctx: &ProcessorCtx, parsed: Vec<ParsedSpan>) -> AppResult<()> {
        let mut tx = ctx.pool.begin().await?;

        for item in parsed {
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
                gen_ai_usage_input_tokens, gen_ai_usage_output_tokens, gen_ai_usage_total_tokens,
                    gen_ai_usage_cached_input_tokens, gen_ai_usage_reasoning_output_tokens
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
                $26, $27, $28, $29, $30
            )
            ON CONFLICT (project_id, trace_id, span_id)
                WHERE transaction_id IS NULL
                  AND trace_id IS NOT NULL
                  AND span_id IS NOT NULL DO NOTHING
            "#,
            )
            .bind(Uuid::new_v4())
            .bind(ctx.project_id)
            .bind(item.span_id)
            .bind(item.trace_id)
            .bind(item.parent_span_id)
            .bind(item.op)
            .bind(item.description)
            .bind(item.status)
            .bind(item.start_timestamp)
            .bind(item.timestamp)
            .bind(item.duration_ms)
            .bind(item.exclusive_time_ms)
            .bind(item.is_segment)
            .bind(item.segment_id)
            .bind(item.platform)
            .bind(item.release)
            .bind(item.environment)
            .bind(item.tags)
            .bind(item.data)
            .bind(item.gen_ai.operation_type)
            .bind(item.gen_ai.agent_name)
            .bind(item.gen_ai.request_model)
            .bind(item.gen_ai.response_model)
            .bind(item.gen_ai.tool_name)
            .bind(item.gen_ai.conversation_id)
            .bind(item.gen_ai.usage_input_tokens)
            .bind(item.gen_ai.usage_output_tokens)
            .bind(item.gen_ai.usage_total_tokens)
            .bind(item.gen_ai.usage_cached_input_tokens)
            .bind(item.gen_ai.usage_reasoning_output_tokens)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    /// Writes items in transactions of at most [`SPAN_BATCH_CHUNK`],
    /// interleaving parse and write so only one chunk's trees are alive;
    /// malformed items are skipped (the old per-item tolerance).
    pub async fn process_batch(&self, items: Vec<Bytes>, ctx: &ProcessorCtx) -> AppResult<()> {
        let mut chunk: Vec<ParsedSpan> = Vec::with_capacity(SPAN_BATCH_CHUNK);
        for work in items {
            match Self::parse_item(&work) {
                Ok(item) => {
                    chunk.push(item);
                    if chunk.len() == SPAN_BATCH_CHUNK {
                        self.insert_all(ctx, std::mem::take(&mut chunk)).await?;
                    }
                }
                Err(e) => log::warn!("span item rejected: {e:?}"),
            }
        }
        if !chunk.is_empty() {
            self.insert_all(ctx, chunk).await?;
        }
        Ok(())
    }
}

impl Processor for SpanProcessor {
    type Input = Bytes;

    /// Stores a standalone span payload into `spans` with
    /// `transaction_id = NULL`. Mirrors `TransactionProcessor::insert_span`'s
    /// column extraction so both producers write a consistent row shape.
    /// Single items share the batched write path.
    async fn process(&self, work: Bytes, ctx: &ProcessorCtx) -> AppResult<()> {
        let item = Self::parse_item(&work)?;
        self.insert_all(ctx, vec![item]).await
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

#[cfg(test)]
mod tests {
    use super::SpanProcessor;

    #[test]
    fn parse_item_validates_shape() {
        assert!(SpanProcessor::parse_item(br#"{}"#).is_err());
        assert!(SpanProcessor::parse_item(
            br#"{"span_id":"s","trace_id":"t","start_timestamp":1.0,"timestamp":2.0}"#
        )
        .is_ok());
    }
}
