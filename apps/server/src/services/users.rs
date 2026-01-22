use sqlx::PgPool;

use crate::error::{AppError, AppResult};
use crate::models::{CreateUserRequest, User};

pub struct UsersService;

impl UsersService {
    /// Creates a new user
    pub async fn create_user(
        pool: &PgPool,
        req: &CreateUserRequest,
        is_admin: bool,
    ) -> AppResult<User> {
        let password_hash = User::hash_password(&req.password)?;

        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (email, password_hash, is_admin)
            VALUES ($1, $2, $3)
            RETURNING id, email, password_hash, is_active, is_admin, created_at, last_login
            "#,
        )
        .bind(&req.email)
        .bind(&password_hash)
        .bind(is_admin)
        .fetch_one(pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
                AppError::Validation("Email already exists".to_string())
            }
            _ => AppError::Internal(format!("Failed to create user: {}", e)),
        })?;

        Ok(user)
    }

    /// Gets a user by email
    pub async fn get_by_email(pool: &PgPool, email: &str) -> AppResult<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, email, password_hash, is_active, is_admin, created_at, last_login
            FROM users
            WHERE email = $1
            "#,
        )
        .bind(email)
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    /// Gets a user by ID
    pub async fn get_by_id(pool: &PgPool, user_id: i32) -> AppResult<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, email, password_hash, is_active, is_admin, created_at, last_login
            FROM users
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    /// Updates the last login timestamp for a user
    pub async fn update_last_login(pool: &PgPool, user_id: i32) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET last_login = NOW()
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Counts total number of users
    pub async fn user_count(pool: &PgPool) -> AppResult<i64> {
        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM users
            "#,
        )
        .fetch_one(pool)
        .await?;

        Ok(count.0)
    }
}
