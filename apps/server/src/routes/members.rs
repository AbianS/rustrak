//! Project member routes.
//!
//! Managing members requires the project `admin` role (or global admin).
//!
//! - GET    /api/projects/{id}/members            — list members
//! - PUT    /api/projects/{id}/members            — add/update a member
//! - DELETE /api/projects/{id}/members/{user_id}  — remove a member

use actix_web::{web, HttpResponse};

use crate::auth::ApiActor;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{ProjectRole, UpsertProjectMember};
use crate::services::access::{self, Action};
use crate::services::ProjectMemberService;

#[cfg(feature = "openapi")]
use crate::models::ProjectMemberResponse;
#[cfg(feature = "openapi")]
use utoipa::OpenApi;

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/members",
    tag = "Members",
    params(("project_id" = i32, Path, description = "Project ID")),
    responses(
        (status = 200, description = "List of project members", body = Vec<ProjectMemberResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 403, description = "Forbidden", body = crate::error::ErrorResponse),
        (status = 404, description = "Project not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/members
pub async fn list_members(
    pool: web::Data<DbPool>,
    actor: ApiActor,
    path: web::Path<i32>,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();
    // Any project member (viewer+) may see who else is on the project; only
    // mutating membership (PUT/DELETE below) requires the admin role.
    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ViewProject,
    )
    .await?;

    let members = ProjectMemberService::list_for_project(pool.get_ref(), project_id).await?;

    Ok(HttpResponse::Ok().json(members))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    put,
    path = "/api/projects/{project_id}/members",
    tag = "Members",
    params(("project_id" = i32, Path, description = "Project ID")),
    request_body = UpsertProjectMember,
    responses(
        (status = 200, description = "Member added or updated"),
        (status = 400, description = "Invalid role", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 403, description = "Forbidden", body = crate::error::ErrorResponse),
        (status = 404, description = "Project or user not found", body = crate::error::ErrorResponse),
        (status = 409, description = "Cannot downgrade last project admin", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// PUT /api/projects/{project_id}/members
pub async fn upsert_member(
    pool: web::Data<DbPool>,
    actor: ApiActor,
    path: web::Path<i32>,
    body: web::Json<UpsertProjectMember>,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();
    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ManageMembers,
    )
    .await?;

    let body = body.into_inner();
    let role = ProjectRole::parse(&body.role)
        .ok_or_else(|| AppError::Validation(format!("Invalid project role: {}", body.role)))?;

    let member =
        ProjectMemberService::upsert(pool.get_ref(), project_id, body.user_id, role).await?;

    Ok(HttpResponse::Ok().json(member))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    delete,
    path = "/api/projects/{project_id}/members/{user_id}",
    tag = "Members",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("user_id" = i32, Path, description = "User ID"),
    ),
    responses(
        (status = 204, description = "Member removed"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 403, description = "Forbidden", body = crate::error::ErrorResponse),
        (status = 404, description = "Membership not found", body = crate::error::ErrorResponse),
        (status = 409, description = "Cannot remove last project admin", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// DELETE /api/projects/{project_id}/members/{user_id}
pub async fn remove_member(
    pool: web::Data<DbPool>,
    actor: ApiActor,
    path: web::Path<(i32, i32)>,
) -> AppResult<HttpResponse> {
    let (project_id, user_id) = path.into_inner();
    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ManageMembers,
    )
    .await?;

    ProjectMemberService::remove(pool.get_ref(), project_id, user_id).await?;

    Ok(HttpResponse::NoContent().finish())
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(
    paths(list_members, upsert_member, remove_member),
    components(schemas(
        crate::models::ProjectMemberResponse,
        crate::models::UpsertProjectMember,
    ))
)]
pub struct MembersApi;

/// Configure project member routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/projects/{project_id}/members")
            .route("", web::get().to(list_members))
            .route("", web::put().to(upsert_member))
            .route("/{user_id}", web::delete().to(remove_member)),
    );
}
