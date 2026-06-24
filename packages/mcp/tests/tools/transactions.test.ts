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
    total_count: 1,
    page: 1,
    per_page: 20,
    total_pages: 1,
  };

  const mockTransactionDetail = {
    ...mockTransactionPage.items[0],
    data: {
      spans: [{ span_id: 'child1', parent_span_id: 'root', op: 'db' }],
      contexts: { trace: { span_id: 'root', op: 'http.server' } },
      measurements: { lcp: { value: 1200.0, unit: 'millisecond' } },
    },
  };

  const mockStats = {
    items: [
      {
        transaction_name: '/api/checkout',
        op: 'http.server',
        count: 3,
        p50_ms: 200,
        p95_ms: 290,
        p99_ms: 298,
        failure_rate: 0.33,
      },
    ],
    total_count: 1,
    page: 1,
    per_page: 20,
    total_pages: 1,
  };

  const mockSpans = [
    {
      id: 'c3d4e5f6-e89b-12d3-a456-426614174000',
      span_id: 'cccccccccccccccc',
      trace_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      parent_span_id: 'bbbbbbbbbbbbbbbb',
      op: 'db.query',
      description: 'SELECT 1',
      status: 'ok',
      start_timestamp: '2026-06-18T11:59:59.000Z',
      timestamp: '2026-06-18T11:59:59.500Z',
      duration_ms: 500,
      exclusive_time_ms: 500,
      is_segment: false,
      segment_id: null,
    },
  ];

  beforeEach(async () => {
    mockClient = {
      transactions: {
        list: vi.fn(),
        get: vi.fn(),
        getStats: vi.fn(),
        getSpans: vi.fn(),
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
      expect(parsed.total_count).toBe(1);
      expect(mockClient.transactions.list).toHaveBeenCalledWith(
        1,
        expect.any(Object),
      );
    });

    it('forwards offset pagination and filters', async () => {
      mockClient.transactions.list.mockResolvedValue(mockTransactionPage);

      await callTool({
        name: 'list_transactions',
        arguments: {
          project_id: 1,
          page: 2,
          per_page: 50,
          name: '/api/checkout',
          op: 'http.server',
          status: 'ok',
        },
      });

      expect(mockClient.transactions.list).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          page: 2,
          per_page: 50,
          name: '/api/checkout',
          op: 'http.server',
          status: 'ok',
        }),
      );
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

  describe('get_transaction_stats', () => {
    it('returns aggregate stats per transaction group', async () => {
      mockClient.transactions.getStats.mockResolvedValue(mockStats);

      const result = await callTool({
        name: 'get_transaction_stats',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total_count).toBe(1);
      expect(parsed.items[0].transaction_name).toBe('/api/checkout');
      expect(parsed.items[0].p50_ms).toBe(200);
      expect(mockClient.transactions.getStats).toHaveBeenCalledWith(
        1,
        expect.any(Object),
      );
    });

    it('returns error content on API failure', async () => {
      mockClient.transactions.getStats.mockRejectedValue(
        new Error('API error'),
      );

      const result = await callTool({
        name: 'get_transaction_stats',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unexpected error');
    });
  });

  describe('get_transaction_spans', () => {
    it('returns indexed spans for a transaction', async () => {
      mockClient.transactions.getSpans.mockResolvedValue(mockSpans);

      const result = await callTool({
        name: 'get_transaction_spans',
        arguments: {
          project_id: 1,
          transaction_id: 'a1b2c3d4-e89b-12d3-a456-426614174000',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].op).toBe('db.query');
      expect(mockClient.transactions.getSpans).toHaveBeenCalledWith(
        1,
        'a1b2c3d4-e89b-12d3-a456-426614174000',
      );
    });

    it('returns error content on API failure', async () => {
      mockClient.transactions.getSpans.mockRejectedValue(
        new Error('API error'),
      );

      const result = await callTool({
        name: 'get_transaction_spans',
        arguments: { project_id: 1, transaction_id: 'x' },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unexpected error');
    });
  });
});
