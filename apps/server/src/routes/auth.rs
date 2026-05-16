use actix_governor::governor::middleware::NoOpMiddleware;
use actix_governor::{
    Governor, GovernorConfig, GovernorConfigBuilder, KeyExtractor, SimpleKeyExtractionError,
};
use actix_session::Session;
use actix_web::dev::ServiceRequest;
use actix_web::{web, HttpResponse, Responder};
use serde::Serialize;
use std::net::{IpAddr, Ipv4Addr};

use crate::auth::{self, AuthenticatedUser};
use crate::error::{AppError, AppResult};
use crate::models::{CreateUserRequest, LoginRequest, User};
use crate::services::UsersService;

#[cfg(feature = "openapi")]
use utoipa::OpenApi;

/// Key extractor that uses peer IP, falling back to 127.0.0.1 when unavailable (e.g. in tests).
#[derive(Clone)]
pub struct IpOrLocalKeyExtractor;

impl KeyExtractor for IpOrLocalKeyExtractor {
    type Key = IpAddr;
    type KeyExtractionError = SimpleKeyExtractionError<&'static str>;

    fn extract(&self, req: &ServiceRequest) -> Result<Self::Key, Self::KeyExtractionError> {
        Ok(req
            .peer_addr()
            .map(|addr| addr.ip())
            .unwrap_or(IpAddr::V4(Ipv4Addr::LOCALHOST)))
    }

    #[cfg(feature = "log")]
    fn name(&self) -> &'static str {
        "ip_or_local"
    }
}

pub type AuthRateLimiter = GovernorConfig<IpOrLocalKeyExtractor, NoOpMiddleware>;

fn default_auth_limiter() -> AuthRateLimiter {
    let mut b = GovernorConfigBuilder::default().key_extractor(IpOrLocalKeyExtractor);
    b.seconds_per_request(30).burst_size(10).finish().unwrap()
}

/// Configure auth routes with a custom rate limiter (used in tests to inject a tight limiter).
pub fn configure_with_limiter(cfg: &mut web::ServiceConfig, limiter: AuthRateLimiter) {
    cfg.service(
        web::scope("/auth")
            .service(
                web::resource("/login")
                    .wrap(Governor::new(&limiter))
                    .route(web::post().to(login)),
            )
            .service(
                web::resource("/register")
                    .wrap(Governor::new(&limiter))
                    .route(web::post().to(register)),
            )
            .route("/logout", web::post().to(logout))
            .route("/me", web::get().to(get_current_user)),
    );
}

#[derive(Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
struct AuthResponse {
    user: UserResponse,
}

#[derive(Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
struct UserResponse {
    id: i32,
    email: String,
    is_admin: bool,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin,
        }
    }
}

/// Email validation - checks basic format requirements
fn is_valid_email(email: &str) -> bool {
    // Must have exactly one @
    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() != 2 {
        return false;
    }
    let (local, domain) = (parts[0], parts[1]);

    // Local part: non-empty, reasonable chars
    if local.is_empty() || local.len() > 64 {
        return false;
    }

    // Domain: non-empty, has at least one dot, not starting/ending with dot
    if domain.is_empty() || domain.len() > 255 {
        return false;
    }
    if !domain.contains('.') {
        return false;
    }
    if domain.starts_with('.') || domain.ends_with('.') {
        return false;
    }

    // Domain parts must not be empty (catches "user@.com" and "user@domain.")
    let domain_parts: Vec<&str> = domain.split('.').collect();
    if domain_parts.iter().any(|p| p.is_empty()) {
        return false;
    }

    // TLD must be at least 2 chars
    if let Some(tld) = domain_parts.last() {
        if tld.len() < 2 {
            return false;
        }
    }

    true
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/auth/register",
    tag = "Auth",
    request_body = CreateUserRequest,
    responses(
        (status = 201, description = "User registered", body = AuthResponse),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 409, description = "Email already in use", body = crate::error::ErrorResponse),
    ),
    security(()),
))]
/// POST /auth/register
/// Create new user account
pub async fn register(
    pool: web::Data<crate::db::DbPool>,
    session: Session,
    req: web::Json<CreateUserRequest>,
) -> AppResult<impl Responder> {
    // Validate email format
    if !is_valid_email(&req.email) {
        return Err(AppError::Validation("Invalid email format".to_string()));
    }

    // Validate password is provided
    if req.password.is_empty() {
        return Err(AppError::Validation("Password is required".to_string()));
    }

    // Create user (non-admin by default)
    let user = UsersService::create_user(pool.get_ref(), &req, false).await?;

    // Set session
    auth::set_user_session(&session, user.id)?;

    Ok(HttpResponse::Created().json(AuthResponse { user: user.into() }))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/auth/login",
    tag = "Auth",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Logged in", body = AuthResponse),
        (status = 401, description = "Invalid credentials", body = crate::error::ErrorResponse),
    ),
    security(()),
))]
/// POST /auth/login
/// Authenticate user and create session
pub async fn login(
    pool: web::Data<crate::db::DbPool>,
    session: Session,
    req: web::Json<LoginRequest>,
) -> AppResult<impl Responder> {
    // Get user by email
    let user = UsersService::get_by_email(pool.get_ref(), &req.email)
        .await?
        .ok_or_else(|| AppError::Unauthorized("Invalid credentials".to_string()))?;

    // Check if user is active
    if !user.is_active {
        return Err(AppError::Unauthorized("Account is disabled".to_string()));
    }

    // Verify password
    if !user.verify_password(&req.password)? {
        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }

    // Update last login
    UsersService::update_last_login(pool.get_ref(), user.id).await?;

    // Set session
    auth::set_user_session(&session, user.id)?;

    Ok(HttpResponse::Ok().json(AuthResponse { user: user.into() }))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/auth/logout",
    tag = "Auth",
    responses(
        (status = 204, description = "Logged out"),
    ),
    security(("session_cookie" = [])),
))]
/// POST /auth/logout
/// Clear session
pub async fn logout(session: Session) -> impl Responder {
    auth::clear_session(&session);
    HttpResponse::NoContent().finish()
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/auth/me",
    tag = "Auth",
    responses(
        (status = 200, description = "Current user", body = UserResponse),
        (status = 401, description = "Not authenticated", body = crate::error::ErrorResponse),
    ),
    security(("session_cookie" = [])),
))]
/// GET /auth/me
/// Get current authenticated user
pub async fn get_current_user(user: AuthenticatedUser) -> impl Responder {
    HttpResponse::Ok().json(UserResponse::from(user.0))
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(
    paths(register, login, logout, get_current_user),
    components(schemas(
        crate::models::CreateUserRequest,
        crate::models::LoginRequest,
        AuthResponse,
        UserResponse,
    ))
)]
pub struct AuthApi;

/// Configure auth routes with production rate limiting (10 burst, 1 token per 30s).
pub fn configure(cfg: &mut web::ServiceConfig) {
    configure_with_limiter(cfg, default_auth_limiter());
}
