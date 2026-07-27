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
