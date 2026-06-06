use crate::auth::generate_token;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{AuthToken, CreateAuthToken};

pub struct AuthTokenService;

impl AuthTokenService {
    /// Lists all tokens
    pub async fn list(pool: &DbPool) -> AppResult<Vec<AuthToken>> {
        let tokens = sqlx::query_as::<_, AuthToken>(
            r#"
            SELECT id, token, description, user_id, created_at, last_used_at
            FROM auth_tokens
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(tokens)
    }

    /// Lists tokens owned by a specific user, most recent first.
    pub async fn list_for_user(pool: &DbPool, user_id: i32) -> AppResult<Vec<AuthToken>> {
        let tokens = sqlx::query_as::<_, AuthToken>(
            r#"
            SELECT id, token, description, user_id, created_at, last_used_at
            FROM auth_tokens
            WHERE user_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(tokens)
    }

    /// Gets a token by ID
    #[allow(dead_code)]
    pub async fn get_by_id(pool: &DbPool, id: i32) -> AppResult<AuthToken> {
        let token = sqlx::query_as::<_, AuthToken>(
            r#"
            SELECT id, token, description, user_id, created_at, last_used_at
            FROM auth_tokens
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Token with id {} not found", id)))?;

        Ok(token)
    }

    /// Gets a token by token string (for authentication)
    pub async fn get_by_token(pool: &DbPool, token: &str) -> AppResult<Option<AuthToken>> {
        let result = sqlx::query_as::<_, AuthToken>(
            r#"
            SELECT id, token, description, user_id, created_at, last_used_at
            FROM auth_tokens
            WHERE token = $1
            "#,
        )
        .bind(token)
        .fetch_optional(pool)
        .await?;

        Ok(result)
    }

    /// Creates a new legacy/instance-level token (no owning user).
    pub async fn create(pool: &DbPool, input: CreateAuthToken) -> AppResult<AuthToken> {
        Self::create_for_user(pool, input, None).await
    }

    /// Creates a new token, optionally owned by a user (`None` = legacy/instance token).
    pub async fn create_for_user(
        pool: &DbPool,
        input: CreateAuthToken,
        user_id: Option<i32>,
    ) -> AppResult<AuthToken> {
        let token_str = generate_token();

        let token = sqlx::query_as::<_, AuthToken>(
            r#"
            INSERT INTO auth_tokens (token, description, user_id)
            VALUES ($1, $2, $3)
            RETURNING id, token, description, user_id, created_at, last_used_at
            "#,
        )
        .bind(&token_str)
        .bind(&input.description)
        .bind(user_id)
        .fetch_one(pool)
        .await?;

        Ok(token)
    }

    /// Deletes a token (revoke)
    pub async fn delete(pool: &DbPool, id: i32) -> AppResult<()> {
        let result = sqlx::query("DELETE FROM auth_tokens WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(format!(
                "Token with id {} not found",
                id
            )));
        }

        Ok(())
    }

    /// Updates last_used_at timestamp
    pub async fn update_last_used(pool: &DbPool, id: i32) -> AppResult<()> {
        sqlx::query("UPDATE auth_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(())
    }

    /// Checks if any tokens exist (for bootstrap check)
    pub async fn has_any_token(pool: &DbPool) -> AppResult<bool> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM auth_tokens")
            .fetch_one(pool)
            .await?;

        Ok(count.0 > 0)
    }
}
