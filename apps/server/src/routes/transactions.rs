use actix_web::{web, HttpResponse};

use crate::auth::ApiActor;
use crate::db::DbPool;
use crate::error::AppResult;
#[cfg(feature = "openapi")]
use crate::models::TransactionResponse;
use crate::pagination::{PaginatedResponse, TransactionCursor, PAGE_SIZE};
use crate::services::access::{self, Action};
use crate::services::TransactionService;

#[cfg(feature = "openapi")]
use utoipa::OpenApi;

/// Query parameters for listing transactions
#[derive(Debug, serde::Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct ListTransactionsQuery {
    /// Pagination cursor (opaque, from previous response)
    pub cursor: Option<String>,
}

#[cfg_attr(feature = "openapi", utoipa::path(
    get,
    path = "/api/projects/{project_id}/transactions",
    tag = "Transactions",
    params(
        ("project_id" = i32, Path, description = "Project ID"),
        ListTransactionsQuery,
    ),
    responses(
        (status = 200, description = "Paginated transaction list", body = inline(crate::pagination::PaginatedResponse<TransactionResponse>)),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Not found", body = crate::error::ErrorResponse),
    ),
    security(("bearer_auth" = [])),
))]
/// GET /api/projects/{project_id}/transactions
/// Lists transactions for a project with cursor-based pagination (newest first).
pub async fn list_transactions(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    query: web::Query<ListTransactionsQuery>,
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

    let cursor = query
        .cursor
        .as_ref()
        .map(|c| TransactionCursor::decode(c))
        .transpose()?;

    let (transactions, has_more) =
        TransactionService::list_paginated(pool.get_ref(), project_id, cursor.as_ref(), PAGE_SIZE)
            .await?;

    let next_cursor = if has_more {
        transactions
            .last()
            .map(|last| TransactionCursor::new(last.ingested_at, last.id).encode())
            .transpose()?
    } else {
        None
    };

    Ok(HttpResponse::Ok().json(PaginatedResponse::new(transactions, next_cursor, has_more)))
}

#[cfg(feature = "openapi")]
#[derive(OpenApi)]
#[openapi(paths(list_transactions), components(schemas(TransactionResponse,)))]
pub struct TransactionsApi;

/// Configure transaction routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/projects/{project_id}/transactions")
            .route("", web::get().to(list_transactions)),
    );
}
