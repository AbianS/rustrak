use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Canonical issue status (Sentry-compatible).
pub const STATUS_UNRESOLVED: &str = "unresolved";
pub const STATUS_RESOLVED: &str = "resolved";
pub const STATUS_IGNORED: &str = "ignored";

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
    // Status model (replaces the old is_resolved/is_muted booleans).
    pub status: String,
    pub substatus: Option<String>,
    pub priority: Option<String>,
    pub priority_locked_at: Option<DateTime<Utc>>,
    pub culprit: String,
    pub logger: String,
    pub status_details: String,
    pub assigned_to: Option<i32>,
    pub assignee_type: Option<String>,
    pub issue_type: String,
    pub issue_category: String,
    pub first_release: String,
    pub last_release: String,
}

/// Response for API
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct IssueResponse {
    pub id: Uuid,
    pub project_id: i32,
    pub short_id: String,
    pub title: String,
    pub value: String,
    pub culprit: String,
    pub logger: String,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub event_count: i32,
    pub level: Option<String>,
    pub platform: Option<String>,
    pub status: String,
    pub substatus: Option<String>,
    pub priority: Option<String>,
    pub assigned_to: Option<i32>,
    pub assignee_type: Option<String>,
    pub issue_type: String,
    pub issue_category: String,
    pub first_release: String,
    pub last_release: String,
    pub status_details: serde_json::Value,
    /// Deprecated: derived from `status`. Kept for the legacy client/UI until
    /// they migrate to `status`. Remove in the client/frontend phases of #165.
    pub is_resolved: bool,
    /// Deprecated: derived from `status`. See `is_resolved`.
    pub is_muted: bool,
}

/// Request to update issue state.
///
/// `status`/`substatus`/`priority`/assignment are the canonical fields.
/// `is_resolved`/`is_muted` are accepted as a deprecated compatibility shim
/// and mapped onto `status`.
#[derive(Debug, Default, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateIssueState {
    pub status: Option<String>,
    pub substatus: Option<String>,
    pub priority: Option<String>,
    pub assigned_to: Option<i32>,
    pub assignee_type: Option<String>,
    // Deprecated compatibility fields.
    pub is_resolved: Option<bool>,
    pub is_muted: Option<bool>,
}

/// Bulk mutate request: apply a status (and/or priority) to many issues.
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct BulkUpdateIssues {
    pub ids: Vec<Uuid>,
    pub status: Option<String>,
    pub priority: Option<String>,
}

/// Bulk delete request: remove many issues by id.
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct BulkDeleteIssues {
    pub ids: Vec<Uuid>,
}

impl UpdateIssueState {
    /// Resolves the requested status, mapping the deprecated booleans when the
    /// canonical `status` field is absent. `is_resolved` wins over `is_muted`,
    /// matching the historical PATCH semantics.
    pub fn resolved_status(&self) -> Option<&'static str> {
        if let Some(status) = self.status.as_deref() {
            return match status {
                STATUS_RESOLVED => Some(STATUS_RESOLVED),
                STATUS_IGNORED => Some(STATUS_IGNORED),
                STATUS_UNRESOLVED => Some(STATUS_UNRESOLVED),
                _ => None,
            };
        }
        match (self.is_resolved, self.is_muted) {
            (Some(true), _) => Some(STATUS_RESOLVED),
            (Some(false), _) => Some(STATUS_UNRESOLVED),
            (None, Some(true)) => Some(STATUS_IGNORED),
            (None, Some(false)) => Some(STATUS_UNRESOLVED),
            (None, None) => None,
        }
    }
}

impl Issue {
    /// Whether the issue is resolved (derived from status).
    pub fn is_resolved(&self) -> bool {
        self.status == STATUS_RESOLVED
    }

    /// Whether the issue is muted/ignored (derived from status).
    pub fn is_muted(&self) -> bool {
        self.status == STATUS_IGNORED
    }

    /// Generates the issue title from type and value
    pub fn title(&self) -> String {
        if self.calculated_value.is_empty() {
            self.calculated_type.clone()
        } else {
            match self
                .calculated_value
                .lines()
                .map(|l| l.trim())
                .find(|l| !l.is_empty())
            {
                Some(first_line) => format!("{}: {}", self.calculated_type, first_line),
                None => self.calculated_type.clone(),
            }
        }
    }

    /// Generates the short_id (e.g., "PROJECT-1")
    pub fn short_id(&self, project_slug: &str) -> String {
        format!("{}-{}", project_slug.to_uppercase(), self.digest_order)
    }

    /// Converts to API response format
    pub fn to_response(&self, project_slug: &str) -> IssueResponse {
        let status_details = serde_json::from_str(&self.status_details)
            .unwrap_or(serde_json::Value::Object(Default::default()));

        IssueResponse {
            id: self.id,
            project_id: self.project_id,
            short_id: self.short_id(project_slug),
            title: self.title(),
            value: self.calculated_value.trim().to_string(),
            culprit: self.culprit.clone(),
            logger: self.logger.clone(),
            first_seen: self.first_seen,
            last_seen: self.last_seen,
            event_count: self.digested_event_count,
            level: self.level.clone(),
            platform: self.platform.clone(),
            status: self.status.clone(),
            substatus: self.substatus.clone(),
            priority: self.priority.clone(),
            assigned_to: self.assigned_to,
            assignee_type: self.assignee_type.clone(),
            issue_type: self.issue_type.clone(),
            issue_category: self.issue_category.clone(),
            first_release: self.first_release.clone(),
            last_release: self.last_release.clone(),
            status_details,
            is_resolved: self.is_resolved(),
            is_muted: self.is_muted(),
        }
    }
}
