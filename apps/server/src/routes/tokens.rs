use actix_web::{web, HttpResponse};

use crate::auth::AuthenticatedUser;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::CreateAuthToken;
use crate::services::AuthTokenService;

/// GET /api/tokens - List all tokens (masked)
#[utoipa::path(
    get,
    path = "/api/tokens",
    tag = "tokens",
    responses(
        (status = 200, description = "List of tokens (masked)", body = Vec<crate::models::auth_token::AuthTokenResponse>),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn list_tokens(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser, // Requires authentication
) -> AppResult<HttpResponse> {
    let tokens = AuthTokenService::list(pool.get_ref()).await?;
    let responses: Vec<_> = tokens.iter().map(|t| t.to_response()).collect();

    Ok(HttpResponse::Ok().json(responses))
}

/// POST /api/tokens - Create a new token
#[utoipa::path(
    post,
    path = "/api/tokens",
    tag = "tokens",
    request_body = CreateAuthToken,
    responses(
        (status = 201, description = "Token created (full token shown once)", body = crate::models::auth_token::AuthTokenCreatedResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn create_token(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser, // Requires authentication
    body: web::Json<CreateAuthToken>,
) -> AppResult<HttpResponse> {
    let token = AuthTokenService::create(pool.get_ref(), body.into_inner()).await?;

    // Return full token (only time it's visible!)
    Ok(HttpResponse::Created().json(token.to_created_response()))
}

/// DELETE /api/tokens/{id} - Revoke a token
#[utoipa::path(
    delete,
    path = "/api/tokens/{id}",
    tag = "tokens",
    params(("id" = i32, Path, description = "Token ID")),
    responses(
        (status = 204, description = "Token revoked"),
        (status = 404, description = "Token not found", body = crate::error::ErrorResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn delete_token(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser, // Requires authentication
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    AuthTokenService::delete(pool.get_ref(), id).await?;

    Ok(HttpResponse::NoContent().finish())
}

/// Configure token routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/tokens")
            .route("", web::get().to(list_tokens))
            .route("", web::post().to(create_token))
            .route("/{id}", web::delete().to(delete_token)),
    );
}
