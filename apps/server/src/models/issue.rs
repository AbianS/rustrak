use crate::error::{AppError, AppResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Canonical issue substatus values (Sentry-compatible). See
/// `docs/sentry-compat/issue-165-roadmap.md` for the full 7-value set this
/// project already committed to.
pub const SUBSTATUS_ONGOING: &str = "ongoing";
pub const SUBSTATUS_ESCALATING: &str = "escalating";
pub const SUBSTATUS_REGRESSED: &str = "regressed";
pub const SUBSTATUS_NEW: &str = "new";
pub const SUBSTATUS_ARCHIVED_UNTIL_ESCALATING: &str = "archived_until_escalating";
pub const SUBSTATUS_ARCHIVED_UNTIL_CONDITION_MET: &str = "archived_until_condition_met";
pub const SUBSTATUS_ARCHIVED_FOREVER: &str = "archived_forever";

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
    /// Only populated by the single-issue GET endpoint.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_report_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_bookmarked: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_subscribed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_seen: Option<bool>,
    /// Only populated by the issue list endpoint (bulk-computed per page).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_count: Option<i64>,
    /// 24 hourly buckets, oldest to newest. Only populated by the issue list
    /// endpoint.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trend: Option<Vec<i64>>,
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
    /// `None` when omitted, `Some(None)` when the client sent an explicit
    /// `null` (clears the assignment), `Some(Some(id))` to assign.
    #[serde(default, deserialize_with = "deserialize_some")]
    pub assigned_to: Option<Option<i32>>,
    #[serde(default, deserialize_with = "deserialize_some")]
    pub assignee_type: Option<Option<String>>,
    // Deprecated compatibility fields.
    pub is_resolved: Option<bool>,
    pub is_muted: Option<bool>,
}

/// Wraps a field's normal deserialization in `Some`, so a present JSON value
/// (including explicit `null`) is distinguishable from the field being
/// omitted entirely, which leaves the outer `Option` at its `#[serde(default)]`.
fn deserialize_some<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    T: Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    T::deserialize(deserializer).map(Some)
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
    ///
    /// A `status` that is present but not one of the recognized literals is a
    /// client error, not a no-op — callers must reject the request rather
    /// than silently leaving the issue unchanged.
    pub fn resolved_status(&self) -> AppResult<Option<&'static str>> {
        if let Some(status) = self.status.as_deref() {
            return match status {
                STATUS_RESOLVED => Ok(Some(STATUS_RESOLVED)),
                STATUS_IGNORED => Ok(Some(STATUS_IGNORED)),
                STATUS_UNRESOLVED => Ok(Some(STATUS_UNRESOLVED)),
                other => Err(AppError::Validation(format!("Invalid status: {}", other))),
            };
        }
        Ok(match (self.is_resolved, self.is_muted) {
            (Some(true), _) => Some(STATUS_RESOLVED),
            (Some(false), _) => Some(STATUS_UNRESOLVED),
            (None, Some(true)) => Some(STATUS_IGNORED),
            (None, Some(false)) => Some(STATUS_UNRESOLVED),
            (None, None) => None,
        })
    }

    /// Validates the requested substatus, if present, against the canonical
    /// set of allowed values (Sentry-compatible).
    pub fn validated_substatus(&self) -> AppResult<Option<&str>> {
        match self.substatus.as_deref() {
            None => Ok(None),
            Some(
                s @ (SUBSTATUS_ONGOING
                | SUBSTATUS_ESCALATING
                | SUBSTATUS_REGRESSED
                | SUBSTATUS_NEW
                | SUBSTATUS_ARCHIVED_UNTIL_ESCALATING
                | SUBSTATUS_ARCHIVED_UNTIL_CONDITION_MET
                | SUBSTATUS_ARCHIVED_FOREVER),
            ) => Ok(Some(s)),
            Some(other) => Err(AppError::Validation(format!(
                "Invalid substatus: {}",
                other
            ))),
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
            user_report_count: None,
            is_bookmarked: None,
            is_subscribed: None,
            has_seen: None,
            user_count: None,
            trend: None,
        }
    }
}
