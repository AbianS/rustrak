import type { z } from 'zod';
import type {
  agentDurationPointSchema,
  agentTimeseriesPointSchema,
  agentTraceSummarySchema,
  genAiBreakdownRowSchema,
} from '../schemas/agent.js';

/**
 * One time-bucketed value (count or sum).
 */
export type AgentTimeseriesPoint = z.infer<typeof agentTimeseriesPointSchema>;

/**
 * avg/p95 duration for one time bucket.
 */
export type AgentDurationPoint = z.infer<typeof agentDurationPointSchema>;

/**
 * One row of a "top N by X" breakdown (model or tool name).
 */
export type GenAiBreakdownRow = z.infer<typeof genAiBreakdownRowSchema>;

/**
 * One row of the Traces table.
 */
export type AgentTraceSummary = z.infer<typeof agentTraceSummarySchema>;

/**
 * Options shared by the Agent Runs / Estimated Cost / Duration time-series endpoints.
 */
export interface AgentTimeseriesOptions {
  /** Lookback window in hours (default: all time, no filter). */
  period_hours?: number;
  /** Bucket width in hours (default: 1). */
  interval_hours?: number;
}

/**
 * Options shared by the LLM Calls by Model / Tokens Used by Model / Tool
 * Calls by Tool breakdown endpoints.
 */
export interface AgentBreakdownOptions {
  /** Lookback window in hours (default: all time, no filter). */
  period_hours?: number;
  /** Max rows returned (default: 3, matching Sentry's own widget cap). */
  limit?: number;
}

/**
 * Options for the Traces table (offset-based pagination).
 */
export interface AgentTracesOptions {
  page?: number;
  per_page?: number;
}
