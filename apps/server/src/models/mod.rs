pub mod alert;
pub mod auth_token;
pub mod event;
pub mod grouping;
pub mod installation;
pub mod issue;
pub mod project;
pub mod user;

pub use alert::{
    // Integration (new name)
    AlertIntegration,
    CreateAlertIntegration,
    UpdateAlertIntegration,
    // Backward-compat aliases
    NotificationChannel,
    CreateNotificationChannel,
    UpdateNotificationChannel,
    // Provider type (replaces ChannelType)
    ProviderType,
    // Backward-compat alias
    ChannelType,
    // Routing override types
    RoutingOverride,
    SlackRoutingOverride,
    EmailRoutingOverride,
    WebhookRoutingOverride,
    // Rule channel junction
    AlertRuleChannel,
    AlertRuleChannelInput,
    // Payload & rule types
    AlertHistory,
    AlertPayload,
    AlertRule,
    AlertRuleResponse,
    AlertStatus,
    AlertType,
    CreateAlertRule,
    EmailConfig,
    IssueInfo,
    ProjectInfo,
    SlackBotTokenConfig,
    SlackConfig,
    SlackWebhookConfig,
    UpdateAlertRule,
    WebhookConfig,
};
pub use auth_token::{AuthToken, AuthTokenCreatedResponse, AuthTokenResponse, CreateAuthToken};
pub use event::{Event, EventDetailResponse, EventResponse};
pub use grouping::Grouping;
pub use installation::Installation;
pub use issue::{Issue, IssueResponse, UpdateIssueState};
pub use project::{CreateProject, Project, ProjectResponse, UpdateProject};
pub use user::{CreateUserRequest, LoginRequest, User};
