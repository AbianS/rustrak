use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// AuthToken model - global authentication token
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct AuthToken {
    pub id: i32,
    pub token: String,
    pub description: Option<String>,
    /// Owning user. `None` for legacy/instance-level tokens (full access).
    pub user_id: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

/// DTO for creating a new token
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateAuthToken {
    #[serde(default)]
    pub description: Option<String>,
}

/// Response that includes the full token (only on creation)
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AuthTokenCreatedResponse {
    pub id: i32,
    pub token: String, // Only shown once!
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Response for listing (token is masked)
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AuthTokenResponse {
    pub id: i32,
    pub token_prefix: String, // First 8 chars only
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

impl AuthToken {
    /// Mask the token for display (show first 8 chars)
    pub fn to_response(&self) -> AuthTokenResponse {
        AuthTokenResponse {
            id: self.id,
            token_prefix: format!("{}...", &self.token[..8]),
            description: self.description.clone(),
            created_at: self.created_at,
            last_used_at: self.last_used_at,
        }
    }

    /// Full response with token (only for creation)
    pub fn to_created_response(&self) -> AuthTokenCreatedResponse {
        AuthTokenCreatedResponse {
            id: self.id,
            token: self.token.clone(),
            description: self.description.clone(),
            created_at: self.created_at,
        }
    }
}
