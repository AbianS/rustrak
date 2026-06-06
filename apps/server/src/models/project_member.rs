use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Per-project capability level for a member.
///
/// Ordered by privilege: `Viewer` < `Editor` < `Admin` (derived `Ord` uses
/// declaration order). An `Action` maps to the minimum role that may perform it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProjectRole {
    Viewer,
    Editor,
    Admin,
}

impl ProjectRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectRole::Viewer => "viewer",
            ProjectRole::Editor => "editor",
            ProjectRole::Admin => "admin",
        }
    }

    /// Strict parse used when validating untrusted input (e.g. request bodies).
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "viewer" => Some(ProjectRole::Viewer),
            "editor" => Some(ProjectRole::Editor),
            "admin" => Some(ProjectRole::Admin),
            _ => None,
        }
    }

    /// Lenient parse from the DB string; unknown falls back to least privilege.
    pub fn from_db(s: &str) -> Self {
        ProjectRole::parse(s).unwrap_or(ProjectRole::Viewer)
    }
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct ProjectMember {
    pub id: i32,
    pub project_id: i32,
    pub user_id: i32,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

impl ProjectMember {
    pub fn role(&self) -> ProjectRole {
        ProjectRole::from_db(&self.role)
    }
}

/// Member row joined with the user's email, for listing a project's team.
#[derive(Debug, Clone, FromRow, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ProjectMemberResponse {
    pub user_id: i32,
    pub email: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpsertProjectMember {
    pub user_id: i32,
    pub role: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_role_ladder_is_viewer_lt_editor_lt_admin() {
        assert!(ProjectRole::Viewer < ProjectRole::Editor);
        assert!(ProjectRole::Editor < ProjectRole::Admin);
        assert!(ProjectRole::Viewer < ProjectRole::Admin);
    }

    #[test]
    fn strict_parse_rejects_unknown() {
        assert_eq!(ProjectRole::parse("editor"), Some(ProjectRole::Editor));
        assert_eq!(ProjectRole::parse("owner"), None);
    }

    #[test]
    fn from_db_falls_back_to_viewer() {
        assert_eq!(ProjectRole::from_db("garbage"), ProjectRole::Viewer);
    }
}
