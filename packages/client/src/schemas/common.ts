import { z } from 'zod';

/**
 * Generic paginated response schema (cursor-based)
 */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    items: z.array(itemSchema),
    next_cursor: z.string().optional(),
    has_more: z.boolean(),
  });

/**
 * Generic offset-based paginated response schema
 */
export const offsetPaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    items: z.array(itemSchema),
    total_count: z.number().int(),
    page: z.number().int(),
    per_page: z.number().int(),
    total_pages: z.number().int(),
  });

/**
 * Sort order enum
 */
export const sortOrderSchema = z.enum(['asc', 'desc']);

/**
 * Issue sort field enum
 */
export const issueSortSchema = z.enum(['digest_order', 'last_seen']);

/**
 * Issue filter enum
 */
export const issueFilterSchema = z.enum(['open', 'resolved', 'muted', 'all']);

/**
 * ISO 8601 datetime string
 */
export const dateTimeSchema = z.string().datetime();

/**
 * UUID v4 string
 */
export const uuidSchema = z.string().uuid();

/**
 * API error response
 */
export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});
