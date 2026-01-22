import type { z } from 'zod';
import type {
  apiErrorSchema,
  issueFilterSchema,
  issueSortSchema,
  sortOrderSchema,
} from '../schemas/common.js';

/**
 * Paginated response wrapper for list endpoints (cursor-based)
 */
export interface PaginatedResponse<T> {
  items: T[];
  next_cursor?: string;
  has_more: boolean;
}

/**
 * Offset-based paginated response wrapper for list endpoints
 */
export interface OffsetPaginatedResponse<T> {
  items: T[];
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

/**
 * Sort order for list queries
 */
export type SortOrder = z.infer<typeof sortOrderSchema>;

/**
 * Sort field for issue queries
 */
export type IssueSort = z.infer<typeof issueSortSchema>;

/**
 * Filter for issue queries
 */
export type IssueFilter = z.infer<typeof issueFilterSchema>;

/**
 * API error response structure
 */
export type ApiError = z.infer<typeof apiErrorSchema>;

/**
 * List options for issues endpoint (offset-based pagination)
 */
export interface ListIssuesOptions {
  page?: number;
  per_page?: number;
  sort?: IssueSort;
  order?: SortOrder;
  filter?: IssueFilter;
}

/**
 * List options for events endpoint
 */
export interface ListEventsOptions {
  order?: SortOrder;
  cursor?: string;
}

/**
 * List options for projects endpoint (offset-based pagination)
 */
export interface ListProjectsOptions {
  page?: number;
  per_page?: number;
  order?: SortOrder;
}
