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
  /** `ai_client` spans: how many times a model was actually called. */
  llm_call_count: z.number().int(),
  /** AI spans in this trace whose status is set and not `ok`. */
  error_count: z.number().int(),
  started_at: dateTimeSchema,
});

/**
 * Headline totals for the agents dashboard, over the selected window.
 *
 * Token totals exclude `agent`-type spans: their usage is a client-side
 * rollup of their `ai_client` children, so counting both double-counts.
 */
export const agentSummarySchema = z.object({
  agent_runs: z.number().int(),
  llm_calls: z.number().int(),
  tool_calls: z.number().int(),
  error_count: z.number().int(),
  total_tokens: z.number(),
  avg_duration_ms: z.number(),
  p95_duration_ms: z.number(),
});

/**
 * One row of the Models table.
 *
 * `cached_input_tokens` and `reasoning_output_tokens` are SUBSETS of
 * `input_tokens` / `output_tokens`, not additions — never sum all four.
 */
export const agentModelRowSchema = z.object({
  model: z.string(),
  requests: z.number().int(),
  errors: z.number().int(),
  avg_ms: z.number(),
  p95_ms: z.number(),
  input_tokens: z.number(),
  cached_input_tokens: z.number(),
  output_tokens: z.number(),
  reasoning_output_tokens: z.number(),
  total_tokens: z.number(),
});

/**
 * One row of the Tools table: how often a tool ran and how often it failed.
 */
export const agentToolRowSchema = z.object({
  tool: z.string(),
  calls: z.number().int(),
  errors: z.number().int(),
  avg_ms: z.number(),
  p95_ms: z.number(),
});
