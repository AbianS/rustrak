import type { z } from 'zod';
import type { checkInSchema, monitorSchema } from '../schemas/monitor.js';

/**
 * Monitor type inferred from Zod schema
 */
export type Monitor = z.infer<typeof monitorSchema>;

/**
 * CheckIn type inferred from Zod schema
 */
export type CheckIn = z.infer<typeof checkInSchema>;
