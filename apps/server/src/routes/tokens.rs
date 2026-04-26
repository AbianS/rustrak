use actix_web::{web, HttpResponse};

use crate::auth::AuthenticatedUser;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::CreateAuthToken;
#[cfg(feature = "openapi")]
use crate::models::{AuthTokenCreatedResponse, AuthTokenResponse};
use crate::services::AuthTokenService;

#[cfg(feature = "openapi")]
use utoipa::OpenApi;

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/tokens",
    tag = "Tokens",
    responses(
        (status = 200, description = "List of tokens (masked)", body = Vec<AuthTokenResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/tokens - List all tokens (masked)
pub async fn list_tokens(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser, // Requires authentication
) -> AppResult<HttpResponse> {
    let tokens = AuthTokenService::list(pool.get_ref()).await?;
    let responses: Vec<_> = tokens.iter().map(|t| t.to_response()).collect();

    Ok(HttpResponse::Ok().json(responses))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/tokens",
    tag = "Tokens",
    request_body = CreateAuthToken,
    responses(
        (status = 201, description = "Token created (full token shown once)", body = AuthTokenCreatedResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/tokens - Create a new token
pub async fn create_token(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser, // Requires authentication
    body: web::Json<CreateAuthToken>,
) -> AppResult<HttpResponse> {
    let token = AuthTokenService::create(pool.get_ref(), body.into_inner()).await?;

    // Return full token (only time it's visible!)
    Ok(HttpResponse::Created().json(token.to_created_response()))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    delete,
    path = "/api/tokens/{id}",
    tag = "Tokens",
    params(("id" = i32, Path, description = "Token ID")),
    responses(
        (status = 204, description = "Token revoked"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// DELETE /api/tokens/{id} - Revoke a token
pub async fn delete_token(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser, // Requires authentication
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    AuthTokenService::delete(pool.get_ref(), id).await?;

    Ok(HttpResponse::NoContent().finish())
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(
    paths(list_tokens, create_token, delete_token),
    components(schemas(
        crate::models::AuthTokenResponse,
        crate::models::AuthTokenCreatedResponse,
        crate::models::CreateAuthToken,
    )),
)]
pub struct TokensApi;

/// Configure token routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/tokens")
            .route("", web::get().to(list_tokens))
            .route("", web::post().to(create_token))
            .route("/{id}", web::delete().to(delete_token)),
    );
}
