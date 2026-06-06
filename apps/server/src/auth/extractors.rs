use actix_web::{dev::Payload, web, FromRequest, HttpRequest};
use std::future::Future;
use std::pin::Pin;

use crate::auth::sentry_auth::parse_sentry_auth_header;
use crate::auth::session::AuthenticatedUser;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{AuthToken, Project, User};
use crate::services::{AuthTokenService, ProjectService, UsersService};

/// Extractor for Bearer token authentication (API endpoints)
///
/// Usage in handlers:
/// ```ignore
/// async fn my_handler(auth: BearerAuth) -> HttpResponse {
///     // auth.token contains the validated AuthToken
/// }
/// ```
pub struct BearerAuth {
    #[allow(dead_code)] // Available for handlers that need token details
    pub token: AuthToken,
}

impl FromRequest for BearerAuth {
    type Error = AppError;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let pool = match req.app_data::<web::Data<DbPool>>().cloned() {
            Some(pool) => pool,
            None => {
                return Box::pin(async {
                    Err(AppError::Internal(
                        "Database pool not configured".to_string(),
                    ))
                });
            }
        };

        let auth_header = req
            .headers()
            .get("Authorization")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string());

        Box::pin(async move {
            let header = auth_header.ok_or_else(|| {
                AppError::Unauthorized("Missing Authorization header".to_string())
            })?;

            if !header.starts_with("Bearer ") {
                return Err(AppError::Unauthorized(
                    "Invalid Authorization header format, expected 'Bearer <token>'".to_string(),
                ));
            }

            let token_str = header["Bearer ".len()..].trim();

            // Validate format: 40 lowercase hex chars
            if token_str.len() != 40
                || !token_str
                    .chars()
                    .all(|c| c.is_ascii_hexdigit() && !c.is_uppercase())
            {
                return Err(AppError::Unauthorized(
                    "Malformed Bearer token, must be 40 lowercase hex chars".to_string(),
                ));
            }

            // Lookup token in database
            let token = AuthTokenService::get_by_token(pool.get_ref(), token_str)
                .await?
                .ok_or_else(|| AppError::Unauthorized("Invalid Bearer token".to_string()))?;

            // Update last_used_at asynchronously (fire and forget)
            let pool_clone = pool.clone();
            let token_id = token.id;
            tokio::spawn(async move {
                let _ = AuthTokenService::update_last_used(pool_clone.get_ref(), token_id).await;
            });

            Ok(BearerAuth { token })
        })
    }
}

/// Extractor for Sentry SDK authentication (ingest endpoints)
///
/// Validates project by ID from URL path and sentry_key from query param or X-Sentry-Auth header.
///
/// Usage in handlers:
/// ```ignore
/// async fn ingest_handler(auth: SentryAuth) -> HttpResponse {
///     // auth.project contains the validated Project
/// }
/// ```
pub struct SentryAuth {
    pub project: Project,
}

impl FromRequest for SentryAuth {
    type Error = AppError;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let pool = match req.app_data::<web::Data<DbPool>>().cloned() {
            Some(pool) => pool,
            None => {
                return Box::pin(async {
                    Err(AppError::Internal(
                        "Database pool not configured".to_string(),
                    ))
                });
            }
        };

        // Extract project_id from URL path
        let project_id: Option<i32> = req
            .match_info()
            .get("project_id")
            .and_then(|s| s.parse().ok());

        // Extract sentry_key from query param
        let query_sentry_key = req.query_string().split('&').find_map(|pair| {
            let (key, value) = pair.split_once('=')?;
            if key == "sentry_key" {
                Some(value.to_string())
            } else {
                None
            }
        });

        // Extract sentry_key from X-Sentry-Auth header
        let header_sentry_key = req
            .headers()
            .get("X-Sentry-Auth")
            .and_then(|h| h.to_str().ok())
            .map(parse_sentry_auth_header)
            .and_then(|map| map.get("sentry_key").cloned());

        Box::pin(async move {
            let project_id = project_id.ok_or_else(|| {
                AppError::Validation("Missing or invalid project_id in URL".to_string())
            })?;

            // Try query param first, then header
            let sentry_key_str = query_sentry_key.or(header_sentry_key).ok_or_else(|| {
                AppError::Unauthorized(
                    "Missing sentry_key in query param or X-Sentry-Auth header".to_string(),
                )
            })?;

            // Parse sentry_key as UUID
            let sentry_key: uuid::Uuid = sentry_key_str
                .parse()
                .map_err(|_| AppError::Unauthorized("Invalid sentry_key format".to_string()))?;

            // Look up project
            let project = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

            // Validate sentry_key matches
            if project.sentry_key != sentry_key {
                return Err(AppError::Unauthorized(
                    "Invalid sentry_key for project".to_string(),
                ));
            }

            Ok(SentryAuth { project })
        })
    }
}

/// Composite extractor for management API endpoints.
///
/// Accepts either a Bearer token (`Authorization: Bearer <token>`) or a valid
/// session cookie, in that order. Returns 401 only if both are absent/invalid.
pub struct ApiAuth;

impl FromRequest for ApiAuth {
    type Error = AppError;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, payload: &mut Payload) -> Self::Future {
        let bearer_future = BearerAuth::from_request(req, payload);
        let session_future = AuthenticatedUser::from_request(req, payload);

        Box::pin(async move {
            match bearer_future.await {
                Ok(_) => return Ok(ApiAuth),
                Err(AppError::Unauthorized(_)) => {} // auth rejected — fall through to session
                Err(e) => return Err(e),             // Internal/Database — propagate
            }
            session_future.await.map(|_| ApiAuth).map_err(|e| {
                if e.as_response_error().status_code().is_server_error() {
                    AppError::Internal(format!("Session error: {e}"))
                } else {
                    AppError::Unauthorized("Not authenticated".to_string())
                }
            })
        })
    }
}

/// Authenticated principal for management API endpoints, carrying the acting user.
///
/// Resolves from a Bearer token (owner user) or a session cookie. A legacy
/// token with no owning user (`user_id = NULL`) resolves to `user: None`, which
/// is treated as a full-access instance admin.
pub struct ApiActor {
    pub user: Option<User>,
}

impl ApiActor {
    /// Whether this actor has full instance access (global admin or legacy token).
    pub fn is_admin(&self) -> bool {
        self.user.as_ref().is_none_or(|u| u.is_admin())
    }

    /// The acting user's id, if any (`None` for a legacy user-less token).
    pub fn user_id(&self) -> Option<i32> {
        self.user.as_ref().map(|u| u.id)
    }

    /// Returns the acting user or an error when the action requires a real account.
    pub fn require_user(&self) -> AppResult<&User> {
        self.user
            .as_ref()
            .ok_or_else(|| AppError::Forbidden("This action requires a user account".to_string()))
    }
}

impl FromRequest for ApiActor {
    type Error = AppError;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, payload: &mut Payload) -> Self::Future {
        let pool = match req.app_data::<web::Data<DbPool>>().cloned() {
            Some(pool) => pool,
            None => {
                return Box::pin(async {
                    Err(AppError::Internal(
                        "Database pool not configured".to_string(),
                    ))
                });
            }
        };

        let bearer_future = BearerAuth::from_request(req, payload);
        let session_future = AuthenticatedUser::from_request(req, payload);

        Box::pin(async move {
            match bearer_future.await {
                Ok(bearer) => {
                    return match bearer.token.user_id {
                        Some(uid) => {
                            let user = UsersService::get_by_id(pool.get_ref(), uid)
                                .await?
                                .ok_or_else(|| {
                                    AppError::Unauthorized("Token owner not found".to_string())
                                })?;
                            // Mirror the session/login path: a disabled account
                            // must not authenticate even with a valid token.
                            if !user.is_active {
                                return Err(AppError::Unauthorized(
                                    "Account is disabled".to_string(),
                                ));
                            }
                            Ok(ApiActor { user: Some(user) })
                        }
                        None => Ok(ApiActor { user: None }),
                    };
                }
                Err(AppError::Unauthorized(_)) => {} // fall through to session
                Err(e) => return Err(e),
            }

            let authed = session_future.await.map_err(|e| {
                if e.as_response_error().status_code().is_server_error() {
                    AppError::Internal(format!("Session error: {e}"))
                } else {
                    AppError::Unauthorized("Not authenticated".to_string())
                }
            })?;

            Ok(ApiActor {
                user: Some(authed.0),
            })
        })
    }
}
