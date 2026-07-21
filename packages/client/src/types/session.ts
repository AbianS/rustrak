import type { z } from 'zod';
import type {
  releaseHealthRowSchema,
  sessionSummarySchema,
  sessionTimeseriesPointSchema,
  sessionTimeseriesSchema,
} from '../schemas/session.js';

export type ReleaseHealthRow = z.infer<typeof releaseHealthRowSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
export type SessionTimeseriesPoint = z.infer<
  typeof sessionTimeseriesPointSchema
>;
export type SessionTimeseries = z.infer<typeof sessionTimeseriesSchema>;
