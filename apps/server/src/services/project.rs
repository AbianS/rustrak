use slug::slugify;
use sqlx::PgPool;

use crate::error::{AppError, AppResult};
use crate::models::{CreateProject, Project, UpdateProject};
use crate::pagination::SortOrder;

pub struct ProjectService;

impl ProjectService {
    /// Lists all projects
    pub async fn list(pool: &PgPool) -> AppResult<Vec<Project>> {
        let projects = sqlx::query_as::<_, Project>(
            r#"
            SELECT id, name, slug, sentry_key, stored_event_count,
                   digested_event_count, created_at, updated_at,
                   quota_exceeded_until, quota_exceeded_reason, next_quota_check
            FROM projects
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(projects)
    }

    /// Lists projects with offset-based pagination
    pub async fn list_offset(
        pool: &PgPool,
        order: SortOrder,
        page: i64,
        per_page: i64,
    ) -> AppResult<(Vec<Project>, i64)> {
        let offset = (page - 1) * per_page;

        // Get total count
        let total_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM projects")
            .fetch_one(pool)
            .await?;

        // Build ORDER BY clause
        let order_clause = match order {
            SortOrder::Asc => "ORDER BY created_at ASC",
            SortOrder::Desc => "ORDER BY created_at DESC",
        };

        let query = format!(
            r#"
            SELECT id, name, slug, sentry_key, stored_event_count,
                   digested_event_count, created_at, updated_at,
                   quota_exceeded_until, quota_exceeded_reason, next_quota_check
            FROM projects
            {}
            LIMIT $1 OFFSET $2
            "#,
            order_clause
        );

        let projects = sqlx::query_as::<_, Project>(&query)
            .bind(per_page)
            .bind(offset)
            .fetch_all(pool)
            .await?;

        Ok((projects, total_count.0))
    }

    /// Gets a project by ID
    pub async fn get_by_id(pool: &PgPool, id: i32) -> AppResult<Project> {
        let project = sqlx::query_as::<_, Project>(
            r#"
            SELECT id, name, slug, sentry_key, stored_event_count,
                   digested_event_count, created_at, updated_at,
                   quota_exceeded_until, quota_exceeded_reason, next_quota_check
            FROM projects
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Project with id {} not found", id)))?;

        Ok(project)
    }

    /// Gets a project by sentry_key (for authentication)
    ///
    /// NOTE: Currently unused but kept for future API token scoping feature
    /// where tokens can be restricted to specific projects via sentry_key lookup.
    #[allow(dead_code)]
    pub async fn get_by_sentry_key(pool: &PgPool, sentry_key: &uuid::Uuid) -> AppResult<Project> {
        let project = sqlx::query_as::<_, Project>(
            r#"
            SELECT id, name, slug, sentry_key, stored_event_count,
                   digested_event_count, created_at, updated_at,
                   quota_exceeded_until, quota_exceeded_reason, next_quota_check
            FROM projects
            WHERE sentry_key = $1
            "#,
        )
        .bind(sentry_key)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

        Ok(project)
    }

    /// Creates a new project
    pub async fn create(pool: &PgPool, input: CreateProject) -> AppResult<Project> {
        // Validate name
        let name = input.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("Name cannot be empty".to_string()));
        }
        if name.len() > 255 {
            return Err(AppError::Validation(
                "Name cannot exceed 255 characters".to_string(),
            ));
        }

        // Generate or validate slug
        let slug = Self::generate_unique_slug(pool, name, input.slug.as_deref()).await?;

        // Insert project (sentry_key is auto-generated in DB)
        let project = sqlx::query_as::<_, Project>(
            r#"
            INSERT INTO projects (name, slug)
            VALUES ($1, $2)
            RETURNING id, name, slug, sentry_key, stored_event_count,
                      digested_event_count, created_at, updated_at,
                      quota_exceeded_until, quota_exceeded_reason, next_quota_check
            "#,
        )
        .bind(name)
        .bind(&slug)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.constraint() == Some("projects_name_key") {
                    return AppError::Conflict(format!(
                        "Project with name '{}' already exists",
                        name
                    ));
                }
                if db_err.constraint() == Some("projects_slug_key") {
                    return AppError::Conflict(format!(
                        "Project with slug '{}' already exists",
                        slug
                    ));
                }
            }
            AppError::Database(e)
        })?;

        Ok(project)
    }

    /// Updates an existing project
    pub async fn update(pool: &PgPool, id: i32, input: UpdateProject) -> AppResult<Project> {
        // Verify it exists
        Self::get_by_id(pool, id).await?;

        // Build query dynamically based on present fields
        if let Some(ref name) = input.name {
            let name = name.trim();
            if name.is_empty() {
                return Err(AppError::Validation("Name cannot be empty".to_string()));
            }
            if name.len() > 255 {
                return Err(AppError::Validation(
                    "Name cannot exceed 255 characters".to_string(),
                ));
            }

            let project = sqlx::query_as::<_, Project>(
                r#"
                UPDATE projects SET name = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING id, name, slug, sentry_key, stored_event_count,
                          digested_event_count, created_at, updated_at,
                          quota_exceeded_until, quota_exceeded_reason, next_quota_check
                "#,
            )
            .bind(name)
            .bind(id)
            .fetch_one(pool)
            .await
            .map_err(|e| {
                if let sqlx::Error::Database(ref db_err) = e {
                    if db_err.constraint() == Some("projects_name_key") {
                        return AppError::Conflict(format!(
                            "Project with name '{}' already exists",
                            name
                        ));
                    }
                }
                AppError::Database(e)
            })?;

            return Ok(project);
        }

        // If no fields to update, return project unchanged
        Self::get_by_id(pool, id).await
    }

    /// Deletes a project (hard delete)
    pub async fn delete(pool: &PgPool, id: i32) -> AppResult<()> {
        let result = sqlx::query("DELETE FROM projects WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(format!(
                "Project with id {} not found",
                id
            )));
        }

        Ok(())
    }

    /// Generates a unique slug based on the name
    async fn generate_unique_slug(
        pool: &PgPool,
        name: &str,
        custom_slug: Option<&str>,
    ) -> AppResult<String> {
        let base_slug = match custom_slug {
            Some(s) if !s.trim().is_empty() => slugify(s.trim()),
            _ => slugify(name),
        };

        if base_slug.is_empty() {
            return Err(AppError::Validation(
                "Cannot generate valid slug from name".to_string(),
            ));
        }

        // Find similar slugs
        let similar_slugs: Vec<String> =
            sqlx::query_scalar("SELECT slug FROM projects WHERE slug LIKE $1 || '%'")
                .bind(&base_slug)
                .fetch_all(pool)
                .await?;

        if !similar_slugs.contains(&base_slug) {
            return Ok(base_slug);
        }

        // Find the next available number
        let mut counter = 1;
        loop {
            let candidate = format!("{}-{}", base_slug, counter);
            if !similar_slugs.contains(&candidate) {
                return Ok(candidate);
            }
            counter += 1;
            if counter > 1000 {
                return Err(AppError::Internal(
                    "Could not generate unique slug".to_string(),
                ));
            }
        }
    }
}
