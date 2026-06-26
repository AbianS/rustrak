import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv } from '../setup.js';

describe('log tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  const mockLogPage = {
    items: [
      {
        id: 'a1b2c3d4-e89b-12d3-a456-426614174000',
        trace_id: 'bbbb',
        span_id: null,
        level: 'info',
        severity_number: 9,
        body: 'ok',
        attributes: {},
        timestamp: '2026-06-18T12:00:01.000Z',
        ingested_at: '2026-06-18T12:00:02.000Z',
      },
    ],
    total_count: 1,
    page: 1,
    per_page: 20,
    total_pages: 1,
  };

  beforeEach(async () => {
    mockClient = {
      logs: {
        list: vi.fn(),
      },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('list_logs', () => {
    it('returns a log page for a project', async () => {
      mockClient.logs.list.mockResolvedValue(mockLogPage);

      const result = await callTool({
        name: 'list_logs',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].body).toBe('ok');
      expect(parsed.total_count).toBe(1);
      expect(mockClient.logs.list).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('forwards offset pagination and filters', async () => {
      mockClient.logs.list.mockResolvedValue(mockLogPage);

      await callTool({
        name: 'list_logs',
        arguments: {
          project_id: 1,
          page: 2,
          per_page: 50,
          level: 'error',
          trace_id: 'aaaa',
        },
      });

      expect(mockClient.logs.list).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          page: 2,
          per_page: 50,
          level: 'error',
          trace_id: 'aaaa',
        }),
      );
    });

    it('returns error content on API failure', async () => {
      mockClient.logs.list.mockRejectedValue(new Error('API error'));

      const result = await callTool({
        name: 'list_logs',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unexpected error');
    });
  });
});
