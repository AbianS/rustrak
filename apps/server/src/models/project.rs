use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Project model for reading from the database
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Project {
    pub id: i32,
    pub name: String,
    pub slug: String,
    pub sentry_key: Uuid,
    pub stored_event_count: i32,
    pub digested_event_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Rate limiting fields
    #[serde(skip_serializing)]
    pub quota_exceeded_until: Option<DateTime<Utc>>,
    #[serde(skip_serializing)]
    #[allow(dead_code)] // Useful for debugging rate limit issues
    pub quota_exceeded_reason: Option<String>,
    #[serde(skip_serializing)]
    pub next_quota_check: i64,
}

/// DTO for creating a new project
#[derive(Debug, Deserialize)]
pub struct CreateProject {
    pub name: String,
    #[serde(default)]
    pub slug: Option<String>,
}

/// DTO for updating a project
#[derive(Debug, Deserialize)]
pub struct UpdateProject {
    pub name: Option<String>,
}

/// Response with DSN included
#[derive(Debug, Serialize)]
pub struct ProjectResponse {
    pub id: i32,
    pub name: String,
    pub slug: String,
    pub sentry_key: Uuid,
    pub dsn: String,
    pub stored_event_count: i32,
    pub digested_event_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Project {
    /// Builds the DSN for this project
    pub fn dsn(&self, base_url: &str) -> String {
        let key = self.sentry_key.simple().to_string();
        let host = base_url
            .trim_start_matches("http://")
            .trim_start_matches("https://");
        let scheme = if base_url.starts_with("https") {
            "https"
        } else {
            "http"
        };
        format!("{scheme}://{key}@{host}/{}", self.id)
    }

    /// Converts to ProjectResponse with DSN
    pub fn to_response(&self, base_url: &str) -> ProjectResponse {
        ProjectResponse {
            id: self.id,
            name: self.name.clone(),
            slug: self.slug.clone(),
            sentry_key: self.sentry_key,
            dsn: self.dsn(base_url),
            stored_event_count: self.stored_event_count,
            digested_event_count: self.digested_event_count,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}
