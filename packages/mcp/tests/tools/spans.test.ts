import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv } from '../setup.js';

describe('span tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  const mockSpanPage = {
    items: [
      {
        id: 'd4e5f6a7-e89b-12d3-a456-426614174000',
        transaction_id: null,
        span_id: 'eeeeeeeeeeeeeeee',
        trace_id: 'ffffffffffffffffffffffffffffffff',
        parent_span_id: null,
        op: 'gen_ai.invoke_agent',
        description: null,
        status: null,
        start_timestamp: '2026-07-16T12:00:00.000Z',
        timestamp: '2026-07-16T12:00:01.000Z',
        duration_ms: 1000.0,
        exclusive_time_ms: null,
        is_segment: true,
        segment_id: 'eeeeeeeeeeeeeeee',
        platform: null,
        release: null,
        environment: null,
      },
    ],
    total_count: 1,
    page: 1,
    per_page: 20,
    total_pages: 1,
  };

  beforeEach(async () => {
    mockClient = {
      spans: {
        list: vi.fn(),
      },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('list_spans', () => {
    it('returns a span page for a project', async () => {
      mockClient.spans.list.mockResolvedValue(mockSpanPage);

      const result = await callTool({
        name: 'list_spans',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].op).toBe('gen_ai.invoke_agent');
      expect(mockClient.spans.list).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('forwards pagination and filters', async () => {
      mockClient.spans.list.mockResolvedValue(mockSpanPage);

      await callTool({
        name: 'list_spans',
        arguments: {
          project_id: 1,
          page: 2,
          per_page: 50,
          op: 'gen_ai.invoke_agent',
          status: 'ok',
          trace_id: 'abc',
          operation_type: 'agent',
        },
      });

      expect(mockClient.spans.list).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          page: 2,
          per_page: 50,
          op: 'gen_ai.invoke_agent',
          status: 'ok',
          trace_id: 'abc',
          operation_type: 'agent',
        }),
      );
    });

    it('returns error content on API failure', async () => {
      mockClient.spans.list.mockRejectedValue(new Error('API error'));

      const result = await callTool({
        name: 'list_spans',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unexpected error');
    });
  });
});
