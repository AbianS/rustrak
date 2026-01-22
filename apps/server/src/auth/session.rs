use actix_session::Session;
use actix_web::{dev::Payload, web, Error, FromRequest, HttpRequest};
use std::pin::Pin;

use crate::error::{AppError, AppResult};
use crate::models::User;
use crate::services::UsersService;

const SESSION_USER_ID_KEY: &str = "user_id";

/// Store user ID in session
pub fn set_user_session(session: &Session, user_id: i32) -> AppResult<()> {
    session
        .insert(SESSION_USER_ID_KEY, user_id)
        .map_err(|e| AppError::Internal(format!("Failed to set session: {}", e)))
}

/// Get user ID from session
pub fn get_user_id_from_session(session: &Session) -> Option<i32> {
    session.get::<i32>(SESSION_USER_ID_KEY).ok().flatten()
}

/// Clear session (logout)
pub fn clear_session(session: &Session) {
    session.purge();
}

/// Middleware extractor for authenticated user (session-based only)
pub struct AuthenticatedUser(pub User);

impl FromRequest for AuthenticatedUser {
    type Error = Error;
    type Future = Pin<Box<dyn std::future::Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let req = req.clone();
        Box::pin(async move {
            // Extract session
            let session = Session::extract(&req)
                .await
                .map_err(|_| AppError::Unauthorized("Session error".to_string()))?;

            // Get user ID from session
            let user_id = get_user_id_from_session(&session)
                .ok_or_else(|| AppError::Unauthorized("Not authenticated".to_string()))?;

            // Get database pool
            let pool = req
                .app_data::<web::Data<sqlx::PgPool>>()
                .ok_or_else(|| AppError::Internal("Database pool not found".to_string()))?;

            // Fetch user from database
            let user = UsersService::get_by_id(pool.get_ref(), user_id)
                .await
                .map_err(|e| AppError::Internal(format!("Failed to fetch user: {}", e)))?
                .ok_or_else(|| AppError::Unauthorized("User not found".to_string()))?;

            // Check if user is active
            if !user.is_active {
                return Err(AppError::Unauthorized("User is inactive".to_string()).into());
            }

            Ok(AuthenticatedUser(user))
        })
    }
}
