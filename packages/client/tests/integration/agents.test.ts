import { describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/index.js';
import { expectOk } from '../helpers/result.js';

const client = new RustrakClient({
  baseUrl: 'http://localhost:8080',
  token: 'test-token',
});

describe('AgentsResource', () => {
  describe('getRuns()', () => {
    it('returns a timeseries of agent run counts', async () => {
      const points = expectOk(await client.agents.getRuns(1));
      expect(points).toHaveLength(1);
      expect(points[0].value).toBe(3);
    });

    it('accepts period_hours and interval_hours', async () => {
      const points = expectOk(
        await client.agents.getRuns(1, {
          period_hours: 24,
          interval_hours: 1,
        }),
      );
      expect(points).toBeDefined();
    });
  });

  describe('getDuration()', () => {
    it('returns a timeseries of avg/p95 duration', async () => {
      const points = expectOk(await client.agents.getDuration(1));
      expect(points).toHaveLength(1);
      expect(points[0].avg_ms).toBe(200.0);
      expect(points[0].p95_ms).toBe(290.0);
    });
  });

  describe('getModelsByCalls()', () => {
    it('returns a breakdown of LLM calls by model', async () => {
      const rows = expectOk(await client.agents.getModelsByCalls(1));
      expect(rows).toHaveLength(1);
      expect(rows[0].label).toBe('gpt-4o');
      expect(rows[0].value).toBe(5);
    });

    it('accepts limit and period_hours', async () => {
      const rows = expectOk(
        await client.agents.getModelsByCalls(1, {
          limit: 5,
          period_hours: 24,
        }),
      );
      expect(rows).toBeDefined();
    });
  });

  describe('getModelsByTokens()', () => {
    it('returns a breakdown of tokens by model', async () => {
      const rows = expectOk(await client.agents.getModelsByTokens(1));
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe(1500);
    });
  });

  describe('getTools()', () => {
    it('returns a breakdown of tool calls by tool', async () => {
      const rows = expectOk(await client.agents.getTools(1));
      expect(rows).toHaveLength(1);
      expect(rows[0].label).toBe('search');
    });
  });

  describe('getTraces()', () => {
    it('returns paginated agent traces', async () => {
      const result = expectOk(await client.agents.getTraces(1));
      expect(result.total_count).toBe(1);
      expect(result.items[0].trace_id).toBe('ffffffffffffffffffffffffffffffff');
      expect(result.items[0].agent_names).toEqual(['planner', 'executor']);
      expect(result.items[0].tool_call_count).toBe(1);
    });

    it('accepts pagination options', async () => {
      const result = expectOk(
        await client.agents.getTraces(1, {
          page: 1,
          per_page: 10,
        }),
      );
      expect(result).toBeDefined();
    });
  });
});

describe('dashboard tables', () => {
  it('returns headline totals', async () => {
    const summary = expectOk(await client.agents.getSummary(1));

    expect(summary.agent_runs).toBe(12);
    expect(summary.llm_calls).toBe(31);
    expect(summary.error_count).toBe(3);
    expect(summary.p95_duration_ms).toBe(4210.0);
  });

  it('breaks model tokens down by type', async () => {
    const [row] = expectOk(await client.agents.getModelsTable(1));

    expect(row?.model).toBe('claude-opus-5');
    expect(row?.cached_input_tokens).toBe(12000);
    expect(row?.reasoning_output_tokens).toBe(2400);
  });

  it('reports per-tool failures', async () => {
    const [row] = expectOk(await client.agents.getToolsTable(1));

    expect(row?.tool).toBe('web_search');
    expect(row?.errors).toBe(1);
  });

  it('lists the environments available to filter on', async () => {
    const envs = expectOk(await client.agents.getEnvironments(1));

    expect(envs).toEqual(['production', 'staging']);
  });

  it('carries llm call and error counts on a trace row', async () => {
    const traces = expectOk(await client.agents.getTraces(1));

    expect(traces.items[0]?.llm_call_count).toBe(2);
    expect(traces.items[0]?.error_count).toBe(0);
  });
});
