//! Invitation routes (global admin only).
//!
//! - POST   /api/invitations          — create an invitation
//! - GET    /api/invitations          — list invitations
//! - DELETE /api/invitations/{token}  — revoke a pending invitation

use actix_web::{web, HttpResponse};

use crate::auth::ApiActor;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{CreateInvitation, InvitationResponse};
use crate::services::InvitationService;

#[cfg(feature = "openapi")]
use utoipa::OpenApi;

/// Ensures the actor is a global admin, else 403.
fn require_admin(actor: &ApiActor) -> AppResult<()> {
    if actor.is_admin() {
        Ok(())
    } else {
        Err(AppError::Forbidden("Admin privileges required".to_string()))
    }
}

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/invitations",
    tag = "Invitations",
    request_body = CreateInvitation,
    responses(
        (status = 201, description = "Invitation created", body = InvitationResponse),
        (status = 400, description = "Invalid role", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 403, description = "Forbidden", body = crate::error::ErrorResponse),
        (status = 409, description = "Email already a user or pending invite", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/invitations — create an invitation (admin only)
pub async fn create_invitation(
    pool: web::Data<DbPool>,
    actor: ApiActor,
    body: web::Json<CreateInvitation>,
) -> AppResult<HttpResponse> {
    require_admin(&actor)?;

    let invited_by = actor.require_user()?.id;
    let invitation =
        InvitationService::create(pool.get_ref(), body.into_inner(), invited_by).await?;

    Ok(HttpResponse::Created().json(InvitationResponse::from(invitation)))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/invitations",
    tag = "Invitations",
    responses(
        (status = 200, description = "List of invitations", body = Vec<InvitationResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 403, description = "Forbidden", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/invitations — list invitations (admin only)
pub async fn list_invitations(pool: web::Data<DbPool>, actor: ApiActor) -> AppResult<HttpResponse> {
    require_admin(&actor)?;

    let invitations = InvitationService::list(pool.get_ref()).await?;
    let responses: Vec<InvitationResponse> = invitations
        .into_iter()
        .map(InvitationResponse::from)
        .collect();

    Ok(HttpResponse::Ok().json(responses))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    delete,
    path = "/api/invitations/{token}",
    tag = "Invitations",
    params(("token" = String, Path, description = "Invitation token")),
    responses(
        (status = 204, description = "Invitation revoked"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 403, description = "Forbidden", body = crate::error::ErrorResponse),
        (status = 404, description = "Pending invitation not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// DELETE /api/invitations/{token} — revoke a pending invitation (admin only)
pub async fn revoke_invitation(
    pool: web::Data<DbPool>,
    actor: ApiActor,
    path: web::Path<String>,
) -> AppResult<HttpResponse> {
    require_admin(&actor)?;

    InvitationService::revoke(pool.get_ref(), &path.into_inner()).await?;

    Ok(HttpResponse::NoContent().finish())
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(
    paths(create_invitation, list_invitations, revoke_invitation),
    components(schemas(crate::models::CreateInvitation, crate::models::InvitationResponse,))
)]
pub struct InvitationsApi;

/// Configure invitation routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/invitations")
            .route("", web::post().to(create_invitation))
            .route("", web::get().to(list_invitations))
            .route("/{token}", web::delete().to(revoke_invitation)),
    );
}
