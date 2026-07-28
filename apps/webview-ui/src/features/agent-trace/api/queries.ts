import 'server-only';

/**
 * Reads for the agent-monitoring pages.
 *
 * No `mutations.ts` beside this: nothing in the product writes an agent trace,
 * they arrive through ingestion. A slice with only one half of its `api`
 * segment is the expected shape, not an omission.
 *
 * `import 'server-only'` is a build-time poison pill rather than a directive:
 * if this module reaches the client bundle the build fails, instead of shipping
 * a browser bundle that holds the session cookie.
 */
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
import { createClient } from '@/shared/api/rustrak';

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
