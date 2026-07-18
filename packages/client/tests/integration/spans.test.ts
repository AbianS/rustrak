import { describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/index.js';

const client = new RustrakClient({
  baseUrl: 'http://localhost:8080',
  token: 'test-token',
});

describe('SpansResource', () => {
  describe('list()', () => {
    it('returns paginated span list', async () => {
      const result = await client.spans.list(1);

      expect(result.total_count).toBe(1);
      expect(result.items).toHaveLength(1);
    });

    it('returns a span with the shared standalone/transaction shape', async () => {
      const result = await client.spans.list(1);
      const span = result.items[0];

      expect(span.op).toBe('gen_ai.invoke_agent');
      expect(span.transaction_id).toBeNull();
      expect(span.is_segment).toBe(true);
      expect(span.duration_ms).toBe(1000.0);
    });

    it('accepts operation_type filter', async () => {
      const result = await client.spans.list(1, { operation_type: 'tool' });
      expect(result.items).toHaveLength(0);
    });

    it('accepts pagination and other filters', async () => {
      const result = await client.spans.list(1, {
        page: 1,
        per_page: 10,
        op: 'gen_ai.invoke_agent',
        status: 'ok',
        trace_id: 'abc',
      });
      expect(result).toBeDefined();
    });
  });
});
