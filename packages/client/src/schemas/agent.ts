import { z } from 'zod';
import { dateTimeSchema } from './common.js';

/**
 * One time-bucketed value (count or sum) — Agent Runs widget.
 */
export const agentTimeseriesPointSchema = z.object({
  bucket: dateTimeSchema,
  value: z.number(),
});

/**
 * avg/p95 duration for one time bucket — Duration widget.
 */
export const agentDurationPointSchema = z.object({
  bucket: dateTimeSchema,
  avg_ms: z.number(),
  p95_ms: z.number(),
});

/**
 * One row of a "top N by X" breakdown (model or tool name).
 */
export const genAiBreakdownRowSchema = z.object({
  label: z.string(),
  value: z.number(),
});

/**
 * One row of the Traces table — per-trace_id aggregate across all AI spans
 * sharing that trace, regardless of origin.
 */
export const agentTraceSummarySchema = z.object({
  trace_id: z.string(),
  /** Every distinct agent that ran in this trace, earliest first. */
  agent_names: z.array(z.string()),
  duration_ms: z.number().nullable(),
  total_tokens: z.number(),
  tool_call_count: z.number().int(),
  started_at: dateTimeSchema,
});
