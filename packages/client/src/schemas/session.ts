import { z } from 'zod';
import { dateTimeSchema } from './common.js';

export const releaseHealthRowSchema = z.object({
  release: z.string(),
  environment: z.string(),
  total: z.number().int(),
  errored: z.number().int(),
  crashed: z.number().int(),
  abnormal: z.number().int(),
  healthy: z.number().int(),
  crash_free_sessions_rate: z.number().nullable(),
  crash_free_users_rate: z.number().nullable(),
});

export const sessionSummarySchema = z.object({
  total: z.number().int(),
  errored: z.number().int(),
  crashed: z.number().int(),
  abnormal: z.number().int(),
  crash_free_sessions_rate: z.number().nullable(),
  crash_free_users_rate: z.number().nullable(),
  active_releases: z.number().int(),
});

export const sessionTimeseriesPointSchema = z.object({
  bucket: dateTimeSchema,
  total: z.number().int(),
  crashed: z.number().int(),
  crash_free_sessions_rate: z.number().nullable(),
});

export const sessionTimeseriesSchema = z.array(sessionTimeseriesPointSchema);
