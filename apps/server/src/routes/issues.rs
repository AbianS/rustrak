use actix_web::{web, HttpResponse};
use uuid::Uuid;

use crate::auth::AuthenticatedUser;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::UpdateIssueState;
use crate::pagination::{ListIssuesQuery, OffsetPaginatedIssueResponse, OffsetPaginatedResponse};
use crate::services::{IssueService, ProjectService};

/// GET /api/projects/{project_id}/issues
/// Lists issues for a project with offset-based pagination
#[utoipa::path(
    get,
    path = "/api/projects/{project_id}/issues",
    tag = "issues",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ListIssuesQuery,
    ),
    responses(
        (status = 200, description = "List of issues", body = OffsetPaginatedIssueResponse),
        (status = 404, description = "Project not found", body = crate::error::ErrorResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn list_issues(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    query: web::Query<ListIssuesQuery>,
    _user: AuthenticatedUser,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();

    // Verify project exists and get slug for response
    let project = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

    // Execute paginated query with offset
    let (issues, total_count) = IssueService::list_offset(
        pool.get_ref(),
        project_id,
        query.sort,
        query.order,
        query.filter,
        query.page,
        query.per_page,
    )
    .await?;

    // Build responses
    let responses: Vec<_> = issues
        .iter()
        .map(|i| i.to_response(&project.slug))
        .collect();

    Ok(HttpResponse::Ok().json(OffsetPaginatedResponse::new(
        responses,
        total_count,
        query.page,
        query.per_page,
    )))
}

/// GET /api/projects/{project_id}/issues/{issue_id}
/// Gets a single issue by ID
#[utoipa::path(
    get,
    path = "/api/projects/{project_id}/issues/{issue_id}",
    tag = "issues",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("issue_id" = Uuid, Path, description = "Issue ID"),
    ),
    responses(
        (status = 200, description = "Issue details", body = crate::models::issue::IssueResponse),
        (status = 404, description = "Issue not found", body = crate::error::ErrorResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn get_issue(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    _user: AuthenticatedUser,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();

    // Verify project exists and get slug
    let project = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

    // Get issue and verify it belongs to the project
    let issue = IssueService::get_by_id(pool.get_ref(), issue_id).await?;

    if issue.project_id != project_id {
        return Err(AppError::NotFound(format!("Issue {} not found", issue_id)));
    }

    Ok(HttpResponse::Ok().json(issue.to_response(&project.slug)))
}

/// PATCH /api/projects/{project_id}/issues/{issue_id}
/// Updates issue state (resolve, mute, etc.)
#[utoipa::path(
    patch,
    path = "/api/projects/{project_id}/issues/{issue_id}",
    tag = "issues",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("issue_id" = Uuid, Path, description = "Issue ID"),
    ),
    request_body = UpdateIssueState,
    responses(
        (status = 200, description = "Issue updated", body = crate::models::issue::IssueResponse),
        (status = 404, description = "Issue not found", body = crate::error::ErrorResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn update_issue(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    body: web::Json<UpdateIssueState>,
    _user: AuthenticatedUser,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();

    // Verify project exists and get slug
    let project = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

    // Verify issue belongs to the project
    let issue = IssueService::get_by_id(pool.get_ref(), issue_id).await?;
    if issue.project_id != project_id {
        return Err(AppError::NotFound(format!("Issue {} not found", issue_id)));
    }

    // Apply state changes
    // Priority: is_resolved takes precedence over is_muted
    let updated = match (body.is_resolved, body.is_muted) {
        (Some(true), _) => IssueService::resolve(pool.get_ref(), issue_id).await?,
        (Some(false), _) => IssueService::unresolve(pool.get_ref(), issue_id).await?,
        (None, Some(true)) => IssueService::mute(pool.get_ref(), issue_id).await?,
        (None, Some(false)) => IssueService::unmute(pool.get_ref(), issue_id).await?,
        (None, None) => issue, // No changes requested
    };

    Ok(HttpResponse::Ok().json(updated.to_response(&project.slug)))
}

/// DELETE /api/projects/{project_id}/issues/{issue_id}
/// Soft-deletes an issue
#[utoipa::path(
    delete,
    path = "/api/projects/{project_id}/issues/{issue_id}",
    tag = "issues",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("issue_id" = Uuid, Path, description = "Issue ID"),
    ),
    responses(
        (status = 204, description = "Issue deleted"),
        (status = 404, description = "Issue not found", body = crate::error::ErrorResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn delete_issue(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    _user: AuthenticatedUser,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();

    // Verify issue belongs to the project before deleting
    let issue = IssueService::get_by_id(pool.get_ref(), issue_id).await?;
    if issue.project_id != project_id {
        return Err(AppError::NotFound(format!("Issue {} not found", issue_id)));
    }

    IssueService::delete(pool.get_ref(), issue_id).await?;

    Ok(HttpResponse::NoContent().finish())
}

/// Configure issue routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/projects/{project_id}/issues")
            .route("", web::get().to(list_issues))
            .route("/{issue_id}", web::get().to(get_issue))
            .route("/{issue_id}", web::patch().to(update_issue))
            .route("/{issue_id}", web::delete().to(delete_issue)),
    );
}
