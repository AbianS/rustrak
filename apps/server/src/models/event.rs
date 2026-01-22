use chrono::{DateTime, Utc};
use ipnetwork::IpNetwork;
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

/// Event model - a single error occurrence
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Event {
    pub id: Uuid,
    pub event_id: Uuid,
    pub project_id: i32,
    pub issue_id: Uuid,
    pub grouping_id: i32,
    pub data: serde_json::Value,
    pub timestamp: DateTime<Utc>,
    pub ingested_at: DateTime<Utc>,
    pub digested_at: DateTime<Utc>,
    pub calculated_type: String,
    pub calculated_value: String,
    pub transaction: String,
    pub last_frame_filename: String,
    pub last_frame_module: String,
    pub last_frame_function: String,
    pub level: String,
    pub platform: String,
    pub release: String,
    pub environment: String,
    pub server_name: String,
    pub sdk_name: String,
    pub sdk_version: String,
    pub remote_addr: Option<IpNetwork>,
    pub digest_order: i32,
}

/// Response for API (list view)
#[derive(Debug, Serialize)]
pub struct EventResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub issue_id: Uuid,
    pub title: String,
    pub timestamp: DateTime<Utc>,
    pub level: String,
    pub platform: String,
    pub release: String,
    pub environment: String,
}

/// Response for API (full detail)
#[derive(Debug, Serialize)]
pub struct EventDetailResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub issue_id: Uuid,
    pub title: String,
    pub timestamp: DateTime<Utc>,
    pub ingested_at: DateTime<Utc>,
    pub level: String,
    pub platform: String,
    pub release: String,
    pub environment: String,
    pub server_name: String,
    pub sdk_name: String,
    pub sdk_version: String,
    pub data: serde_json::Value,
}

impl Event {
    /// Generates the event title from type and value
    pub fn title(&self) -> String {
        if self.calculated_value.is_empty() {
            self.calculated_type.clone()
        } else {
            let first_line = self.calculated_value.lines().next().unwrap_or("");
            format!("{}: {}", self.calculated_type, first_line)
        }
    }

    /// Converts to API response format (list view)
    pub fn to_response(&self) -> EventResponse {
        EventResponse {
            id: self.id,
            event_id: self.event_id,
            issue_id: self.issue_id,
            title: self.title(),
            timestamp: self.timestamp,
            level: self.level.clone(),
            platform: self.platform.clone(),
            release: self.release.clone(),
            environment: self.environment.clone(),
        }
    }

    /// Converts to API response format (full detail)
    pub fn to_detail_response(&self) -> EventDetailResponse {
        EventDetailResponse {
            id: self.id,
            event_id: self.event_id,
            issue_id: self.issue_id,
            title: self.title(),
            timestamp: self.timestamp,
            ingested_at: self.ingested_at,
            level: self.level.clone(),
            platform: self.platform.clone(),
            release: self.release.clone(),
            environment: self.environment.clone(),
            server_name: self.server_name.clone(),
            sdk_name: self.sdk_name.clone(),
            sdk_version: self.sdk_version.clone(),
            data: self.data.clone(),
        }
    }
}
