use chrono::{DateTime, Utc};
use sqlx::FromRow;

/// Installation singleton for global rate limiting state
/// Some fields are part of the DB model but not directly read in code
#[derive(Debug, Clone, FromRow)]
#[allow(dead_code)]
pub struct Installation {
    pub id: i32,
    pub digested_event_count: i64,
    pub quota_exceeded_until: Option<DateTime<Utc>>,
    pub quota_exceeded_reason: Option<String>,
    pub next_quota_check: i64,
    pub created_at: DateTime<Utc>,
}
