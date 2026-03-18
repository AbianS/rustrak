use actix_web::{web, HttpResponse};

use crate::auth::AuthenticatedUser;
use crate::config::Config;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::{CreateProject, UpdateProject};
use crate::pagination::{ListProjectsQuery, OffsetPaginatedProjectResponse, OffsetPaginatedResponse};
use crate::services::ProjectService;

/// GET /api/projects - List projects with pagination
#[utoipa::path(
    get,
    path = "/api/projects",
    tag = "projects",
    params(ListProjectsQuery),
    responses(
        (status = 200, description = "List of projects", body = OffsetPaginatedProjectResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn list_projects(
    pool: web::Data<DbPool>,
    config: web::Data<Config>,
    query: web::Query<ListProjectsQuery>,
    _user: AuthenticatedUser, // Requires authentication
) -> AppResult<HttpResponse> {
    let (projects, total_count) =
        ProjectService::list_offset(pool.get_ref(), query.order, query.page, query.per_page)
            .await?;

    let base_url = build_base_url(&config);
    let responses: Vec<_> = projects.iter().map(|p| p.to_response(&base_url)).collect();

    Ok(HttpResponse::Ok().json(OffsetPaginatedResponse::new(
        responses,
        total_count,
        query.page,
        query.per_page,
    )))
}

/// GET /api/projects/{id} - Get a project by ID
#[utoipa::path(
    get,
    path = "/api/projects/{id}",
    tag = "projects",
    params(("id" = i32, Path, description = "Project ID")),
    responses(
        (status = 200, description = "Project details", body = crate::models::project::ProjectResponse),
        (status = 404, description = "Project not found", body = crate::error::ErrorResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn get_project(
    pool: web::Data<DbPool>,
    config: web::Data<Config>,
    path: web::Path<i32>,
    _user: AuthenticatedUser, // Requires authentication
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    let project = ProjectService::get_by_id(pool.get_ref(), id).await?;
    let base_url = build_base_url(&config);

    Ok(HttpResponse::Ok().json(project.to_response(&base_url)))
}

/// POST /api/projects - Create a new project
#[utoipa::path(
    post,
    path = "/api/projects",
    tag = "projects",
    request_body = CreateProject,
    responses(
        (status = 201, description = "Project created", body = crate::models::project::ProjectResponse),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 409, description = "Conflict (name/slug taken)", body = crate::error::ErrorResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn create_project(
    pool: web::Data<DbPool>,
    config: web::Data<Config>,
    body: web::Json<CreateProject>,
    _user: AuthenticatedUser, // Requires authentication
) -> AppResult<HttpResponse> {
    let project = ProjectService::create(pool.get_ref(), body.into_inner()).await?;
    let base_url = build_base_url(&config);

    Ok(HttpResponse::Created().json(project.to_response(&base_url)))
}

/// PATCH /api/projects/{id} - Update a project
#[utoipa::path(
    patch,
    path = "/api/projects/{id}",
    tag = "projects",
    params(("id" = i32, Path, description = "Project ID")),
    request_body = UpdateProject,
    responses(
        (status = 200, description = "Project updated", body = crate::models::project::ProjectResponse),
        (status = 404, description = "Project not found", body = crate::error::ErrorResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn update_project(
    pool: web::Data<DbPool>,
    config: web::Data<Config>,
    path: web::Path<i32>,
    body: web::Json<UpdateProject>,
    _user: AuthenticatedUser, // Requires authentication
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    let project = ProjectService::update(pool.get_ref(), id, body.into_inner()).await?;
    let base_url = build_base_url(&config);

    Ok(HttpResponse::Ok().json(project.to_response(&base_url)))
}

/// DELETE /api/projects/{id} - Delete a project
#[utoipa::path(
    delete,
    path = "/api/projects/{id}",
    tag = "projects",
    params(("id" = i32, Path, description = "Project ID")),
    responses(
        (status = 204, description = "Project deleted"),
        (status = 404, description = "Project not found", body = crate::error::ErrorResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn delete_project(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    _user: AuthenticatedUser, // Requires authentication
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    ProjectService::delete(pool.get_ref(), id).await?;

    Ok(HttpResponse::NoContent().finish())
}

/// Configure project routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/projects")
            .route("", web::get().to(list_projects))
            .route("", web::post().to(create_project))
            .route("/{id}", web::get().to(get_project))
            .route("/{id}", web::patch().to(update_project))
            .route("/{id}", web::delete().to(delete_project)),
    );
}

/// Build base URL from config
fn build_base_url(config: &Config) -> String {
    format!("{}:{}", config.host, config.port)
}
