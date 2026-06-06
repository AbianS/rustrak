use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{CreateUserRequest, User, UserRole};

pub struct UsersService;

impl UsersService {
    /// Creates a new user with the given global role.
    pub async fn create_user(
        pool: &DbPool,
        req: &CreateUserRequest,
        role: UserRole,
    ) -> AppResult<User> {
        let password_hash = User::hash_password(&req.password)?;

        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (email, password_hash, role)
            VALUES ($1, $2, $3)
            RETURNING id, email, password_hash, is_active, role, created_at, last_login
            "#,
        )
        .bind(&req.email)
        .bind(&password_hash)
        .bind(role.as_str())
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
    pub async fn get_by_email(pool: &DbPool, email: &str) -> AppResult<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, email, password_hash, is_active, role, created_at, last_login
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
    pub async fn get_by_id(pool: &DbPool, user_id: i32) -> AppResult<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, email, password_hash, is_active, role, created_at, last_login
            FROM users
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    /// Lists all users (team roster), most recent first.
    pub async fn list(pool: &DbPool) -> AppResult<Vec<User>> {
        let users = sqlx::query_as::<_, User>(
            r#"
            SELECT id, email, password_hash, is_active, role, created_at, last_login
            FROM users
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(users)
    }

    /// The primary user = the first-registered account (lowest id), i.e. the
    /// bootstrap superuser Rustrak was set up with. It is protected from demotion
    /// and deletion. Returns `None` only when there are no users.
    pub async fn primary_user_id(pool: &DbPool) -> AppResult<Option<i32>> {
        let row: (Option<i32>,) = sqlx::query_as("SELECT MIN(id) FROM users")
            .fetch_one(pool)
            .await?;

        Ok(row.0)
    }

    /// Permanently deletes a user. Memberships and owned tokens cascade
    /// (`ON DELETE CASCADE`); invitations they sent keep `invited_by = NULL`.
    pub async fn delete(pool: &DbPool, user_id: i32) -> AppResult<()> {
        let result = sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(user_id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(format!("User {} not found", user_id)));
        }

        Ok(())
    }

    /// Updates a user's global role.
    pub async fn update_role(pool: &DbPool, user_id: i32, role: UserRole) -> AppResult<()> {
        let result = sqlx::query("UPDATE users SET role = $1 WHERE id = $2")
            .bind(role.as_str())
            .bind(user_id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(format!("User {} not found", user_id)));
        }

        Ok(())
    }

    /// Updates the last login timestamp for a user
    pub async fn update_last_login(pool: &DbPool, user_id: i32) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET last_login = CURRENT_TIMESTAMP
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Counts total number of users
    pub async fn user_count(pool: &DbPool) -> AppResult<i64> {
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

    /// Counts how many *active* admins exist (to prevent demoting the last usable
    /// admin and locking the instance out — inactive admins cannot act).
    pub async fn admin_count(pool: &DbPool) -> AppResult<i64> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = true")
                .fetch_one(pool)
                .await?;

        Ok(count.0)
    }
}
