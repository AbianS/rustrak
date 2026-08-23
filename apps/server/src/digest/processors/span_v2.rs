use super::{Processor, ProcessorCtx};
use crate::error::AppResult;
use crate::models::span_v2::{parse_span_v2_container, SpanV2Entry};
use crate::services::gen_ai::extract_gen_ai_columns;
use chrono::{DateTime, TimeZone, Utc};
use uuid::Uuid;

pub struct SpanV2Processor;

impl Processor for SpanV2Processor {
    type Input = Vec<u8>;

    /// Stores a Spans Protocol v2 batch (Sentry "span" item type,
    /// `application/vnd.sentry.items.span.v2+json`) into the shared `spans`
    /// table, one row per entry, with `transaction_id = NULL` — same
    /// destination as legacy standalone spans ([`super::SpanProcessor`]),
    /// just a different (batched, typed-attribute) wire format. Mirrors
    /// `LogsProcessor`'s container-expansion + single-transaction-batch
    /// pattern.
    async fn process(&self, work: Vec<u8>, ctx: &ProcessorCtx) -> AppResult<()> {
        let entries = parse_span_v2_container(&work)?;

        let mut tx = ctx.pool.begin().await?;

        for entry in entries {
            // Mirrors the legacy SpanProcessor's validation (Relay's
            // DiscardReason::InvalidSpan/Timestamp) — skip only this entry,
            // not the whole batch, since a batch can carry multiple
            // independent spans.
            if entry.span_id.is_empty() || entry.trace_id.is_empty() {
                log::warn!("span v2 entry missing span_id/trace_id, skipping");
                continue;
            }
            // Both timestamps are required on the wire, and start must not be
            // after end. Mirrors Relay's `validate_timestamps` exactly,
            // including that `start == end` is valid
            // (relay-server/src/processing/spans/process.rs:367).
            let (Some(start_epoch), Some(end_epoch)) = (entry.start_timestamp, entry.end_timestamp)
            else {
                log::warn!("span v2 entry missing start_timestamp/end_timestamp, skipping");
                continue;
            };
            if start_epoch > end_epoch {
                log::warn!("span v2 entry start_timestamp is after end_timestamp, skipping");
                continue;
            }

            let mut flat = entry.flat_attributes();
            let op = SpanV2Entry::op(&flat);

            // gen_ai.* normalization — same shared entry point as the legacy
            // standalone-span and transaction-embedded producers. Mutates
            // `flat` in place so the raw `data` JSONB column stays
            // consistent with what was normalized.
            let gen_ai = extract_gen_ai_columns(&mut flat, op.as_deref());

            let Some(start_timestamp) = epoch_to_datetime(start_epoch) else {
                log::warn!("span v2 entry has invalid start_timestamp, skipping");
                continue;
            };
            let Some(timestamp) = epoch_to_datetime(end_epoch) else {
                log::warn!("span v2 entry has invalid end_timestamp, skipping");
                continue;
            };
            let duration_ms = (timestamp - start_timestamp)
                .num_microseconds()
                .map(|us| (us as f64 / 1000.0).max(0.0));

            // What the legacy schema kept as top-level span fields, v2 carries
            // as `sentry.*` attributes — read after gen_ai normalization so the
            // columns agree with the stored `data` bag.
            let segment_id = entry.segment_id(&flat);
            let exclusive_time_ms = SpanV2Entry::exclusive_time_ms(&flat);
            let platform = SpanV2Entry::platform(&flat);
            let release = SpanV2Entry::release(&flat);
            let environment = SpanV2Entry::environment(&flat);

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
            .bind(&entry.span_id)
            .bind(&entry.trace_id)
            .bind(entry.parent_span_id.clone())
            .bind(op)
            .bind(entry.name.clone())
            .bind(entry.status.clone())
            .bind(start_timestamp)
            .bind(timestamp)
            .bind(duration_ms)
            .bind(exclusive_time_ms)
            .bind(entry.is_segment)
            .bind(segment_id)
            .bind(platform)
            .bind(release)
            .bind(environment)
            .bind(None::<serde_json::Value>) // tags — v2 has no separate tags concept, everything lives in attributes
            .bind(serde_json::json!(flat))
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
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }
}

/// Converts an epoch-seconds float (v2's `start_timestamp`/`end_timestamp`)
/// to a UTC instant. `0.0` (serde's `#[serde(default)]` fallback for a
/// missing field) is treated as absent, matching `LogsProcessor`'s
/// `epoch_to_datetime`.
fn epoch_to_datetime(epoch: f64) -> Option<DateTime<Utc>> {
    if !epoch.is_finite() || epoch <= 0.0 {
        return None;
    }
    let secs = epoch.floor() as i64;
    let nanos = ((epoch - epoch.floor()) * 1_000_000_000.0) as u32;
    Utc.timestamp_opt(secs, nanos).single()
}
