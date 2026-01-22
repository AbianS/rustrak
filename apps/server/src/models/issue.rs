use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Issue model - a group of similar events
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Issue {
    pub id: Uuid,
    pub project_id: i32,
    pub digest_order: i32,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub digested_event_count: i32,
    pub stored_event_count: i32,
    pub calculated_type: String,
    pub calculated_value: String,
    pub transaction: String,
    pub last_frame_filename: String,
    pub last_frame_module: String,
    pub last_frame_function: String,
    pub level: Option<String>,
    pub platform: Option<String>,
    pub is_resolved: bool,
    pub is_muted: bool,
    pub is_deleted: bool,
}

/// Response for API
#[derive(Debug, Serialize)]
pub struct IssueResponse {
    pub id: Uuid,
    pub project_id: i32,
    pub short_id: String,
    pub title: String,
    pub value: String,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub event_count: i32,
    pub level: Option<String>,
    pub platform: Option<String>,
    pub is_resolved: bool,
    pub is_muted: bool,
}

/// Request to update issue state
#[derive(Debug, Deserialize)]
pub struct UpdateIssueState {
    pub is_resolved: Option<bool>,
    pub is_muted: Option<bool>,
}

impl Issue {
    /// Generates the issue title from type and value
    pub fn title(&self) -> String {
        if self.calculated_value.is_empty() {
            self.calculated_type.clone()
        } else {
            let first_line = self.calculated_value.lines().next().unwrap_or("");
            format!("{}: {}", self.calculated_type, first_line)
        }
    }

    /// Generates the short_id (e.g., "PROJECT-1")
    pub fn short_id(&self, project_slug: &str) -> String {
        format!("{}-{}", project_slug.to_uppercase(), self.digest_order)
    }

    /// Converts to API response format
    pub fn to_response(&self, project_slug: &str) -> IssueResponse {
        IssueResponse {
            id: self.id,
            project_id: self.project_id,
            short_id: self.short_id(project_slug),
            title: self.title(),
            value: self.calculated_value.clone(),
            first_seen: self.first_seen,
            last_seen: self.last_seen,
            event_count: self.digested_event_count,
            level: self.level.clone(),
            platform: self.platform.clone(),
            is_resolved: self.is_resolved,
            is_muted: self.is_muted,
        }
    }
}
