import { z } from 'zod';

/**
 * Schema for a stack frame in an exception.
 */
const stackFrameSchema = z.object({
  filename: z.string().optional(),
  function: z.string().optional(),
  lineno: z.number().optional(),
  colno: z.number().optional(),
  in_app: z.boolean().optional(),
  context_line: z.string().optional(),
  pre_context: z.array(z.string()).optional(),
  post_context: z.array(z.string()).optional(),
});

/**
 * Schema for an exception value.
 */
const exceptionValueSchema = z.object({
  type: z.string().optional(),
  value: z.string().optional(),
  stacktrace: z
    .object({
      frames: z.array(stackFrameSchema).optional(),
    })
    .optional(),
});

/**
 * Schema for the exception object in a Sentry event.
 */
const exceptionSchema = z
  .object({
    values: z.array(exceptionValueSchema).optional(),
  })
  .optional();

/**
 * Schema for a breadcrumb entry.
 */
const breadcrumbSchema = z.object({
  timestamp: z.number().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  message: z.string().optional(),
  level: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for breadcrumbs (can be array or object with values).
 */
const breadcrumbsSchema = z.union([
  z.array(breadcrumbSchema),
  z.object({ values: z.array(breadcrumbSchema).optional() }),
]);

/**
 * Schema for user information.
 */
const userSchema = z
  .object({
    id: z.string().optional(),
    email: z.string().optional(),
    ip_address: z.string().optional(),
  })
  .optional();

/**
 * Schema for tags.
 */
const tagsSchema = z.record(z.string(), z.string()).optional();

/**
 * Schema for contexts.
 */
const contextsSchema = z
  .record(z.string(), z.record(z.string(), z.unknown()))
  .optional();

/**
 * Parsed and validated event data types.
 */
type ValidatedEventBreadcrumbs = z.infer<typeof breadcrumbsSchema>;

/**
 * Parse and validate event data from the Sentry event JSON.
 * Returns validated and type-safe data structures.
 */
export function parseEventData(eventData: Record<string, unknown>) {
  const exception = exceptionSchema.safeParse(eventData.exception);
  const breadcrumbs = breadcrumbsSchema.safeParse(eventData.breadcrumbs);
  const contexts = contextsSchema.safeParse(eventData.contexts);
  const tags = tagsSchema.safeParse(eventData.tags);
  const user = userSchema.safeParse(eventData.user);

  return {
    exception: exception.success ? exception.data : undefined,
    breadcrumbs: breadcrumbs.success ? breadcrumbs.data : undefined,
    contexts: contexts.success ? contexts.data : undefined,
    tags: tags.success ? tags.data : undefined,
    user: user.success ? user.data : undefined,
  };
}

/**
 * Normalize breadcrumbs to always be an array.
 */
export function normalizeBreadcrumbs(
  breadcrumbs: ValidatedEventBreadcrumbs | undefined,
): Array<{
  timestamp?: number;
  type?: string;
  category?: string;
  message?: string;
  level?: string;
  data?: Record<string, unknown>;
}> {
  if (!breadcrumbs) return [];
  if (Array.isArray(breadcrumbs)) return breadcrumbs;
  return breadcrumbs.values ?? [];
}
