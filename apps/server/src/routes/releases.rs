use actix_web::{web, HttpResponse};

use crate::auth::ApiActor;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::services::access::{self, Action};
use crate::services::{IssueService, ProjectService};

#[cfg(feature = "openapi")]
use crate::models::IssueResponse;
#[cfg(feature = "openapi")]
use utoipa::OpenApi;

/// Query params for the new-issues endpoint.
#[derive(serde::Deserialize)]
pub struct NewIssuesQuery {
    /// Max issues to return (default: 10, clamped to 1-50).
    pub limit: Option<i64>,
}

impl NewIssuesQuery {
    fn limit(&self) -> i64 {
        self.limit.unwrap_or(10).clamp(1, 50)
    }
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/releases/{release}/new-issues",
    tag = "Releases",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("release" = String, Path, description = "Release version"),
        ("limit" = Option<i64>, Query, description = "Max issues to return (default: 10, max: 50)"),
    ),
    responses(
        (status = 200, description = "Issues first seen in this release, most recent first", body = Vec<IssueResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/releases/{release}/new-issues
pub async fn new_issues_for_release(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, String)>,
    query: web::Query<NewIssuesQuery>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let (project_id, release) = path.into_inner();

    access::require(
        pool.get_ref(),
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ViewProject,
    )
    .await?;

    let project = ProjectService::get_by_id(pool.get_ref(), project_id).await?;

    let issues =
        IssueService::top_issues_for_release(pool.get_ref(), project_id, &release, query.limit())
            .await?;

    let responses: Vec<_> = issues
        .iter()
        .map(|i| i.to_response(&project.slug))
        .collect();

    Ok(HttpResponse::Ok().json(responses))
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(paths(new_issues_for_release), components(schemas(IssueResponse)))]
pub struct ReleasesApi;

/// Configure release routes.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(web::scope("/api/projects/{project_id}/releases").route(
        "/{release}/new-issues",
        web::get().to(new_issues_for_release),
    ));
}
