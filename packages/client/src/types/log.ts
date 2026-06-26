import type { z } from 'zod';
import type { logSchema } from '../schemas/log.js';

/**
 * Log type inferred from Zod schema
 */
export type Log = z.infer<typeof logSchema>;
