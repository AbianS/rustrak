'use server';

import type {
  AgentBreakdownOptions,
  AgentDurationPoint,
  AgentTimeseriesOptions,
  AgentTimeseriesPoint,
  AgentTraceSummary,
  AgentTracesOptions,
  GenAiBreakdownRow,
  ListSpansOptions,
  OffsetPaginatedResponse,
  Result,
  RustrakError,
  Span,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

export async function listSpans(
  projectId: number,
  options?: ListSpansOptions,
): Promise<Result<OffsetPaginatedResponse<Span>, RustrakError>> {
  const client = await createClient();
  return client.spans.list(projectId, options);
}

export async function getAgentRuns(
  projectId: number,
  options?: AgentTimeseriesOptions,
): Promise<Result<AgentTimeseriesPoint[], RustrakError>> {
  const client = await createClient();
  return client.agents.getRuns(projectId, options);
}

export async function getAgentDuration(
  projectId: number,
  options?: AgentTimeseriesOptions,
): Promise<Result<AgentDurationPoint[], RustrakError>> {
  const client = await createClient();
  return client.agents.getDuration(projectId, options);
}

export async function getAgentModelsByCalls(
  projectId: number,
  options?: AgentBreakdownOptions,
): Promise<Result<GenAiBreakdownRow[], RustrakError>> {
  const client = await createClient();
  return client.agents.getModelsByCalls(projectId, options);
}

export async function getAgentModelsByTokens(
  projectId: number,
  options?: AgentBreakdownOptions,
): Promise<Result<GenAiBreakdownRow[], RustrakError>> {
  const client = await createClient();
  return client.agents.getModelsByTokens(projectId, options);
}

export async function getAgentTools(
  projectId: number,
  options?: AgentBreakdownOptions,
): Promise<Result<GenAiBreakdownRow[], RustrakError>> {
  const client = await createClient();
  return client.agents.getTools(projectId, options);
}

export async function getAgentTraces(
  projectId: number,
  options?: AgentTracesOptions,
): Promise<Result<OffsetPaginatedResponse<AgentTraceSummary>, RustrakError>> {
  const client = await createClient();
  return client.agents.getTraces(projectId, options);
}
