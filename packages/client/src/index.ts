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
  AlertHistory,
  AlertIntegration,
  AlertRule,
  AlertRuleChannelInput,
  AlertStatus,
  AlertType,
  ApiError,
  AssembleInput,
  AssembleResponse,
  AuthResponse,
  AuthToken,
  AuthTokenCreated,
  /** @deprecated Use ProviderType */
  ChannelType,
  ChunkUploadCapability,
  CreateAlertIntegration,
  CreateAlertRule,
  CreateAuthToken,
  /** @deprecated Use CreateAlertIntegration */
  CreateNotificationChannel,
  CreateProject,
  Event,
  EventDetail,
  Issue,
  IssueFilter,
  IssueSort,
  ListAlertHistoryOptions,
  ListEventsOptions,
  ListIssuesOptions,
  ListProjectsOptions,
  ListSourceMapsResponse,
  LoginRequest,
  LoginResult,
  /** @deprecated Use AlertIntegration */
  NotificationChannel,
  OffsetPaginatedResponse,
  PaginatedResponse,
  Project,
  ProviderType,
  RegisterRequest,
  RoutingOverride,
  SortOrder,
  SourceMapFile,
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
