//! Unit tests for AppError HTTP response behavior.
//!
//! Verifies that internal error details are never leaked to HTTP clients.

use actix_web::ResponseError;
use rustrak::error::AppError;

async fn body_string(resp: actix_web::HttpResponse) -> String {
    let bytes = actix_web::body::to_bytes(resp.into_body()).await.unwrap();
    String::from_utf8(bytes.to_vec()).unwrap()
}

// =============================================================================
// Error Leakage Tests (H-3)
// =============================================================================

#[actix_web::test]
async fn test_database_error_does_not_leak_internal_details() {
    let app_err = AppError::Database(sqlx::Error::RowNotFound);
    let body = body_string(app_err.error_response()).await;

    assert!(
        !body.contains("Database error:"),
        "Database error prefix leaked: {body}"
    );
    assert!(
        !body.contains("RowNotFound"),
        "sqlx error variant leaked: {body}"
    );
    assert!(
        body.to_lowercase().contains("internal"),
        "Expected generic internal error message, got: {body}"
    );
}

#[actix_web::test]
async fn test_internal_error_does_not_leak_internal_details() {
    let app_err = AppError::Internal(
        "Failed to create user: duplicate key value violates unique constraint".to_string(),
    );
    let body = body_string(app_err.error_response()).await;

    assert!(
        !body.contains("duplicate key"),
        "Internal error detail leaked: {body}"
    );
    assert!(
        !body.contains("unique constraint"),
        "DB constraint name leaked: {body}"
    );
}

#[actix_web::test]
async fn test_validation_error_message_is_preserved() {
    let app_err = AppError::Validation("Password must be at least 8 characters".to_string());
    let body = body_string(app_err.error_response()).await;

    assert!(
        body.contains("Password must be at least 8 characters"),
        "Validation message should be preserved: {body}"
    );
}
