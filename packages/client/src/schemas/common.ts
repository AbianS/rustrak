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
 * UUID v4 string (RFC 4122). Use for server-generated ids (row PKs, issue ids)
 * which are always created with `gen_random_uuid()`.
 */
export const uuidSchema = z.string().uuid();

/**
 * Sentry event identifier.
 *
 * Sentry event ids are 32 random hex characters — they do NOT carry RFC-4122
 * version/variant bits. The server stores them in a UUID column and returns
 * them in canonical dashed form, but a strict `uuid()` check rejects the many
 * valid ids whose version nibble falls outside 1–8. Accept any hex UUID shape
 * regardless of version/variant so real SDK payloads validate.
 */
export const eventIdSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    'Invalid event id',
  );

/**
 * API error response
 */
export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});
