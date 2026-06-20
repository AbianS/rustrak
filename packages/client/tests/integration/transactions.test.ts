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

      expect(result.has_more).toBe(false);
      expect(result.items).toHaveLength(1);
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

    it('accepts cursor option', async () => {
      const result = await client.transactions.list(1, {
        cursor: 'some-cursor',
      });
      expect(result).toBeDefined();
    });
  });
});
