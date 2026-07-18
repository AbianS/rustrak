import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

const timeseriesInput = {
  project_id: z.number().int().describe('Project ID'),
  period_hours: z
    .number()
    .int()
    .optional()
    .describe('Lookback window in hours (default: all time)'),
  interval_hours: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Bucket width in hours (default: 1)'),
};

const breakdownInput = {
  project_id: z.number().int().describe('Project ID'),
  period_hours: z
    .number()
    .int()
    .optional()
    .describe('Lookback window in hours (default: all time)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max rows returned (default: 3)'),
};

export function registerAgentTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'get_agent_runs',
    {
      description:
        'Get a time-bucketed count of AI agent runs (gen_ai.operation.type:agent spans) for a Rustrak project — the "Agent Runs" AI Agent Monitoring widget.',
      inputSchema: timeseriesInput,
    },
    async ({ project_id, period_hours, interval_hours }) => {
      try {
        const result = await client.agents.getRuns(project_id, {
          period_hours,
          interval_hours,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'get_agent_duration',
    {
      description:
        'Get time-bucketed avg/p95 duration for agent runs and LLM calls (gen_ai.operation.type:agent/ai_client spans) for a Rustrak project — the "Duration" AI Agent Monitoring widget.',
      inputSchema: timeseriesInput,
    },
    async ({ project_id, period_hours, interval_hours }) => {
      try {
        const result = await client.agents.getDuration(project_id, {
          period_hours,
          interval_hours,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'get_agent_models_by_calls',
    {
      description:
        'Get the top LLM models by call count (gen_ai.operation.type:ai_client spans, grouped by response model) for a Rustrak project — the "LLM Calls by Model" AI Agent Monitoring widget.',
      inputSchema: breakdownInput,
    },
    async ({ project_id, period_hours, limit }) => {
      try {
        const result = await client.agents.getModelsByCalls(project_id, {
          period_hours,
          limit,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'get_agent_models_by_tokens',
    {
      description:
        'Get the top LLM models by total tokens used (gen_ai.operation.type:ai_client spans, grouped by response model) for a Rustrak project — the "Tokens Used by Model" AI Agent Monitoring widget.',
      inputSchema: breakdownInput,
    },
    async ({ project_id, period_hours, limit }) => {
      try {
        const result = await client.agents.getModelsByTokens(project_id, {
          period_hours,
          limit,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'get_agent_tools',
    {
      description:
        'Get the top tools by call count (gen_ai.operation.type:tool spans, grouped by tool name) for a Rustrak project — the "Tool Calls by Tool" AI Agent Monitoring widget.',
      inputSchema: breakdownInput,
    },
    async ({ project_id, period_hours, limit }) => {
      try {
        const result = await client.agents.getTools(project_id, {
          period_hours,
          limit,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'list_agent_traces',
    {
      description:
        'List AI agent traces for a Rustrak project — one row per trace_id with duration, total tokens, and tool call count aggregated across every AI span in that trace (standalone or transaction-embedded). Offset-paginated, newest trace first. This is the AI Agent Monitoring "Traces" table — use list_spans with trace_id to drill into one trace\'s individual spans.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Page number (1-indexed, default 1)'),
        per_page: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Items per page (default 20, max 100)'),
      },
    },
    async ({ project_id, page, per_page }) => {
      try {
        const result = await client.agents.getTraces(project_id, {
          page,
          per_page,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
