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
  ApiError,
  // Auth
  AuthResponse,
  // Tokens
  AuthToken,
  AuthTokenCreated,
  CreateAuthToken,
  CreateProject,
  // Events
  Event,
  EventDetail,
  // Issues
  Issue,
  IssueFilter,
  IssueSort,
  ListEventsOptions,
  ListIssuesOptions,
  ListProjectsOptions,
  LoginRequest,
  LoginResult,
  // Common
  OffsetPaginatedResponse,
  PaginatedResponse,
  // Projects
  Project,
  RegisterRequest,
  SortOrder,
  UpdateIssueState,
  UpdateProject,
  User,
} from './types/index.js';
