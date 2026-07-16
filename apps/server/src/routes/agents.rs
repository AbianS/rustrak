//! AI Agent Monitoring dashboard API (story-ai-agent-monitoring.md, GH #180).
//!
//! Powers the 7 dashboard widgets: Agent Runs, Estimated Cost, Duration,
//! LLM Calls by Model, Tokens Used by Model, Tool Calls by Tool, Traces.

use actix_web::{web, HttpResponse};

use crate::auth::ApiActor;
use crate::db::DbPool;
use crate::error::AppResult;
#[cfg(feature = "openapi")]
use crate::models::{
    AgentDurationPoint, AgentTimeseriesPoint, AgentTraceSummary, GenAiBreakdownRow,
};
use crate::pagination::{
    AgentBreakdownQuery, AgentTimeseriesQuery, AgentTracesQuery, OffsetPaginatedResponse,
};
use crate::services::access::{self, Action};
use crate::services::span::SpanService;

#[cfg(feature = "openapi")]
use utoipa::OpenApi;

async fn require_view_access(pool: &DbPool, project_id: i32, actor: &ApiActor) -> AppResult<()> {
    access::require(
        pool,
        actor.is_admin(),
        actor.user_id(),
        project_id,
        Action::ViewProject,
    )
    .await
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/agents/runs",
    tag = "Agents",
    params(("project_id" = i32, Path, description = "Project ID"), AgentTimeseriesQuery),
    responses(
        (status = 200, description = "Agent runs over time", body = Vec<AgentTimeseriesPoint>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/agents/runs
/// Time-bucketed count of agent-run spans (`gen_ai.operation.type:agent`).
pub async fn agent_runs(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    query: web::Query<AgentTimeseriesQuery>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();
    require_view_access(pool.get_ref(), project_id, &actor).await?;

    let points = SpanService::agent_runs_timeseries(
        pool.get_ref(),
        project_id,
        query.period_hours,
        query.interval_hours,
    )
    .await?;

    Ok(HttpResponse::Ok().json(points))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/agents/cost",
    tag = "Agents",
    params(("project_id" = i32, Path, description = "Project ID"), AgentTimeseriesQuery),
    responses(
        (status = 200, description = "Estimated LLM cost over time", body = Vec<AgentTimeseriesPoint>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/agents/cost
/// Time-bucketed sum of estimated LLM call cost (`gen_ai.operation.type:ai_client`).
pub async fn agent_cost(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    query: web::Query<AgentTimeseriesQuery>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();
    require_view_access(pool.get_ref(), project_id, &actor).await?;

    let points = SpanService::estimated_cost_timeseries(
        pool.get_ref(),
        project_id,
        query.period_hours,
        query.interval_hours,
    )
    .await?;

    Ok(HttpResponse::Ok().json(points))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/agents/duration",
    tag = "Agents",
    params(("project_id" = i32, Path, description = "Project ID"), AgentTimeseriesQuery),
    responses(
        (status = 200, description = "Avg/p95 duration over time for agent runs and LLM calls", body = Vec<AgentDurationPoint>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/agents/duration
/// Time-bucketed avg/p95 duration for `agent`/`ai_client` spans.
pub async fn agent_duration(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    query: web::Query<AgentTimeseriesQuery>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();
    require_view_access(pool.get_ref(), project_id, &actor).await?;

    let points = SpanService::agent_duration_timeseries(
        pool.get_ref(),
        project_id,
        query.period_hours,
        query.interval_hours,
    )
    .await?;

    Ok(HttpResponse::Ok().json(points))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/agents/models/calls",
    tag = "Agents",
    params(("project_id" = i32, Path, description = "Project ID"), AgentBreakdownQuery),
    responses(
        (status = 200, description = "Top LLM call counts by response model", body = Vec<GenAiBreakdownRow>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/agents/models/calls
/// Top models by LLM call count (`gen_ai.operation.type:ai_client`).
pub async fn agent_models_calls(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    query: web::Query<AgentBreakdownQuery>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();
    require_view_access(pool.get_ref(), project_id, &actor).await?;

    let rows = SpanService::llm_calls_by_model(
        pool.get_ref(),
        project_id,
        query.period_hours,
        query.limit,
    )
    .await?;

    Ok(HttpResponse::Ok().json(rows))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/agents/models/tokens",
    tag = "Agents",
    params(("project_id" = i32, Path, description = "Project ID"), AgentBreakdownQuery),
    responses(
        (status = 200, description = "Top total tokens used by response model", body = Vec<GenAiBreakdownRow>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/agents/models/tokens
/// Top models by total tokens used (`gen_ai.operation.type:ai_client`).
pub async fn agent_models_tokens(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    query: web::Query<AgentBreakdownQuery>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();
    require_view_access(pool.get_ref(), project_id, &actor).await?;

    let rows =
        SpanService::tokens_by_model(pool.get_ref(), project_id, query.period_hours, query.limit)
            .await?;

    Ok(HttpResponse::Ok().json(rows))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/agents/tools",
    tag = "Agents",
    params(("project_id" = i32, Path, description = "Project ID"), AgentBreakdownQuery),
    responses(
        (status = 200, description = "Top tool call counts by tool name", body = Vec<GenAiBreakdownRow>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/agents/tools
/// Top tools by call count (`gen_ai.operation.type:tool`).
pub async fn agent_tools(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    query: web::Query<AgentBreakdownQuery>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();
    require_view_access(pool.get_ref(), project_id, &actor).await?;

    let rows = SpanService::tool_calls_by_tool(
        pool.get_ref(),
        project_id,
        query.period_hours,
        query.limit,
    )
    .await?;

    Ok(HttpResponse::Ok().json(rows))
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/agents/traces",
    tag = "Agents",
    params(("project_id" = i32, Path, description = "Project ID"), AgentTracesQuery),
    responses(
        (status = 200, description = "Paginated agent traces", body = inline(crate::pagination::OffsetPaginatedResponse<AgentTraceSummary>)),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/agents/traces
/// Paginated per-trace_id aggregate (duration, tokens, cost, tool usage)
/// across all AI spans sharing that trace, regardless of origin.
pub async fn agent_traces(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    query: web::Query<AgentTracesQuery>,
    actor: ApiActor,
) -> AppResult<HttpResponse> {
    let project_id = path.into_inner();
    require_view_access(pool.get_ref(), project_id, &actor).await?;

    let page = query.page.max(1);
    let per_page = query.per_page.clamp(1, 100);

    let (traces, total_count) =
        SpanService::agent_traces(pool.get_ref(), project_id, page, per_page).await?;

    Ok(HttpResponse::Ok().json(OffsetPaginatedResponse::new(
        traces,
        total_count,
        page,
        per_page,
    )))
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(paths(
    agent_runs,
    agent_cost,
    agent_duration,
    agent_models_calls,
    agent_models_tokens,
    agent_tools,
    agent_traces,
))]
pub struct AgentsApi;

/// Configure AI Agent Monitoring dashboard routes.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/projects/{project_id}/agents")
            .route("/runs", web::get().to(agent_runs))
            .route("/cost", web::get().to(agent_cost))
            .route("/duration", web::get().to(agent_duration))
            .route("/models/calls", web::get().to(agent_models_calls))
            .route("/models/tokens", web::get().to(agent_models_tokens))
            .route("/tools", web::get().to(agent_tools))
            .route("/traces", web::get().to(agent_traces)),
    );
}
