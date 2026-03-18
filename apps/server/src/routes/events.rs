use actix_web::{web, HttpResponse};
use uuid::Uuid;

use crate::auth::AuthenticatedUser;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::pagination::{EventCursor, ListEventsQuery, PaginatedEventResponse, PaginatedResponse, PAGE_SIZE};
use crate::services::{EventService, IssueService};

/// GET /api/projects/{project_id}/issues/{issue_id}/events
/// Lists events for an issue with cursor-based pagination
#[utoipa::path(
    get,
    path = "/api/projects/{project_id}/issues/{issue_id}/events",
    tag = "events",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("issue_id" = Uuid, Path, description = "Issue ID"),
        ListEventsQuery,
    ),
    responses(
        (status = 200, description = "List of events", body = PaginatedEventResponse),
        (status = 404, description = "Issue not found", body = crate::error::ErrorResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn list_events(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid)>,
    query: web::Query<ListEventsQuery>,
    _user: AuthenticatedUser,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id) = path.into_inner();

    // Verify issue exists and belongs to the project
    let issue = IssueService::get_by_id(pool.get_ref(), issue_id).await?;
    if issue.project_id != project_id {
        return Err(AppError::NotFound(format!("Issue {} not found", issue_id)));
    }

    // Parse cursor if provided
    let cursor = query
        .cursor
        .as_ref()
        .map(|c| EventCursor::decode(c))
        .transpose()?;

    // Execute paginated query
    let (events, has_more) = EventService::list_paginated(
        pool.get_ref(),
        issue_id,
        query.order,
        cursor.as_ref(),
        PAGE_SIZE,
    )
    .await?;

    // Build responses (without full data field)
    let responses: Vec<_> = events.iter().map(|e| e.to_response()).collect();

    // Build next cursor if there are more results
    let next_cursor = if has_more {
        events
            .last()
            .map(|last| EventCursor::new(query.order.as_str(), last.digest_order).encode())
            .transpose()?
    } else {
        None
    };

    Ok(HttpResponse::Ok().json(PaginatedResponse::new(responses, next_cursor, has_more)))
}

/// GET /api/projects/{project_id}/issues/{issue_id}/events/{event_id}
/// Gets a single event with full data
#[utoipa::path(
    get,
    path = "/api/projects/{project_id}/issues/{issue_id}/events/{event_id}",
    tag = "events",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ("issue_id" = Uuid, Path, description = "Issue ID"),
        ("event_id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "Event details", body = crate::models::event::EventDetailResponse),
        (status = 404, description = "Event not found", body = crate::error::ErrorResponse),
    ),
    security(("session_auth" = []), ("bearer_auth" = [])),
)]
pub async fn get_event(
    pool: web::Data<DbPool>,
    path: web::Path<(i32, Uuid, Uuid)>,
    _user: AuthenticatedUser,
) -> AppResult<HttpResponse> {
    let (project_id, issue_id, event_id) = path.into_inner();

    // Verify issue exists and belongs to the project
    let issue = IssueService::get_by_id(pool.get_ref(), issue_id).await?;
    if issue.project_id != project_id {
        return Err(AppError::NotFound(format!("Issue {} not found", issue_id)));
    }

    // Get event and verify it belongs to the issue
    let event = EventService::get_by_id(pool.get_ref(), event_id).await?;
    if event.issue_id != issue_id {
        return Err(AppError::NotFound(format!("Event {} not found", event_id)));
    }

    // Return full detail response (includes data field)
    Ok(HttpResponse::Ok().json(event.to_detail_response()))
}

/// Configure event routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/projects/{project_id}/issues/{issue_id}/events")
            .route("", web::get().to(list_events))
            .route("/{event_id}", web::get().to(get_event)),
    );
}
