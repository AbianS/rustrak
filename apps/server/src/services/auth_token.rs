use sqlx::PgPool;

use crate::auth::generate_token;
use crate::error::{AppError, AppResult};
use crate::models::{AuthToken, CreateAuthToken};

pub struct AuthTokenService;

impl AuthTokenService {
    /// Lists all tokens
    pub async fn list(pool: &PgPool) -> AppResult<Vec<AuthToken>> {
        let tokens = sqlx::query_as::<_, AuthToken>(
            r#"
            SELECT id, token, description, created_at, last_used_at
            FROM auth_tokens
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(tokens)
    }

    /// Gets a token by ID
    #[allow(dead_code)]
    pub async fn get_by_id(pool: &PgPool, id: i32) -> AppResult<AuthToken> {
        let token = sqlx::query_as::<_, AuthToken>(
            r#"
            SELECT id, token, description, created_at, last_used_at
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
    pub async fn get_by_token(pool: &PgPool, token: &str) -> AppResult<Option<AuthToken>> {
        let result = sqlx::query_as::<_, AuthToken>(
            r#"
            SELECT id, token, description, created_at, last_used_at
            FROM auth_tokens
            WHERE token = $1
            "#,
        )
        .bind(token)
        .fetch_optional(pool)
        .await?;

        Ok(result)
    }

    /// Creates a new token
    pub async fn create(pool: &PgPool, input: CreateAuthToken) -> AppResult<AuthToken> {
        let token_str = generate_token();

        let token = sqlx::query_as::<_, AuthToken>(
            r#"
            INSERT INTO auth_tokens (token, description)
            VALUES ($1, $2)
            RETURNING id, token, description, created_at, last_used_at
            "#,
        )
        .bind(&token_str)
        .bind(&input.description)
        .fetch_one(pool)
        .await?;

        Ok(token)
    }

    /// Deletes a token (revoke)
    pub async fn delete(pool: &PgPool, id: i32) -> AppResult<()> {
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
    pub async fn update_last_used(pool: &PgPool, id: i32) -> AppResult<()> {
        sqlx::query("UPDATE auth_tokens SET last_used_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(())
    }

    /// Checks if any tokens exist (for bootstrap check)
    pub async fn has_any_token(pool: &PgPool) -> AppResult<bool> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM auth_tokens")
            .fetch_one(pool)
            .await?;

        Ok(count.0 > 0)
    }
}
