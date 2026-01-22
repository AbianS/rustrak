use actix_web::{web, HttpResponse};

use crate::auth::AuthenticatedUser;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::CreateAuthToken;
use crate::services::AuthTokenService;

/// GET /api/tokens - List all tokens (masked)
pub async fn list_tokens(
    pool: web::Data<DbPool>,
    _user: AuthenticatedUser, // Requires authentication
) -> AppResult<HttpResponse> {
    let tokens = AuthTokenService::list(pool.get_ref()).await?;
    let responses: Vec<_> = tokens.iter().map(|t| t.to_response()).collect();

    Ok(HttpResponse::Ok().json(responses))
}

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

/// Configure token routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/tokens")
            .route("", web::get().to(list_tokens))
            .route("", web::post().to(create_token))
            .route("/{id}", web::delete().to(delete_token)),
    );
}
