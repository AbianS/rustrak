use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{ProjectMember, ProjectMemberResponse, ProjectRole};

pub struct ProjectMemberService;

impl ProjectMemberService {
    /// Returns the member's per-project role, if they belong to the project.
    pub async fn get_role(
        pool: &DbPool,
        project_id: i32,
        user_id: i32,
    ) -> AppResult<Option<ProjectRole>> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
        )
        .bind(project_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

        Ok(row.map(|(r,)| ProjectRole::from_db(&r)))
    }

    /// Lists the members of a project with their emails.
    pub async fn list_for_project(
        pool: &DbPool,
        project_id: i32,
    ) -> AppResult<Vec<ProjectMemberResponse>> {
        let members = sqlx::query_as::<_, ProjectMemberResponse>(
            r#"
            SELECT pm.user_id, u.email, pm.role, pm.created_at
            FROM project_members pm
            JOIN users u ON u.id = pm.user_id
            WHERE pm.project_id = $1
            ORDER BY pm.created_at ASC
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        Ok(members)
    }

    /// Project ids a member can access (used to filter list endpoints for non-admins).
    pub async fn accessible_project_ids(pool: &DbPool, user_id: i32) -> AppResult<Vec<i32>> {
        let rows: Vec<(i32,)> =
            sqlx::query_as("SELECT project_id FROM project_members WHERE user_id = $1")
                .bind(user_id)
                .fetch_all(pool)
                .await?;

        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// Number of members with the project `admin` role.
    pub async fn admin_count(pool: &DbPool, project_id: i32) -> AppResult<i64> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM project_members WHERE project_id = $1 AND role = 'admin'",
        )
        .bind(project_id)
        .fetch_one(pool)
        .await?;

        Ok(count.0)
    }

    /// Adds a member or updates their role. Prevents orphaning the last project admin
    /// when an existing admin is downgraded.
    pub async fn upsert(
        pool: &DbPool,
        project_id: i32,
        user_id: i32,
        role: ProjectRole,
    ) -> AppResult<ProjectMember> {
        if role != ProjectRole::Admin {
            if let Some(ProjectRole::Admin) = Self::get_role(pool, project_id, user_id).await? {
                if Self::admin_count(pool, project_id).await? <= 1 {
                    return Err(AppError::Conflict(
                        "Cannot downgrade the last project admin".to_string(),
                    ));
                }
            }
        }

        let member = sqlx::query_as::<_, ProjectMember>(
            r#"
            INSERT INTO project_members (project_id, user_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
            RETURNING id, project_id, user_id, role, created_at
            "#,
        )
        .bind(project_id)
        .bind(user_id)
        .bind(role.as_str())
        .fetch_one(pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::Database(db_err) if db_err.is_foreign_key_violation() => {
                AppError::NotFound("Project or user not found".to_string())
            }
            other => other.into(),
        })?;

        Ok(member)
    }

    /// Removes a member from a project. Refuses to remove the last project admin.
    pub async fn remove(pool: &DbPool, project_id: i32, user_id: i32) -> AppResult<()> {
        if let Some(ProjectRole::Admin) = Self::get_role(pool, project_id, user_id).await? {
            if Self::admin_count(pool, project_id).await? <= 1 {
                return Err(AppError::Conflict(
                    "Cannot remove the last project admin".to_string(),
                ));
            }
        }

        let result =
            sqlx::query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2")
                .bind(project_id)
                .bind(user_id)
                .execute(pool)
                .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Membership not found".to_string()));
        }

        Ok(())
    }
}
