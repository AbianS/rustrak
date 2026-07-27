import { z } from 'zod';
import type { RustrakError } from '../errors.js';
import type { Result } from '../result.js';
import {
  agentDurationPointSchema,
  agentTimeseriesPointSchema,
  agentTraceSummarySchema,
  genAiBreakdownRowSchema,
  offsetPaginatedResponseSchema,
} from '../schemas/index.js';
import type {
  AgentBreakdownOptions,
  AgentDurationPoint,
  AgentTimeseriesOptions,
  AgentTimeseriesPoint,
  AgentTraceSummary,
  AgentTracesOptions,
  GenAiBreakdownRow,
  OffsetPaginatedResponse,
} from '../types/index.js';
import { BaseResource } from './base.js';

function timeseriesSearchParams(
  options?: AgentTimeseriesOptions,
): Record<string, string> {
  const searchParams: Record<string, string> = {};
  if (options?.period_hours) {
    searchParams.period_hours = String(options.period_hours);
  }
  if (options?.interval_hours) {
    searchParams.interval_hours = String(options.interval_hours);
  }
  return searchParams;
}

function breakdownSearchParams(
  options?: AgentBreakdownOptions,
): Record<string, string> {
  const searchParams: Record<string, string> = {};
  if (options?.period_hours) {
    searchParams.period_hours = String(options.period_hours);
  }
  if (options?.limit) {
    searchParams.limit = String(options.limit);
  }
  return searchParams;
}

/**
 * AI Agent Monitoring dashboard API resource — powers the 6 dashboard
 * widgets (Agent Runs, Duration, LLM Calls by Model, Tokens Used by Model,
 * Tool Calls by Tool, Traces).
 */
export class AgentsResource extends BaseResource {
  /**
   * Time-bucketed count of agent-run spans (`gen_ai.operation.type:agent`).
   */
  async getRuns(
    projectId: number,
    options?: AgentTimeseriesOptions,
  ): Promise<Result<AgentTimeseriesPoint[], RustrakError>> {
    return this.request(
      () =>
        this.http.get(`api/projects/${projectId}/agents/runs`, {
          searchParams: timeseriesSearchParams(options),
        }),
      z.array(agentTimeseriesPointSchema),
    );
  }

  /**
   * Time-bucketed avg/p95 duration for `agent`/`ai_client` spans.
   */
  async getDuration(
    projectId: number,
    options?: AgentTimeseriesOptions,
  ): Promise<Result<AgentDurationPoint[], RustrakError>> {
    return this.request(
      () =>
        this.http.get(`api/projects/${projectId}/agents/duration`, {
          searchParams: timeseriesSearchParams(options),
        }),
      z.array(agentDurationPointSchema),
    );
  }

  /**
   * Top models by LLM call count (`gen_ai.operation.type:ai_client`).
   */
  async getModelsByCalls(
    projectId: number,
    options?: AgentBreakdownOptions,
  ): Promise<Result<GenAiBreakdownRow[], RustrakError>> {
    return this.request(
      () =>
        this.http.get(`api/projects/${projectId}/agents/models/calls`, {
          searchParams: breakdownSearchParams(options),
        }),
      z.array(genAiBreakdownRowSchema),
    );
  }

  /**
   * Top models by total tokens used (`gen_ai.operation.type:ai_client`).
   */
  async getModelsByTokens(
    projectId: number,
    options?: AgentBreakdownOptions,
  ): Promise<Result<GenAiBreakdownRow[], RustrakError>> {
    return this.request(
      () =>
        this.http.get(`api/projects/${projectId}/agents/models/tokens`, {
          searchParams: breakdownSearchParams(options),
        }),
      z.array(genAiBreakdownRowSchema),
    );
  }

  /**
   * Top tools by call count (`gen_ai.operation.type:tool`).
   */
  async getTools(
    projectId: number,
    options?: AgentBreakdownOptions,
  ): Promise<Result<GenAiBreakdownRow[], RustrakError>> {
    return this.request(
      () =>
        this.http.get(`api/projects/${projectId}/agents/tools`, {
          searchParams: breakdownSearchParams(options),
        }),
      z.array(genAiBreakdownRowSchema),
    );
  }

  /**
   * Paginated per-trace_id aggregate (duration, tokens, tool usage) across
   * all AI spans sharing that trace, regardless of origin.
   */
  async getTraces(
    projectId: number,
    options?: AgentTracesOptions,
  ): Promise<Result<OffsetPaginatedResponse<AgentTraceSummary>, RustrakError>> {
    const searchParams: Record<string, string> = {};
    if (options?.page) {
      searchParams.page = String(options.page);
    }
    if (options?.per_page) {
      searchParams.per_page = String(options.per_page);
    }

    return this.request(
      () =>
        this.http.get(`api/projects/${projectId}/agents/traces`, {
          searchParams,
        }),
      offsetPaginatedResponseSchema(agentTraceSummarySchema),
    );
  }
}
