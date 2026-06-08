use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::error::AppError;

/// Instance-wide role for a user.
///
/// `Admin` has full access to every project and to team management.
/// `Member` only sees projects they are a member of (see `ProjectRole`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    Admin,
    Member,
}

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::Admin => "admin",
            UserRole::Member => "member",
        }
    }

    /// Lenient parse from the DB string. Unknown values fall back to the
    /// least-privileged role (`Member`) so a bad value never grants admin.
    pub fn from_db(s: &str) -> Self {
        match s {
            "admin" => UserRole::Admin,
            _ => UserRole::Member,
        }
    }

    /// Strict parse for untrusted input (request bodies). Unknown → `None`.
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "admin" => Some(UserRole::Admin),
            "member" => Some(UserRole::Member),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct User {
    pub id: i32,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub is_active: bool,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateUserRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

impl User {
    /// Hash a password using Argon2id
    pub fn hash_password(password: &str) -> Result<String, AppError> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| AppError::Internal(format!("Password hashing failed: {}", e)))?;
        Ok(hash.to_string())
    }

    /// Verify a password against the stored hash
    pub fn verify_password(&self, password: &str) -> Result<bool, AppError> {
        let parsed_hash = PasswordHash::new(&self.password_hash)
            .map_err(|e| AppError::Internal(format!("Invalid password hash: {}", e)))?;
        Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok())
    }

    /// Typed global role.
    pub fn role(&self) -> UserRole {
        UserRole::from_db(&self.role)
    }

    /// Convenience: is this user an instance admin?
    pub fn is_admin(&self) -> bool {
        matches!(self.role(), UserRole::Admin)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_role_roundtrips_through_db_string() {
        assert_eq!(UserRole::from_db(UserRole::Admin.as_str()), UserRole::Admin);
        assert_eq!(
            UserRole::from_db(UserRole::Member.as_str()),
            UserRole::Member
        );
    }

    #[test]
    fn unknown_role_falls_back_to_member() {
        assert_eq!(UserRole::from_db("superuser"), UserRole::Member);
        assert_eq!(UserRole::from_db(""), UserRole::Member);
    }
}
