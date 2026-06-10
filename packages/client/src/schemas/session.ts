import { z } from 'zod';

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

export const releaseHealthSchema = z.array(releaseHealthRowSchema);
