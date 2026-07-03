import type { z } from 'zod';
import type {
  releaseHealthRowSchema,
  releaseHealthSchema,
  sessionSummarySchema,
  sessionTimeseriesPointSchema,
  sessionTimeseriesSchema,
} from '../schemas/session.js';

export type ReleaseHealthRow = z.infer<typeof releaseHealthRowSchema>;
export type ReleaseHealth = z.infer<typeof releaseHealthSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
export type SessionTimeseriesPoint = z.infer<
  typeof sessionTimeseriesPointSchema
>;
export type SessionTimeseries = z.infer<typeof sessionTimeseriesSchema>;
