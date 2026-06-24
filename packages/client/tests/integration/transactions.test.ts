import { describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/index.js';

const client = new RustrakClient({
  baseUrl: 'http://localhost:8080',
  token: 'test-token',
});

describe('TransactionsResource', () => {
  describe('list()', () => {
    it('returns paginated transaction list', async () => {
      const result = await client.transactions.list(1);

      expect(result.total_count).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.total_pages).toBe(1);
    });

    it('returns transaction with correct shape', async () => {
      const result = await client.transactions.list(1);
      const txn = result.items[0];

      expect(txn.id).toBe('a1b2c3d4-e89b-12d3-a456-426614174000');
      expect(txn.transaction_name).toBe('/api/checkout');
      expect(txn.platform).toBe('javascript');
      expect(txn.environment).toBe('production');
      expect(txn.release).toBe('1.0.0');
      expect(txn.duration_ms).toBe(1000.0);
      expect(txn.start_timestamp).toBe('2026-06-18T11:59:59.000Z');
    });

    it('accepts pagination options', async () => {
      const result = await client.transactions.list(1, {
        page: 1,
        per_page: 10,
      });
      expect(result).toBeDefined();
    });

    it('accepts filter options', async () => {
      const result = await client.transactions.list(1, {
        name: '/api/checkout',
        op: 'http.server',
        status: 'ok',
        environment: 'production',
        release: '1.0.0',
      });
      expect(result).toBeDefined();
    });
  });

  describe('getSpans()', () => {
    it('returns the indexed spans for a transaction', async () => {
      const spans = await client.transactions.getSpans(
        1,
        'a1b2c3d4-e89b-12d3-a456-426614174000',
      );

      expect(spans).toHaveLength(1);
      expect(spans[0].op).toBe('db.query');
      expect(spans[0].description).toBe('SELECT 1');
      expect(spans[0].duration_ms).toBe(500.0);
      expect(spans[0].is_segment).toBe(false);
    });
  });

  describe('getStats()', () => {
    it('returns paginated aggregate stats per transaction group', async () => {
      const result = await client.transactions.getStats(1);

      expect(result.total_count).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].transaction_name).toBe('/api/checkout');
      expect(result.items[0].op).toBe('http.server');
      expect(result.items[0].count).toBe(3);
      expect(result.items[0].p50_ms).toBe(200.0);
      expect(result.items[0].failure_rate).toBeCloseTo(0.3333, 3);
    });
  });

  describe('get()', () => {
    it('returns a transaction detail with full payload', async () => {
      const txn = await client.transactions.get(
        1,
        'a1b2c3d4-e89b-12d3-a456-426614174000',
      );

      expect(txn.transaction_name).toBe('/api/checkout');
      expect(txn.duration_ms).toBe(1000.0);
      expect(txn.data.spans).toHaveLength(1);
      expect(txn.data.spans[0].op).toBe('db');
      expect(txn.data.contexts.trace.span_id).toBe('root');
      expect(txn.data.measurements.lcp.value).toBe(1200.0);
    });

    it('throws NotFoundError for a missing transaction', async () => {
      await expect(client.transactions.get(1, 'missing')).rejects.toThrow();
    });
  });
});
