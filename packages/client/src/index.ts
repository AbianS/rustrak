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
  CheckIn,
  ChunkUploadCapability,
  CleanupCounts,
  CleanupOptions,
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
  ListCheckInsOptions,
  ListEventsOptions,
  ListIssuesOptions,
  ListLogsOptions,
  ListProjectsOptions,
  ListSourceMapsResponse,
  ListTransactionsOptions,
  Log,
  LoginRequest,
  LoginResult,
  Monitor,
  /** @deprecated Use AlertIntegration */
  NotificationChannel,
  OffsetPaginatedResponse,
  PaginatedResponse,
  Project,
  ProjectMember,
  ProjectRole,
  ProjectStorage,
  ProviderType,
  RegisterRequest,
  ReleaseHealth,
  ReleaseHealthRow,
  RoutingOverride,
  ServerVersion,
  SortOrder,
  SourceMapFile,
  SourceMapGcResult,
  SourceMapStorage,
  Span,
  StorageSummary,
  TeamMember,
  TestChannelResponse,
  TestIntegrationBody,
  Transaction,
  TransactionDetail,
  TransactionStats,
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
