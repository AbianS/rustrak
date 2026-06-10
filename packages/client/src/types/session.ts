import type { z } from 'zod';
import type {
  releaseHealthRowSchema,
  releaseHealthSchema,
} from '../schemas/session.js';

export type ReleaseHealthRow = z.infer<typeof releaseHealthRowSchema>;
export type ReleaseHealth = z.infer<typeof releaseHealthSchema>;
