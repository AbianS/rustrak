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
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateProject {
    pub name: String,
    #[serde(default)]
    pub slug: Option<String>,
}

/// DTO for updating a project
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateProject {
    pub name: Option<String>,
}

/// Response with DSN included
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn make_project(id: i32, key: Uuid) -> Project {
        Project {
            id,
            name: "Test Project".to_string(),
            slug: "test-project".to_string(),
            sentry_key: key,
            stored_event_count: 0,
            digested_event_count: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            quota_exceeded_until: None,
            quota_exceeded_reason: None,
            next_quota_check: 0,
        }
    }

    #[test]
    fn test_dsn_with_https_base_url() {
        let key = Uuid::new_v4();
        let project = make_project(1, key);
        let dsn = project.dsn("https://api.example.com");
        assert!(
            dsn.starts_with("https://"),
            "DSN should start with https://"
        );
        assert!(
            dsn.contains("api.example.com"),
            "DSN should contain api.example.com"
        );
    }

    #[test]
    fn test_dsn_with_http_base_url() {
        let key = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let project = make_project(1, key);
        let dsn = project.dsn("http://192.168.1.10:9090");
        let key_str = key.simple().to_string();
        assert_eq!(dsn, format!("http://{}@192.168.1.10:9090/1", key_str));
    }

    #[test]
    fn test_dsn_fallback_no_scheme() {
        let key = Uuid::new_v4();
        let project = make_project(1, key);
        let dsn = project.dsn("0.0.0.0:8080");
        assert!(dsn.starts_with("http://"), "DSN should start with http://");
        assert!(
            dsn.contains("0.0.0.0:8080"),
            "DSN should contain 0.0.0.0:8080"
        );
    }
}
