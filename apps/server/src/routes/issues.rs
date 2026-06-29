use actix_web::{web, HttpResponse};
use uuid::Uuid;

use crate::auth::ApiActor;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
#[cfg(feature = "openapi")]
use crate::models::IssueResponse;
use crate::models::{BulkDeleteIssues, BulkUpdateIssues, UpdateIssueState};
use crate::pagination::{ListIssuesQuery, OffsetPaginatedResponse};
use crate::services::access::{self, Action};
use crate::services::{IssueService, IssueSocialService, ProjectService};
use serde::Deserialize;
use serde_json::json;

/// Body for creating an issue comment (note).
#[derive(Debug, Deserialize)]
pub struct CommentRequest {
    pub text: String,
}

/// Body for toggling a per-user flag (bookmark/subscription).
#[derive(Debug, Deserialize)]
pub struct ToggleRequest {
    #[serde(default)]
    pub enabled: Option<bool>,
}

/// Body for submitting user feedback on an issue.
#[derive(Debug, Deserialize)]
pub struct UserReportRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub comments: Option<String>,
    #[serde(default)]
    pub event_id: Option<Uuid>,
}

#[cfg(feature = "openapi")]
use utoipa::OpenApi;

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/issues",
    tag = "Issues",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ListIssuesQuery,
    ),
    responses(
        (status = 200, description = "List of issues", body = inline(crate::pagination::OffsetPaginatedResponse<IssueResponse>)),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Project not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/issues
/// Lists issues for a project with offset-based pagination
pub async fn list_issues(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    query: web::Query<ListIssuesQuery>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();

    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ViewProject,
    )
    .await?;

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
        query.q.as_deref(),
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

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/issues/{issue_id}",
    tag = "Issues",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("issue_id" = uuid::Uuid, Path, description = "Issue ID"),
    ),
    responses(
        (status = 200, description = "Issue details", body = IssueResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/issues/{issue_id}
/// Gets a single issue by ID
pub async fn get_issue(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();

    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ViewProject,
    )
    .await?;

    // Verify project exists and get slug
    let project = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

    // Get issue and verify it belongs to the project
    let issue = IssueService::get_by_id(pool.get_ref(), issue_id).await?;

    if issue.project_id != project_id {
        return Err(AppError::NotFound(format!("Issue {} not found", issue_id)));
    }

    // Enrich with per-user and aggregate fields.
    let mut body = serde_json::to_value(issue.to_response(&project.slug))
        .unwrap_or_else(|_| json!({}));
    body["user_report_count"] =
        json!(IssueSocialService::user_report_count(pool.get_ref(), issue_id).await?);
    if let Some(user_id) = actor.user_id() {
        body["is_bookmarked"] =
            json!(IssueSocialService::is_bookmarked(pool.get_ref(), issue_id, user_id).await?);
        body["is_subscribed"] =
            json!(IssueSocialService::is_subscribed(pool.get_ref(), issue_id, user_id).await?);
        body["has_seen"] =
            json!(IssueSocialService::has_seen(pool.get_ref(), issue_id, user_id).await?);
    }

    Ok(HttpResponse::Ok().json(body))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    patch,
    path = "/api/projects/{project_id}/issues/{issue_id}",
    tag = "Issues",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("issue_id" = uuid::Uuid, Path, description = "Issue ID"),
    ),
    request_body = UpdateIssueState,
    responses(
        (status = 200, description = "Issue updated", body = IssueResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// PATCH /api/projects/{project_id}/issues/{issue_id}
/// Updates issue state (resolve, mute, etc.)
pub async fn update_issue(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    body: web::Json<UpdateIssueState>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();

    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::MutateIssue,
    )
    .await?;

    // Verify project exists and get slug
    let project = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

    // Verify issue belongs to the project
    let issue = IssueService::get_by_id(pool.get_ref(), issue_id).await?;
    if issue.project_id != project_id {
        return Err(AppError::NotFound(format!("Issue {} not found", issue_id)));
    }

    // Apply state changes. `status` (canonical) and is_resolved/is_muted
    // (deprecated) are unified via `resolved_status()`.
    let mut updated = issue;
    // Special case: resolve in the next release (suppresses regression until a
    // new deploy is recorded).
    if body.status.as_deref() == Some("resolvedInNextRelease") {
        updated = IssueService::resolve_in_next_release(pool.get_ref(), issue_id).await?;
        IssueSocialService::record_status_change(
            pool.get_ref(),
            issue_id,
            actor.user_id(),
            "resolvedInNextRelease",
        )
        .await?;
    } else if let Some(status) = body.resolved_status() {
        updated = IssueService::set_status(pool.get_ref(), issue_id, status).await?;
        IssueSocialService::record_status_change(
            pool.get_ref(),
            issue_id,
            actor.user_id(),
            status,
        )
        .await?;
    }
    if let Some(priority) = body.priority.as_deref() {
        updated = IssueService::set_priority(pool.get_ref(), issue_id, priority).await?;
    }
    if body.assigned_to.is_some() || body.assignee_type.is_some() {
        updated = IssueService::assign(
            pool.get_ref(),
            issue_id,
            body.assigned_to,
            body.assignee_type.as_deref(),
        )
        .await?;
    }

    Ok(HttpResponse::Ok().json(updated.to_response(&project.slug)))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    delete,
    path = "/api/projects/{project_id}/issues/{issue_id}",
    tag = "Issues",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("issue_id" = uuid::Uuid, Path, description = "Issue ID"),
    ),
    responses(
        (status = 204, description = "Issue deleted"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// DELETE /api/projects/{project_id}/issues/{issue_id}
/// Hard-deletes an issue and all associated events
pub async fn delete_issue(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();

    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::MutateIssue,
    )
    .await?;

    // Verify issue belongs to the project before deleting
    let issue = IssueService::get_by_id(pool.get_ref(), issue_id).await?;
    if issue.project_id != project_id {
        return Err(AppError::NotFound(format!("Issue {} not found", issue_id)));
    }

    IssueService::delete(pool.get_ref(), issue_id).await?;

    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/projects/{project_id}/issues/{issue_id}/hashes
/// Lists the grouping hashes that map to an issue.
pub async fn get_issue_hashes(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();
    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ViewProject,
    )
    .await?;

    let issue = IssueService::get_by_id(pool.get_ref(), issue_id).await?;
    if issue.project_id != project_id {
        return Err(AppError::NotFound(format!("Issue {} not found", issue_id)));
    }

    let hashes = IssueService::list_hashes(pool.get_ref(), issue_id).await?;
    Ok(HttpResponse::Ok().json(hashes))
}

/// GET /api/projects/{project_id}/issues/{issue_id}/tags/{key}
/// Lists the distinct values (with counts) for a tag key across the issue.
pub async fn get_issue_tag_values(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid, String)>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id, key) = path.into_inner();
    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ViewProject,
    )
    .await?;

    let issue = IssueService::get_by_id(pool.get_ref(), issue_id).await?;
    if issue.project_id != project_id {
        return Err(AppError::NotFound(format!("Issue {} not found", issue_id)));
    }

    let values = IssueService::tag_values(pool.get_ref(), issue_id, &key).await?;
    Ok(HttpResponse::Ok().json(json!({ "key": key, "values": values })))
}

/// GET /api/projects/{project_id}/issues/{issue_id}/aggregates
/// Returns the unique user count and top tags for the issue.
pub async fn get_issue_aggregates(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();
    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ViewProject,
    )
    .await?;

    let issue = IssueService::get_by_id(pool.get_ref(), issue_id).await?;
    if issue.project_id != project_id {
        return Err(AppError::NotFound(format!("Issue {} not found", issue_id)));
    }

    let aggregates = IssueService::aggregates(pool.get_ref(), issue_id).await?;
    Ok(HttpResponse::Ok().json(aggregates))
}

/// PUT /api/projects/{project_id}/issues  (bulk mutate)
pub async fn bulk_update_issues(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    body: web::Json<BulkUpdateIssues>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();
    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::MutateIssue,
    )
    .await?;

    let mut updated = 0u64;
    if let Some(status) = body.status.as_deref() {
        updated = IssueService::bulk_set_status(pool.get_ref(), project_id, &body.ids, status).await?;
    }
    if let Some(priority) = body.priority.as_deref() {
        for id in &body.ids {
            // Best-effort: only touch issues in this project.
            let issue = IssueService::get_by_id(pool.get_ref(), *id).await;
            if let Ok(issue) = issue {
                if issue.project_id == project_id {
                    IssueService::set_priority(pool.get_ref(), *id, priority).await?;
                }
            }
        }
    }

    Ok(HttpResponse::Ok().json(json!({ "updated": updated })))
}

/// DELETE /api/projects/{project_id}/issues  (bulk delete)
pub async fn bulk_delete_issues(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    body: web::Json<BulkDeleteIssues>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();
    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::MutateIssue,
    )
    .await?;

    let deleted = IssueService::bulk_delete(pool.get_ref(), project_id, &body.ids).await?;
    Ok(HttpResponse::Ok().json(json!({ "deleted": deleted })))
}

/// Body for recording a deploy.
#[derive(Debug, Deserialize)]
pub struct DeployRequest {
    pub version: String,
}

/// POST /api/projects/{project_id}/deploys — record a release deploy, which
/// finalizes issues that were "resolved in the next release".
pub async fn create_deploy(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    body: web::Json<DeployRequest>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();
    access::require(pool.get_ref(), actor.is_admin(), actor.user_id(), project_id, Action::MutateIssue).await?;
    let finalized =
        IssueService::finalize_release(pool.get_ref(), project_id, &body.version).await?;
    Ok(HttpResponse::Ok().json(json!({ "version": body.version, "finalized": finalized })))
}

/// Loads an issue and verifies it belongs to the project (helper for sub-routes).
async fn require_issue_in_project(
    pool: &DbPool,
    project_id: i32,
    issue_id: Uuid,
) -> AppResult<()> {
    let issue = IssueService::get_by_id(pool, issue_id).await?;
    if issue.project_id != project_id {
        return Err(AppError::NotFound(format!("Issue {} not found", issue_id)));
    }
    Ok(())
}

fn require_user(actor: &ApiActor) -> AppResult<i32> {
    actor
        .user_id()
        .ok_or_else(|| AppError::Validation("This action requires a user session".to_string()))
}

/// GET /{issue_id}/stats?window=24h|30d — zero-filled event-count timeseries.
pub async fn get_issue_stats(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    query: web::Query<std::collections::HashMap<String, String>>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();
    access::require(pool.get_ref(), actor.is_admin(), actor.user_id(), project_id, Action::ViewProject).await?;
    require_issue_in_project(pool.get_ref(), project_id, issue_id).await?;

    // window=24h → 24 hourly buckets; window=30d → 30 daily buckets.
    let (bucket_secs, buckets) = match query.get("window").map(String::as_str) {
        Some("30d") => (86_400, 30),
        _ => (3_600, 24),
    };
    let series = IssueService::stats(pool.get_ref(), issue_id, bucket_secs, buckets).await?;
    let points: Vec<_> = series
        .into_iter()
        .map(|(ts, count)| json!([ts, count]))
        .collect();
    Ok(HttpResponse::Ok().json(json!({ "data": points })))
}

/// GET /{issue_id}/activity — chronological activity log (incl. comments).
pub async fn get_issue_activity(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();
    access::require(pool.get_ref(), actor.is_admin(), actor.user_id(), project_id, Action::ViewProject).await?;
    require_issue_in_project(pool.get_ref(), project_id, issue_id).await?;
    let activity = IssueSocialService::list_activity(pool.get_ref(), issue_id).await?;
    Ok(HttpResponse::Ok().json(activity))
}

/// POST /{issue_id}/comments — add a note.
pub async fn create_issue_comment(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    body: web::Json<CommentRequest>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();
    access::require(pool.get_ref(), actor.is_admin(), actor.user_id(), project_id, Action::MutateIssue).await?;
    require_issue_in_project(pool.get_ref(), project_id, issue_id).await?;
    let entry =
        IssueSocialService::add_comment(pool.get_ref(), issue_id, actor.user_id(), &body.text)
            .await?;
    Ok(HttpResponse::Created().json(entry))
}

/// PUT /{issue_id}/bookmark — set/clear the per-user bookmark.
pub async fn set_issue_bookmark(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    body: web::Json<ToggleRequest>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();
    access::require(pool.get_ref(), actor.is_admin(), actor.user_id(), project_id, Action::ViewProject).await?;
    require_issue_in_project(pool.get_ref(), project_id, issue_id).await?;
    let user_id = require_user(&actor)?;
    let enabled = body.enabled.unwrap_or(true);
    IssueSocialService::set_bookmark(pool.get_ref(), issue_id, user_id, enabled).await?;
    Ok(HttpResponse::Ok().json(json!({ "is_bookmarked": enabled })))
}

/// PUT /{issue_id}/subscription — set/clear the per-user subscription.
pub async fn set_issue_subscription(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    body: web::Json<ToggleRequest>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();
    access::require(pool.get_ref(), actor.is_admin(), actor.user_id(), project_id, Action::ViewProject).await?;
    require_issue_in_project(pool.get_ref(), project_id, issue_id).await?;
    let user_id = require_user(&actor)?;
    let enabled = body.enabled.unwrap_or(true);
    IssueSocialService::set_subscription(pool.get_ref(), issue_id, user_id, enabled, "manual")
        .await?;
    Ok(HttpResponse::Ok().json(json!({ "is_subscribed": enabled })))
}

/// POST /{issue_id}/seen — mark the issue as seen by the current user.
pub async fn mark_issue_seen(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();
    access::require(pool.get_ref(), actor.is_admin(), actor.user_id(), project_id, Action::ViewProject).await?;
    require_issue_in_project(pool.get_ref(), project_id, issue_id).await?;
    let user_id = require_user(&actor)?;
    IssueSocialService::mark_seen(pool.get_ref(), issue_id, user_id).await?;
    Ok(HttpResponse::Ok().json(json!({ "has_seen": true })))
}

/// GET /{issue_id}/user-reports — list user feedback for an issue.
pub async fn list_issue_user_reports(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();
    access::require(pool.get_ref(), actor.is_admin(), actor.user_id(), project_id, Action::ViewProject).await?;
    require_issue_in_project(pool.get_ref(), project_id, issue_id).await?;
    let reports = IssueSocialService::list_user_reports(pool.get_ref(), issue_id).await?;
    Ok(HttpResponse::Ok().json(reports))
}

/// POST /{issue_id}/user-reports — attach user feedback to an issue.
pub async fn create_issue_user_report(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    body: web::Json<UserReportRequest>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();
    access::require(pool.get_ref(), actor.is_admin(), actor.user_id(), project_id, Action::MutateIssue).await?;
    require_issue_in_project(pool.get_ref(), project_id, issue_id).await?;
    let report = IssueSocialService::create_user_report(
        pool.get_ref(),
        project_id,
        Some(issue_id),
        body.event_id,
        body.name.as_deref().unwrap_or_default(),
        body.email.as_deref().unwrap_or_default(),
        body.comments.as_deref().unwrap_or_default(),
    )
    .await?;
    Ok(HttpResponse::Created().json(report))
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(
    paths(list_issues, get_issue, update_issue, delete_issue),
    components(schemas(crate::models::IssueResponse, crate::models::UpdateIssueState,))
)]
pub struct IssuesApi;

/// Configure issue routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/projects/{project_id}/issues")
            .route("", web::get().to(list_issues))
            .route("", web::put().to(bulk_update_issues))
            .route("", web::delete().to(bulk_delete_issues))
            .route("/{issue_id}/hashes", web::get().to(get_issue_hashes))
            .route("/{issue_id}/aggregates", web::get().to(get_issue_aggregates))
            .route("/{issue_id}/tags/{key}", web::get().to(get_issue_tag_values))
            .route("/{issue_id}/stats", web::get().to(get_issue_stats))
            .route("/{issue_id}/activity", web::get().to(get_issue_activity))
            .route("/{issue_id}/comments", web::post().to(create_issue_comment))
            .route("/{issue_id}/bookmark", web::put().to(set_issue_bookmark))
            .route("/{issue_id}/subscription", web::put().to(set_issue_subscription))
            .route("/{issue_id}/seen", web::post().to(mark_issue_seen))
            .route("/{issue_id}/user-reports", web::get().to(list_issue_user_reports))
            .route("/{issue_id}/user-reports", web::post().to(create_issue_user_report))
            .route("/{issue_id}", web::get().to(get_issue))
            .route("/{issue_id}", web::patch().to(update_issue))
            .route("/{issue_id}", web::put().to(update_issue))
            .route("/{issue_id}", web::delete().to(delete_issue)),
    );
    cfg.route(
        "/api/projects/{project_id}/deploys",
        web::post().to(create_deploy),
    );
}
