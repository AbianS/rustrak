import type { z } from 'zod';
import type { eventDetailSchema, eventSchema } from '../schemas/event.js';

/**
 * Event resource from list endpoint
 */
export type Event = z.infer<typeof eventSchema>;

/**
 * Event detail resource from detail endpoint
 */
export type EventDetail = z.infer<typeof eventDetailSchema>;
