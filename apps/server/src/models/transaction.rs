use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

/// Response model for a single transaction in the list view
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct TransactionResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub transaction_name: String,
    pub timestamp: DateTime<Utc>,
    pub start_timestamp: Option<DateTime<Utc>>,
    /// Duration in milliseconds (timestamp - start_timestamp). None if start_timestamp is missing.
    pub duration_ms: Option<f64>,
    pub platform: String,
    pub environment: String,
    pub release: String,
    pub ingested_at: DateTime<Utc>,
}

/// Response model for a single transaction detail view.
///
/// Carries the same summary fields as [`TransactionResponse`] plus the full
/// Sentry payload under `data` (spans, contexts.trace, measurements, tags,
/// request, user). The frontend builds the span waterfall and metrics view
/// from `data`.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct TransactionDetailResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub transaction_name: String,
    pub timestamp: DateTime<Utc>,
    pub start_timestamp: Option<DateTime<Utc>>,
    /// Duration in milliseconds (timestamp - start_timestamp). None if start_timestamp is missing.
    pub duration_ms: Option<f64>,
    pub platform: String,
    pub environment: String,
    pub release: String,
    pub ingested_at: DateTime<Utc>,
    /// Full Sentry transaction payload (spans, contexts, measurements, tags, request, user).
    pub data: serde_json::Value,
}
