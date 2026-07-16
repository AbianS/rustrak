use super::{Processor, ProcessorCtx};
use crate::error::{AppError, AppResult};
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
        let data: serde_json::Value = serde_json::from_slice(&work)
            .map_err(|e| AppError::Validation(format!("Invalid span JSON: {}", e)))?;

        // Mirrors Relay's DiscardReason::InvalidSpan — span_id and trace_id
        // are required for a standalone span to be accepted.
        let span_id = data
            .get("span_id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| AppError::Validation("span missing span_id".to_string()))?;
        let trace_id = data
            .get("trace_id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| AppError::Validation("span missing trace_id".to_string()))?;

        let start_timestamp = extract_timestamp(&data, "start_timestamp");
        let timestamp = extract_timestamp(&data, "timestamp");

        // Mirrors Relay's DiscardReason::Timestamp.
        if let (Some(st), Some(ts)) = (start_timestamp, timestamp) {
            if st > ts {
                return Err(AppError::Validation(
                    "span start_timestamp is after timestamp".to_string(),
                ));
            }
        }

        let duration_ms = match (start_timestamp, timestamp) {
            (Some(st), Some(ts)) => (ts - st)
                .num_microseconds()
                .map(|us| (us as f64 / 1000.0).max(0.0)),
            _ => None,
        };
        // Relay's exclusive_time is already in milliseconds.
        let exclusive_time_ms = data.get("exclusive_time").and_then(|v| v.as_f64());

        let parent_span_id = data.get("parent_span_id").and_then(|v| v.as_str());
        let op = data.get("op").and_then(|v| v.as_str());
        let description = data.get("description").and_then(|v| v.as_str());
        let status = data.get("status").and_then(|v| v.as_str());
        let segment_id = data.get("segment_id").and_then(|v| v.as_str());
        let is_segment = data
            .get("is_segment")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        // A standalone span has no parent transaction row to inherit these
        // from, so it carries its own (or they stay NULL).
        let platform = data.get("platform").and_then(|v| v.as_str());
        let release = data.get("release").and_then(|v| v.as_str());
        let environment = data.get("environment").and_then(|v| v.as_str());

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
                tags, data
            ) VALUES (
                $1, NULL, $2,
                $3, $4, $5,
                $6, $7, $8,
                $9, $10, $11, $12,
                $13, $14,
                $15, $16, $17,
                $18, $19
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
