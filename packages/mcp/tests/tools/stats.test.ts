import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv } from '../setup.js';

describe('stats tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  const mockTimeseries = [
    {
      bucket: '2026-01-20T10:00:00.000Z',
      total: 10,
      fatal: 1,
      error: 6,
      warning: 2,
      info: 1,
    },
    {
      bucket: '2026-01-20T11:00:00.000Z',
      total: 0,
      fatal: 0,
      error: 0,
      warning: 0,
      info: 0,
    },
  ];

  const mockSummary = {
    period_hours: 24,
    events: { current: 1200, previous: 1000 },
    new_issues: { current: 14, previous: 9 },
    open_issues: 40,
  };

  beforeEach(async () => {
    mockClient = {
      stats: {
        timeseries: vi.fn(),
        summary: vi.fn(),
      },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('get_error_volume', () => {
    it('returns event volume split by severity', async () => {
      mockClient.stats.timeseries.mockResolvedValue(mockTimeseries);

      const result = await callTool({
        name: 'get_error_volume',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].fatal).toBe(1);
      expect(parsed[0].error).toBe(6);
      expect(parsed[0].warning).toBe(2);
      expect(parsed[0].info).toBe(1);
      expect(mockClient.stats.timeseries).toHaveBeenCalledWith(
        1,
        undefined,
        undefined,
      );
    });

    it('keeps zero-filled buckets rather than dropping them', async () => {
      mockClient.stats.timeseries.mockResolvedValue(mockTimeseries);

      const result = await callTool({
        name: 'get_error_volume',
        arguments: { project_id: 1 },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed[1].total).toBe(0);
    });

    it('passes period and interval when provided', async () => {
      mockClient.stats.timeseries.mockResolvedValue(mockTimeseries);

      await callTool({
        name: 'get_error_volume',
        arguments: { project_id: 1, period: '7d', interval: 6 },
      });

      expect(mockClient.stats.timeseries).toHaveBeenCalledWith(1, '7d', 6);
    });

    it('returns error content on API failure', async () => {
      mockClient.stats.timeseries.mockRejectedValue(new Error('API error'));

      const result = await callTool({
        name: 'get_error_volume',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unexpected error');
    });
  });

  describe('get_project_stats', () => {
    it('returns counters with their previous-period comparison', async () => {
      mockClient.stats.summary.mockResolvedValue(mockSummary);

      const result = await callTool({
        name: 'get_project_stats',
        arguments: { project_id: 1, period: '24h' },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.events.current).toBe(1200);
      expect(parsed.events.previous).toBe(1000);
      expect(parsed.new_issues.current).toBe(14);
      expect(parsed.open_issues).toBe(40);
      expect(mockClient.stats.summary).toHaveBeenCalledWith(1, '24h');
    });

    it('omits the period for an all-time request', async () => {
      mockClient.stats.summary.mockResolvedValue({
        period_hours: null,
        events: { current: 5000, previous: null },
        new_issues: { current: 120, previous: null },
        open_issues: 40,
      });

      const result = await callTool({
        name: 'get_project_stats',
        arguments: { project_id: 1 },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.period_hours).toBeNull();
      expect(parsed.events.previous).toBeNull();
      expect(mockClient.stats.summary).toHaveBeenCalledWith(1, undefined);
    });

    it('returns error content on API failure', async () => {
      mockClient.stats.summary.mockRejectedValue(new Error('API error'));

      const result = await callTool({
        name: 'get_project_stats',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unexpected error');
    });
  });
});
