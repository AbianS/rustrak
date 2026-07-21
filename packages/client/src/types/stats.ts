import type { z } from 'zod';
import type {
  eventTimeseriesPointSchema,
  eventTimeseriesSchema,
  metricDeltaSchema,
  projectStatsSummarySchema,
} from '../schemas/stats.js';

export type EventTimeseriesPoint = z.infer<typeof eventTimeseriesPointSchema>;
export type EventTimeseries = z.infer<typeof eventTimeseriesSchema>;
export type MetricDelta = z.infer<typeof metricDeltaSchema>;
export type ProjectStatsSummary = z.infer<typeof projectStatsSummarySchema>;
