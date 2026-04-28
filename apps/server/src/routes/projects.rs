use actix_web::{web, HttpResponse};

use crate::auth::AuthenticatedUser;
use crate::config::Config;
use crate::db::DbPool;
use crate::error::AppResult;
#[cfg(feature = "openapi")]
use crate::models::ProjectResponse;
use crate::models::{CreateProject, UpdateProject};
use crate::pagination::{ListProjectsQuery, OffsetPaginatedResponse};
use crate::services::ProjectService;

#[cfg(feature = "openapi")]
use utoipa::OpenApi;

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects",
    tag = "Projects",
    params(ListProjectsQuery),
    responses(
        (status = 200, description = "List of projects", body = inline(crate::pagination::OffsetPaginatedResponse<ProjectResponse>)),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects - List projects with pagination
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

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{id}",
    tag = "Projects",
    params(("id" = i32, Path, description = "Project ID")),
    responses(
        (status = 200, description = "Project details", body = ProjectResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{id} - Get a project by ID
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

#[cfg_attr(feature = "openapi", utoipa::path(
    post,
    path = "/api/projects",
    tag = "Projects",
    request_body = CreateProject,
    responses(
        (status = 201, description = "Project created", body = ProjectResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 409, description = "Conflict", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// POST /api/projects - Create a new project
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

#[cfg_attr(feature = "openapi", utoipa::path(
    patch,
    path = "/api/projects/{id}",
    tag = "Projects",
    params(("id" = i32, Path, description = "Project ID")),
    request_body = UpdateProject,
    responses(
        (status = 200, description = "Project updated", body = ProjectResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
        (status = 409, description = "Conflict", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// PATCH /api/projects/{id} - Update a project
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

#[cfg_attr(feature = "openapi", utoipa::path(
    delete,
    path = "/api/projects/{id}",
    tag = "Projects",
    params(("id" = i32, Path, description = "Project ID")),
    responses(
        (status = 204, description = "Project deleted"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// DELETE /api/projects/{id} - Delete a project
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

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(
    paths(
        list_projects,
        get_project,
        create_project,
        update_project,
        delete_project
    ),
    components(schemas(
        crate::models::ProjectResponse,
        crate::models::CreateProject,
        crate::models::UpdateProject,
        crate::error::ErrorResponse,
        crate::error::ErrorDetail,
    ))
)]
pub struct ProjectsApi;
