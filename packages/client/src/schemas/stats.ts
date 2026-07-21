import { z } from 'zod';
import { dateTimeSchema } from './common.js';

/**
 * One time bucket of error-event volume, split by severity.
 *
 * `total` always equals `fatal + error + warning + info`: the server folds
 * `debug` and any unrecognized level into `info`, so stacked chart segments
 * sum to the bar height.
 */
export const eventTimeseriesPointSchema = z.object({
  bucket: dateTimeSchema,
  total: z.number().int(),
  fatal: z.number().int(),
  error: z.number().int(),
  warning: z.number().int(),
  info: z.number().int(),
});

export const eventTimeseriesSchema = z.array(eventTimeseriesPointSchema);

/**
 * A counter over the requested window plus the same counter over the window
 * immediately before it.
 *
 * `previous` is `null` for all-time requests: there is no earlier window, and
 * treating that as `0` would render as a misleading "+100%".
 */
export const metricDeltaSchema = z.object({
  current: z.number().int(),
  previous: z.number().int().nullable(),
});

/**
 * Project-wide counters for the overview, each with its period comparison.
 */
export const projectStatsSummarySchema = z.object({
  /** Resolved window in hours, or `null` for all time. */
  period_hours: z.number().int().nullable(),
  events: metricDeltaSchema,
  new_issues: metricDeltaSchema,
  /** Currently unresolved issues, independent of the window. */
  open_issues: z.number().int(),
});
