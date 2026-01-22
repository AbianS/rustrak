use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

/// Grouping model - maps a grouping key to an issue
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Grouping {
    pub id: i32,
    pub project_id: i32,
    pub issue_id: Uuid,
    pub grouping_key: String,
    pub grouping_key_hash: String,
    pub created_at: DateTime<Utc>,
}
