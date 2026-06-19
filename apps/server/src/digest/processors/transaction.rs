use super::{Processor, ProcessorCtx};
use crate::error::{AppError, AppResult};
use chrono::{DateTime, TimeZone, Utc};
use uuid::Uuid;

pub struct TransactionProcessor;

impl Processor for TransactionProcessor {
    type Input = Vec<u8>;

    /// Store a transaction payload into `events`.
    /// Does NOT create an issue, grouping, or source-map rewrite.
    async fn process(&self, work: Vec<u8>, ctx: &ProcessorCtx) -> AppResult<()> {
        // Reject malformed payloads instead of persisting a null-data row.
        // The caller (ingest spawn) logs the error and discards — envelope still 200.
        let data: serde_json::Value = serde_json::from_slice(&work)
            .map_err(|e| AppError::Validation(format!("Invalid transaction JSON: {}", e)))?;

        let timestamp = extract_timestamp(&data, "timestamp").unwrap_or(ctx.ingested_at);
        let start_timestamp = extract_timestamp(&data, "start_timestamp");
        let transaction_name = data
            .get("transaction")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let spans: Option<serde_json::Value> = data.get("spans").cloned();

        let id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO events (
                id, event_id, project_id,
                issue_id, grouping_id,
                data, timestamp, ingested_at,
                event_type, start_timestamp, spans,
                calculated_type, calculated_value, "transaction",
                last_frame_filename, last_frame_module, last_frame_function,
                level, platform, release, environment, server_name,
                sdk_name, sdk_version, remote_addr, digest_order
            ) VALUES (
                $1, $2, $3,
                NULL, NULL,
                $4, $5, $6,
                'transaction', $7, $8,
                '', '', $9,
                '', '', '',
                'info', '', '', '', '',
                '', '', $10, 1
            )
            "#,
        )
        .bind(id)
        .bind(ctx.event_id)
        .bind(ctx.project_id)
        .bind(serde_json::json!(data))
        .bind(timestamp)
        .bind(ctx.ingested_at)
        .bind(start_timestamp)
        .bind(spans)
        .bind(transaction_name)
        .bind(ctx.remote_addr.as_deref())
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
