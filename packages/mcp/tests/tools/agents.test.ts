import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv } from '../setup.js';

describe('agent tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  const mockTimeseries = [{ bucket: '2026-07-16T12:00:00.000Z', value: 3 }];
  const mockDurationSeries = [
    { bucket: '2026-07-16T12:00:00.000Z', avg_ms: 200, p95_ms: 290 },
  ];
  const mockBreakdown = [{ label: 'gpt-4o', value: 5 }];
  const mockTracesPage = {
    items: [
      {
        trace_id: 'ffffffffffffffffffffffffffffffff',
        agent_names: ['planner', 'executor'],
        duration_ms: 1000,
        total_tokens: 150,
        tool_call_count: 1,
        started_at: '2026-07-16T12:00:00.000Z',
      },
    ],
    total_count: 1,
    page: 1,
    per_page: 20,
    total_pages: 1,
  };

  beforeEach(async () => {
    mockClient = {
      agents: {
        getRuns: vi.fn(),
        getDuration: vi.fn(),
        getModelsByCalls: vi.fn(),
        getModelsByTokens: vi.fn(),
        getTools: vi.fn(),
        getTraces: vi.fn(),
      },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('get_agent_runs', () => {
    it('returns a timeseries of agent run counts', async () => {
      mockClient.agents.getRuns.mockResolvedValue(mockTimeseries);

      const result = await callTool({
        name: 'get_agent_runs',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].value).toBe(3);
      expect(mockClient.agents.getRuns).toHaveBeenCalledWith(
        1,
        expect.any(Object),
      );
    });

    it('forwards period_hours and interval_hours', async () => {
      mockClient.agents.getRuns.mockResolvedValue(mockTimeseries);

      await callTool({
        name: 'get_agent_runs',
        arguments: { project_id: 1, period_hours: 24, interval_hours: 1 },
      });

      expect(mockClient.agents.getRuns).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ period_hours: 24, interval_hours: 1 }),
      );
    });

    it('returns error content on API failure', async () => {
      mockClient.agents.getRuns.mockRejectedValue(new Error('API error'));

      const result = await callTool({
        name: 'get_agent_runs',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('get_agent_duration', () => {
    it('returns a timeseries of avg/p95 duration', async () => {
      mockClient.agents.getDuration.mockResolvedValue(mockDurationSeries);

      const result = await callTool({
        name: 'get_agent_duration',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed[0].avg_ms).toBe(200);
      expect(parsed[0].p95_ms).toBe(290);
    });

    it('returns error content on API failure', async () => {
      mockClient.agents.getDuration.mockRejectedValue(new Error('API error'));

      const result = await callTool({
        name: 'get_agent_duration',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('get_agent_models_by_calls', () => {
    it('returns a breakdown of LLM calls by model', async () => {
      mockClient.agents.getModelsByCalls.mockResolvedValue(mockBreakdown);

      const result = await callTool({
        name: 'get_agent_models_by_calls',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed[0].label).toBe('gpt-4o');
    });

    it('forwards limit and period_hours', async () => {
      mockClient.agents.getModelsByCalls.mockResolvedValue(mockBreakdown);

      await callTool({
        name: 'get_agent_models_by_calls',
        arguments: { project_id: 1, limit: 5, period_hours: 24 },
      });

      expect(mockClient.agents.getModelsByCalls).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ limit: 5, period_hours: 24 }),
      );
    });

    it('returns error content on API failure', async () => {
      mockClient.agents.getModelsByCalls.mockRejectedValue(
        new Error('API error'),
      );

      const result = await callTool({
        name: 'get_agent_models_by_calls',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('get_agent_models_by_tokens', () => {
    it('returns a breakdown of tokens by model', async () => {
      mockClient.agents.getModelsByTokens.mockResolvedValue(mockBreakdown);

      const result = await callTool({
        name: 'get_agent_models_by_tokens',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      expect(mockClient.agents.getModelsByTokens).toHaveBeenCalledWith(
        1,
        expect.any(Object),
      );
    });

    it('returns error content on API failure', async () => {
      mockClient.agents.getModelsByTokens.mockRejectedValue(
        new Error('API error'),
      );

      const result = await callTool({
        name: 'get_agent_models_by_tokens',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('get_agent_tools', () => {
    it('returns a breakdown of tool calls by tool', async () => {
      mockClient.agents.getTools.mockResolvedValue([
        { label: 'search', value: 4 },
      ]);

      const result = await callTool({
        name: 'get_agent_tools',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed[0].label).toBe('search');
    });

    it('returns error content on API failure', async () => {
      mockClient.agents.getTools.mockRejectedValue(new Error('API error'));

      const result = await callTool({
        name: 'get_agent_tools',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('list_agent_traces', () => {
    it('returns paginated agent traces', async () => {
      mockClient.agents.getTraces.mockResolvedValue(mockTracesPage);

      const result = await callTool({
        name: 'list_agent_traces',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items[0].trace_id).toBe('ffffffffffffffffffffffffffffffff');
      expect(parsed.items[0].agent_names).toEqual(['planner', 'executor']);
      expect(mockClient.agents.getTraces).toHaveBeenCalledWith(
        1,
        expect.any(Object),
      );
    });

    it('forwards pagination options', async () => {
      mockClient.agents.getTraces.mockResolvedValue(mockTracesPage);

      await callTool({
        name: 'list_agent_traces',
        arguments: { project_id: 1, page: 2, per_page: 50 },
      });

      expect(mockClient.agents.getTraces).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ page: 2, per_page: 50 }),
      );
    });

    it('returns error content on API failure', async () => {
      mockClient.agents.getTraces.mockRejectedValue(new Error('API error'));

      const result = await callTool({
        name: 'list_agent_traces',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
    });
  });
});
