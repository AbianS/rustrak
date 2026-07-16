import { z } from 'zod';
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
 * AI Agent Monitoring dashboard API resource — powers the 7 dashboard
 * widgets (Agent Runs, Estimated Cost, Duration, LLM Calls by Model, Tokens
 * Used by Model, Tool Calls by Tool, Traces).
 */
export class AgentsResource extends BaseResource {
  /**
   * Time-bucketed count of agent-run spans (`gen_ai.operation.type:agent`).
   */
  async getRuns(
    projectId: number,
    options?: AgentTimeseriesOptions,
  ): Promise<AgentTimeseriesPoint[]> {
    const data = await this.http
      .get(`api/projects/${projectId}/agents/runs`, {
        searchParams: timeseriesSearchParams(options),
      })
      .json();

    return this.validate(data, z.array(agentTimeseriesPointSchema));
  }

  /**
   * Time-bucketed sum of estimated LLM call cost
   * (`gen_ai.operation.type:ai_client`).
   */
  async getCost(
    projectId: number,
    options?: AgentTimeseriesOptions,
  ): Promise<AgentTimeseriesPoint[]> {
    const data = await this.http
      .get(`api/projects/${projectId}/agents/cost`, {
        searchParams: timeseriesSearchParams(options),
      })
      .json();

    return this.validate(data, z.array(agentTimeseriesPointSchema));
  }

  /**
   * Time-bucketed avg/p95 duration for `agent`/`ai_client` spans.
   */
  async getDuration(
    projectId: number,
    options?: AgentTimeseriesOptions,
  ): Promise<AgentDurationPoint[]> {
    const data = await this.http
      .get(`api/projects/${projectId}/agents/duration`, {
        searchParams: timeseriesSearchParams(options),
      })
      .json();

    return this.validate(data, z.array(agentDurationPointSchema));
  }

  /**
   * Top models by LLM call count (`gen_ai.operation.type:ai_client`).
   */
  async getModelsByCalls(
    projectId: number,
    options?: AgentBreakdownOptions,
  ): Promise<GenAiBreakdownRow[]> {
    const data = await this.http
      .get(`api/projects/${projectId}/agents/models/calls`, {
        searchParams: breakdownSearchParams(options),
      })
      .json();

    return this.validate(data, z.array(genAiBreakdownRowSchema));
  }

  /**
   * Top models by total tokens used (`gen_ai.operation.type:ai_client`).
   */
  async getModelsByTokens(
    projectId: number,
    options?: AgentBreakdownOptions,
  ): Promise<GenAiBreakdownRow[]> {
    const data = await this.http
      .get(`api/projects/${projectId}/agents/models/tokens`, {
        searchParams: breakdownSearchParams(options),
      })
      .json();

    return this.validate(data, z.array(genAiBreakdownRowSchema));
  }

  /**
   * Top tools by call count (`gen_ai.operation.type:tool`).
   */
  async getTools(
    projectId: number,
    options?: AgentBreakdownOptions,
  ): Promise<GenAiBreakdownRow[]> {
    const data = await this.http
      .get(`api/projects/${projectId}/agents/tools`, {
        searchParams: breakdownSearchParams(options),
      })
      .json();

    return this.validate(data, z.array(genAiBreakdownRowSchema));
  }

  /**
   * Paginated per-trace_id aggregate (duration, tokens, cost, tool usage)
   * across all AI spans sharing that trace, regardless of origin.
   */
  async getTraces(
    projectId: number,
    options?: AgentTracesOptions,
  ): Promise<OffsetPaginatedResponse<AgentTraceSummary>> {
    const searchParams: Record<string, string> = {};
    if (options?.page) {
      searchParams.page = String(options.page);
    }
    if (options?.per_page) {
      searchParams.per_page = String(options.per_page);
    }

    const data = await this.http
      .get(`api/projects/${projectId}/agents/traces`, { searchParams })
      .json();

    return this.validate(
      data,
      offsetPaginatedResponseSchema(agentTraceSummarySchema),
    );
  }
}
