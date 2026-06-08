//! Centralized project access control.
//!
//! Global admins bypass every check. For members, access is governed by their
//! per-project role on the `viewer < editor < admin` ladder. Non-members get
//! `NotFound` (404) rather than `Forbidden` so project existence is not leaked.

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::ProjectRole;
use crate::services::ProjectMemberService;

/// An action a user may attempt against a project.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    /// Read the project, its issues and events.
    ViewProject,
    /// Resolve/mute/delete issues.
    MutateIssue,
    /// Update project settings (name, alerts, source maps).
    UpdateProject,
    /// Delete the project.
    DeleteProject,
    /// Add/remove/change project members.
    ManageMembers,
}

impl Action {
    /// Minimum project role that may perform this action.
    pub fn min_role(self) -> ProjectRole {
        match self {
            Action::ViewProject => ProjectRole::Viewer,
            Action::MutateIssue => ProjectRole::Editor,
            Action::UpdateProject => ProjectRole::Editor,
            Action::DeleteProject => ProjectRole::Admin,
            Action::ManageMembers => ProjectRole::Admin,
        }
    }
}

/// Pure ladder check: does this project role satisfy the action?
pub fn role_satisfies(role: ProjectRole, action: Action) -> bool {
    role >= action.min_role()
}

/// Enforce that an actor may perform `action` on `project_id`.
///
/// - Global admin (`is_admin == true`, includes legacy user-less tokens) → always `Ok`.
/// - Member with a sufficient project role → `Ok`.
/// - Member with an insufficient role → `Err(Forbidden)`.
/// - Non-member → `Err(NotFound)` (don't leak existence).
pub async fn require(
    pool: &DbPool,
    is_admin: bool,
    user_id: Option<i32>,
    project_id: i32,
    action: Action,
) -> AppResult<()> {
    if is_admin {
        return Ok(());
    }

    let user_id = user_id.ok_or_else(|| AppError::Unauthorized("Not authenticated".to_string()))?;

    match ProjectMemberService::get_role(pool, project_id, user_id).await? {
        None => Err(AppError::NotFound(format!(
            "Project {} not found",
            project_id
        ))),
        Some(role) if role_satisfies(role, action) => Ok(()),
        Some(_) => Err(AppError::Forbidden(
            "Insufficient project role for this action".to_string(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn viewer_can_only_view() {
        assert!(role_satisfies(ProjectRole::Viewer, Action::ViewProject));
        assert!(!role_satisfies(ProjectRole::Viewer, Action::MutateIssue));
        assert!(!role_satisfies(ProjectRole::Viewer, Action::UpdateProject));
        assert!(!role_satisfies(ProjectRole::Viewer, Action::DeleteProject));
        assert!(!role_satisfies(ProjectRole::Viewer, Action::ManageMembers));
    }

    #[test]
    fn editor_can_mutate_and_update_but_not_admin_actions() {
        assert!(role_satisfies(ProjectRole::Editor, Action::ViewProject));
        assert!(role_satisfies(ProjectRole::Editor, Action::MutateIssue));
        assert!(role_satisfies(ProjectRole::Editor, Action::UpdateProject));
        assert!(!role_satisfies(ProjectRole::Editor, Action::DeleteProject));
        assert!(!role_satisfies(ProjectRole::Editor, Action::ManageMembers));
    }

    #[test]
    fn project_admin_can_do_everything() {
        for action in [
            Action::ViewProject,
            Action::MutateIssue,
            Action::UpdateProject,
            Action::DeleteProject,
            Action::ManageMembers,
        ] {
            assert!(role_satisfies(ProjectRole::Admin, action));
        }
    }
}
