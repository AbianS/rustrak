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
  AcceptInvitation,
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
  CreateInvitation,
  /** @deprecated Use CreateAlertIntegration */
  CreateNotificationChannel,
  CreateProject,
  Event,
  EventDetail,
  GlobalRole,
  Invitation,
  InvitationInfo,
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
  ProjectMember,
  ProjectRole,
  ProviderType,
  RegisterRequest,
  RoutingOverride,
  ServerVersion,
  SortOrder,
  SourceMapFile,
  TeamMember,
  TestChannelResponse,
  TestIntegrationBody,
  UpdateAlertIntegration,
  UpdateAlertRule,
  UpdateIssueState,
  /** @deprecated Use UpdateAlertIntegration */
  UpdateNotificationChannel,
  UpdateProject,
  UpdateUserRole,
  UpsertProjectMember,
  User,
} from './types/index.js';
