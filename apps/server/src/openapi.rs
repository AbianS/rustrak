//! OpenAPI schema generation for Rustrak API.
//!
//! This module collects all route path annotations and schema types
//! into a single OpenAPI specification. The spec is a build-time artifact
//! used for client codegen (progenitor) — no runtime overhead.

use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Rustrak API",
        version = "0.1.0",
        description = "Ultra-lightweight error tracking server compatible with Sentry SDKs",
        license(name = "GPL-3.0"),
    ),
    paths(
        // Health
        crate::routes::health::liveness,
        crate::routes::health::readiness,

        // Auth
        crate::routes::auth::register,
        crate::routes::auth::login,
        crate::routes::auth::logout,
        crate::routes::auth::get_current_user,

        // Projects
        crate::routes::projects::list_projects,
        crate::routes::projects::get_project,
        crate::routes::projects::create_project,
        crate::routes::projects::update_project,
        crate::routes::projects::delete_project,

        // Tokens
        crate::routes::tokens::list_tokens,
        crate::routes::tokens::create_token,
        crate::routes::tokens::delete_token,

        // Issues
        crate::routes::issues::list_issues,
        crate::routes::issues::get_issue,
        crate::routes::issues::update_issue,
        crate::routes::issues::delete_issue,

        // Events
        crate::routes::events::list_events,
        crate::routes::events::get_event,

        // Ingest endpoints excluded — binary Sentry protocol, not for API clients

        // Alerts - Channels
        crate::routes::alerts::list_channels,
        crate::routes::alerts::create_channel,
        crate::routes::alerts::get_channel,
        crate::routes::alerts::update_channel,
        crate::routes::alerts::delete_channel,
        crate::routes::alerts::test_channel,

        // Alerts - Rules
        crate::routes::alerts::list_rules,
        crate::routes::alerts::create_rule,
        crate::routes::alerts::get_rule,
        crate::routes::alerts::update_rule,
        crate::routes::alerts::delete_rule,

        // Alerts - History
        crate::routes::alerts::list_history,
    ),
    components(
        schemas(
            // Error
            crate::error::ErrorResponse,
            crate::error::ErrorDetail,

            // Health
            crate::routes::health::LivenessResponse,
            crate::routes::health::ReadinessResponse,
            crate::routes::health::ReadinessChecks,

            // Auth
            crate::routes::auth::AuthResponse,
            crate::routes::auth::UserResponse,
            crate::models::user::CreateUserRequest,
            crate::models::user::LoginRequest,

            // Projects
            crate::models::project::ProjectResponse,
            crate::models::project::CreateProject,
            crate::models::project::UpdateProject,

            // Tokens
            crate::models::auth_token::AuthTokenResponse,
            crate::models::auth_token::AuthTokenCreatedResponse,
            crate::models::auth_token::CreateAuthToken,

            // Issues
            crate::models::issue::IssueResponse,
            crate::models::issue::UpdateIssueState,

            // Events
            crate::models::event::EventResponse,
            crate::models::event::EventDetailResponse,

            // Pagination
            crate::pagination::PaginatedEventResponse,
            crate::pagination::OffsetPaginatedProjectResponse,
            crate::pagination::OffsetPaginatedIssueResponse,
            crate::pagination::IssueSort,
            crate::pagination::SortOrder,
            crate::pagination::IssueFilter,

            // Alerts
            crate::models::alert::ChannelType,
            crate::models::alert::AlertType,
            crate::models::alert::AlertStatus,
            crate::models::alert::NotificationChannel,
            crate::models::alert::CreateNotificationChannel,
            crate::models::alert::UpdateNotificationChannel,
            crate::models::alert::WebhookConfig,
            crate::models::alert::EmailConfig,
            crate::models::alert::SlackConfig,
            crate::models::alert::AlertRule,
            crate::models::alert::CreateAlertRule,
            crate::models::alert::UpdateAlertRule,
            crate::models::alert::AlertRuleResponse,
            crate::models::alert::AlertHistory,
            crate::routes::alerts::TestChannelResponse,
        ),
    ),
    tags(
        (name = "health", description = "Health check endpoints"),
        (name = "auth", description = "Authentication (session-based)"),
        (name = "projects", description = "Project management"),
        (name = "tokens", description = "API token management"),
        (name = "issues", description = "Issue tracking"),
        (name = "events", description = "Error event details"),
        (name = "ingest", description = "Sentry SDK event ingestion"),
        (name = "alerts", description = "Alert channels, rules, and history"),
    ),
    security(
        ("bearer_auth" = []),
        ("session_auth" = []),
        ("sentry_auth" = []),
    ),
    modifiers(&SecurityAddon),
)]
pub struct ApiDoc;

struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi.components.get_or_insert_with(Default::default);
        components.add_security_scheme(
            "bearer_auth",
            utoipa::openapi::security::SecurityScheme::Http(
                utoipa::openapi::security::HttpBuilder::new()
                    .scheme(utoipa::openapi::security::HttpAuthScheme::Bearer)
                    .bearer_format("hex")
                    .description(Some("40-character hex API token"))
                    .build(),
            ),
        );
        components.add_security_scheme(
            "session_auth",
            utoipa::openapi::security::SecurityScheme::ApiKey(
                utoipa::openapi::security::ApiKey::Cookie(
                    utoipa::openapi::security::ApiKeyValue::new("rustrak_session"),
                ),
            ),
        );
        components.add_security_scheme(
            "sentry_auth",
            utoipa::openapi::security::SecurityScheme::ApiKey(
                utoipa::openapi::security::ApiKey::Header(
                    utoipa::openapi::security::ApiKeyValue::with_description(
                        "X-Sentry-Auth",
                        "Sentry SDK authentication header or ?sentry_key= query parameter",
                    ),
                ),
            ),
        );
    }
}
