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
  AlertRule,
  AlertStatus,
  AlertType,
  ApiError,
  AssembleInput,
  AssembleResponse,
  AuthResponse,
  AuthToken,
  AuthTokenCreated,
  ChannelType,
  ChunkUploadCapability,
  CreateAlertRule,
  CreateAuthToken,
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
  NotificationChannel,
  OffsetPaginatedResponse,
  PaginatedResponse,
  Project,
  RegisterRequest,
  SortOrder,
  SourceMapFile,
  TestChannelResponse,
  UpdateAlertRule,
  UpdateIssueState,
  UpdateNotificationChannel,
  UpdateProject,
  User,
} from './types/index.js';
