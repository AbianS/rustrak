import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv } from '../setup.js';

describe('transaction tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  const mockTransactionPage = {
    items: [
      {
        id: 'a1b2c3d4-e89b-12d3-a456-426614174000',
        event_id: 'b2c3d4e5-e89b-12d3-a456-426614174000',
        transaction_name: '/api/checkout',
        timestamp: '2026-06-18T12:00:00.000Z',
        start_timestamp: '2026-06-18T11:59:59.000Z',
        duration_ms: 1000.0,
        platform: 'javascript',
        environment: 'production',
        release: '1.0.0',
        ingested_at: '2026-06-18T12:00:01.000Z',
      },
    ],
    has_more: false,
  };

  const mockTransactionDetail = {
    ...mockTransactionPage.items[0],
    data: {
      spans: [{ span_id: 'child1', parent_span_id: 'root', op: 'db' }],
      contexts: { trace: { span_id: 'root', op: 'http.server' } },
      measurements: { lcp: { value: 1200.0, unit: 'millisecond' } },
    },
  };

  beforeEach(async () => {
    mockClient = {
      transactions: {
        list: vi.fn(),
        get: vi.fn(),
      },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('list_transactions', () => {
    it('returns a transaction page for a project', async () => {
      mockClient.transactions.list.mockResolvedValue(mockTransactionPage);

      const result = await callTool({
        name: 'list_transactions',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].transaction_name).toBe('/api/checkout');
      expect(parsed.items[0].duration_ms).toBe(1000.0);
      expect(parsed.has_more).toBe(false);
      expect(mockClient.transactions.list).toHaveBeenCalledWith(1, {
        cursor: undefined,
      });
    });

    it('passes cursor when provided', async () => {
      mockClient.transactions.list.mockResolvedValue(mockTransactionPage);

      await callTool({
        name: 'list_transactions',
        arguments: { project_id: 1, cursor: 'next-page' },
      });

      expect(mockClient.transactions.list).toHaveBeenCalledWith(1, {
        cursor: 'next-page',
      });
    });

    it('returns error content on API failure', async () => {
      mockClient.transactions.list.mockRejectedValue(new Error('API error'));

      const result = await callTool({
        name: 'list_transactions',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unexpected error');
    });
  });

  describe('get_transaction', () => {
    it('returns full transaction detail', async () => {
      mockClient.transactions.get.mockResolvedValue(mockTransactionDetail);

      const result = await callTool({
        name: 'get_transaction',
        arguments: {
          project_id: 1,
          transaction_id: 'a1b2c3d4-e89b-12d3-a456-426614174000',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.transaction_name).toBe('/api/checkout');
      expect(parsed.data.spans[0].op).toBe('db');
      expect(mockClient.transactions.get).toHaveBeenCalledWith(
        1,
        'a1b2c3d4-e89b-12d3-a456-426614174000',
      );
    });

    it('returns error content on API failure', async () => {
      mockClient.transactions.get.mockRejectedValue(new Error('API error'));

      const result = await callTool({
        name: 'get_transaction',
        arguments: { project_id: 1, transaction_id: 'x' },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unexpected error');
    });
  });
});
