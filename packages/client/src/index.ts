/**
 * @rustrak/client - TypeScript client for Rustrak API
 *
 * A type-safe, fully-featured client for interacting with Rustrak error tracking API.
 *
 * @packageDocumentation
 */

// Main client
export { RustrakClient } from './client.js';

// Configuration
export type { ClientConfig } from './config.js';
// Errors
export {
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  RustrakError,
  ServerError,
  ValidationError,
} from './errors/index.js';
// Types
export type {
  // Alerts
  AlertHistory,
  AlertIntegration,
  AlertRule,
  AlertRuleChannelInput,
  AlertStatus,
  AlertType,
  ApiError,
  // Auth
  AuthResponse,
  // Tokens
  AuthToken,
  AuthTokenCreated,
  /** @deprecated Use ProviderType */
  ChannelType,
  CreateAlertIntegration,
  CreateAlertRule,
  CreateAuthToken,
  /** @deprecated Use CreateAlertIntegration */
  CreateNotificationChannel,
  CreateProject,
  // Events
  Event,
  EventDetail,
  // Issues
  Issue,
  IssueFilter,
  IssueSort,
  ListAlertHistoryOptions,
  ListEventsOptions,
  ListIssuesOptions,
  ListProjectsOptions,
  LoginRequest,
  LoginResult,
  /** @deprecated Use AlertIntegration */
  NotificationChannel,
  // Common
  OffsetPaginatedResponse,
  PaginatedResponse,
  // Projects
  Project,
  ProviderType,
  RegisterRequest,
  RoutingOverride,
  SortOrder,
  TestChannelResponse,
  TestIntegrationBody,
  UpdateAlertIntegration,
  UpdateAlertRule,
  UpdateIssueState,
  /** @deprecated Use UpdateAlertIntegration */
  UpdateNotificationChannel,
  UpdateProject,
  User,
} from './types/index.js';
