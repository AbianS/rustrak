use slug::slugify;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{CreateProject, Project, UpdateProject, VALID_PLATFORMS};
use crate::pagination::SortOrder;

pub struct ProjectService;

impl ProjectService {
    /// Lists all projects
    pub async fn list(pool: &DbPool) -> AppResult<Vec<Project>> {
        let projects = sqlx::query_as::<_, Project>(
            r#"
            SELECT id, name, slug, sentry_key, stored_event_count,
                   digested_event_count, created_at, updated_at, platform,
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
        pool: &DbPool,
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
                   digested_event_count, created_at, updated_at, platform,
                   quota_exceeded_until, quota_exceeded_reason, next_quota_check
            FROM projects
            {}
            LIMIT $1 OFFSET $2
            "#,
            order_clause
        );

        let projects = sqlx::query_as::<_, Project>(sqlx::AssertSqlSafe(&*query))
            .bind(per_page)
            .bind(offset)
            .fetch_all(pool)
            .await?;

        Ok((projects, total_count.0))
    }

    /// Lists projects with offset-based pagination, restricted to the given ids.
    ///
    /// Used to scope the project list for non-admin members to only the projects
    /// they belong to. If `ids` is empty, returns `(vec![], 0)` without issuing a
    /// query (avoids an invalid `IN ()` clause).
    pub async fn list_offset_for_ids(
        pool: &DbPool,
        ids: &[i32],
        order: SortOrder,
        page: i64,
        per_page: i64,
    ) -> AppResult<(Vec<Project>, i64)> {
        if ids.is_empty() {
            return Ok((Vec::new(), 0));
        }

        let offset = (page - 1) * per_page;

        // Build a parameterized IN list ($1, $2, ...). Bind params start at $1
        // for the ids; LIMIT/OFFSET come after.
        let placeholders: Vec<String> = (1..=ids.len()).map(|i| format!("${}", i)).collect();
        let in_clause = placeholders.join(", ");
        let limit_param = ids.len() + 1;
        let offset_param = ids.len() + 2;

        let order_clause = match order {
            SortOrder::Asc => "ORDER BY created_at ASC",
            SortOrder::Desc => "ORDER BY created_at DESC",
        };

        let count_query = format!("SELECT COUNT(*) FROM projects WHERE id IN ({})", in_clause);
        let mut count_q = sqlx::query_as::<_, (i64,)>(sqlx::AssertSqlSafe(&*count_query));
        for id in ids {
            count_q = count_q.bind(id);
        }
        let total_count: (i64,) = count_q.fetch_one(pool).await?;

        let query = format!(
            r#"
            SELECT id, name, slug, sentry_key, stored_event_count,
                   digested_event_count, created_at, updated_at, platform,
                   quota_exceeded_until, quota_exceeded_reason, next_quota_check
            FROM projects
            WHERE id IN ({})
            {}
            LIMIT ${} OFFSET ${}
            "#,
            in_clause, order_clause, limit_param, offset_param
        );

        let mut q = sqlx::query_as::<_, Project>(sqlx::AssertSqlSafe(&*query));
        for id in ids {
            q = q.bind(id);
        }
        let projects = q.bind(per_page).bind(offset).fetch_all(pool).await?;

        Ok((projects, total_count.0))
    }

    /// Gets a project by ID
    pub async fn get_by_id(pool: &DbPool, id: i32) -> AppResult<Project> {
        let project = sqlx::query_as::<_, Project>(
            r#"
            SELECT id, name, slug, sentry_key, stored_event_count,
                   digested_event_count, created_at, updated_at, platform,
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
    pub async fn get_by_sentry_key(pool: &DbPool, sentry_key: &uuid::Uuid) -> AppResult<Project> {
        let project = sqlx::query_as::<_, Project>(
            r#"
            SELECT id, name, slug, sentry_key, stored_event_count,
                   digested_event_count, created_at, updated_at, platform,
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
    pub async fn create(pool: &DbPool, input: CreateProject) -> AppResult<Project> {
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

        // Generate sentry_key in application (for cross-DB compatibility)
        let sentry_key = uuid::Uuid::new_v4();

        let project = Self::try_insert_with_retry(pool, name, &slug, sentry_key).await?;

        Ok(project)
    }

    /// Updates an existing project
    pub async fn update(pool: &DbPool, id: i32, input: UpdateProject) -> AppResult<Project> {
        // Verify it exists
        Self::get_by_id(pool, id).await?;

        let name = match input.name {
            Some(ref name) => {
                let name = name.trim();
                if name.is_empty() {
                    return Err(AppError::Validation("Name cannot be empty".to_string()));
                }
                if name.len() > 255 {
                    return Err(AppError::Validation(
                        "Name cannot exceed 255 characters".to_string(),
                    ));
                }
                Some(name)
            }
            None => None,
        };

        let platform = match input.platform {
            Some(ref platform) => {
                if !VALID_PLATFORMS.contains(&platform.as_str()) {
                    return Err(AppError::Validation(format!(
                        "'{}' is not a valid platform",
                        platform
                    )));
                }
                Some(platform.as_str())
            }
            None => None,
        };

        if name.is_none() && platform.is_none() {
            // If no fields to update, return project unchanged
            return Self::get_by_id(pool, id).await;
        }

        // COALESCE keeps whichever field wasn't provided at its current value,
        // so a single query handles name-only, platform-only, or both together.
        let project = sqlx::query_as::<_, Project>(
            r#"
            UPDATE projects
            SET name = COALESCE($1, name),
                platform = COALESCE($2, platform),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING id, name, slug, sentry_key, stored_event_count,
                      digested_event_count, created_at, updated_at, platform,
                      quota_exceeded_until, quota_exceeded_reason, next_quota_check
            "#,
        )
        .bind(name)
        .bind(platform)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.is_unique_violation() {
                    if let Some(name) = name {
                        return AppError::Conflict(format!(
                            "Project with name '{}' already exists",
                            name
                        ));
                    }
                }
            }
            AppError::Database(e)
        })?;

        Ok(project)
    }

    /// Auto-detects the project's platform from an ingested event, mirroring
    /// Sentry's `_set_project_platform_if_needed` (event_manager.py): only
    /// writes if the project has no platform yet, and only if
    /// `event_platform` is one of Relay's [`VALID_PLATFORMS`]. No-op
    /// otherwise. Never overwrites a platform once set.
    pub async fn infer_platform_from_event(
        pool: &DbPool,
        project_id: i32,
        event_platform: &str,
    ) -> AppResult<()> {
        if !VALID_PLATFORMS.contains(&event_platform) {
            return Ok(());
        }

        sqlx::query("UPDATE projects SET platform = $1 WHERE id = $2 AND platform IS NULL")
            .bind(event_platform)
            .bind(project_id)
            .execute(pool)
            .await?;

        Ok(())
    }

    /// Deletes a project (hard delete)
    pub async fn delete(pool: &DbPool, id: i32) -> AppResult<()> {
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
        pool: &DbPool,
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

    /// Bypass slug generation and directly try INSERT with a pre-computed
    /// (possibly stale) slug. Used in integration tests to simulate TOCTOU.
    #[doc(hidden)]
    pub async fn create_with_stale_slug(
        pool: &DbPool,
        name: &str,
        stale_slug: &str,
    ) -> AppResult<Project> {
        let sentry_key = uuid::Uuid::new_v4();
        Self::try_insert_with_retry(pool, name, stale_slug, sentry_key).await
    }

    async fn try_insert_with_retry(
        pool: &DbPool,
        name: &str,
        slug: &str,
        sentry_key: uuid::Uuid,
    ) -> AppResult<Project> {
        const INSERT_SQL: &str = r#"
            INSERT INTO projects (name, slug, sentry_key)
            VALUES ($1, $2, $3)
            RETURNING id, name, slug, sentry_key, stored_event_count,
                      digested_event_count, created_at, updated_at, platform,
                      quota_exceeded_until, quota_exceeded_reason, next_quota_check
        "#;

        let result = sqlx::query_as::<_, Project>(INSERT_SQL)
            .bind(name)
            .bind(slug)
            .bind(sentry_key)
            .fetch_one(pool)
            .await;

        match result {
            Ok(p) => Ok(p),
            Err(sqlx::Error::Database(ref db_err)) if db_err.is_unique_violation() => {
                // The slug may have been taken by a concurrent request (TOCTOU).
                // Re-query to get the next available slug and retry once.
                let new_slug = Self::generate_unique_slug(pool, name, None).await?;
                if new_slug == slug {
                    // Slug is still available → the collision was on name, not slug.
                    return Err(AppError::Conflict(format!(
                        "Project with name '{}' already exists",
                        name
                    )));
                }
                sqlx::query_as::<_, Project>(INSERT_SQL)
                    .bind(name)
                    .bind(&new_slug)
                    .bind(sentry_key)
                    .fetch_one(pool)
                    .await
                    .map_err(|e| {
                        if let sqlx::Error::Database(ref db_err) = e {
                            if db_err.is_unique_violation() {
                                return AppError::Conflict(format!(
                                    "Project with name '{}' already exists",
                                    name
                                ));
                            }
                        }
                        AppError::Database(e)
                    })
            }
            Err(e) => Err(AppError::Database(e)),
        }
    }
}
