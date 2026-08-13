import type { z } from 'zod';
import type {
  agentDurationPointSchema,
  agentModelRowSchema,
  agentSummarySchema,
  agentTimeseriesPointSchema,
  agentToolRowSchema,
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

/** Headline totals for the agents dashboard. */
export type AgentSummary = z.infer<typeof agentSummarySchema>;

/** One row of the Models table. */
export type AgentModelRow = z.infer<typeof agentModelRowSchema>;

/** One row of the Tools table. */
export type AgentToolRow = z.infer<typeof agentToolRowSchema>;

/**
 * Options shared by the Agent Runs / Duration time-series endpoints.
 */
export interface AgentTimeseriesOptions {
  /** Lookback window in hours (default: all time, no filter). */
  period_hours?: number;
  /** Bucket width in hours (default: 1). */
  interval_hours?: number;
  /** Restrict to spans reporting this environment (default: all). */
  environment?: string;
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
  /** Restrict to spans reporting this environment (default: all). */
  environment?: string;
}

/**
 * Options for the Traces table (offset-based pagination).
 */
export interface AgentTracesOptions {
  page?: number;
  per_page?: number;
  /** Restrict to spans reporting this environment (default: all). */
  environment?: string;
}
