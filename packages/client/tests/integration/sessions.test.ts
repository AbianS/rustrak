import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';

describe('SessionsResource', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('stats()', () => {
    it('returns release health rows for a project', async () => {
      const result = await client.sessions.stats(1);

      expect(result).toHaveLength(1);
      expect(result[0].release).toBe('1.0.0');
      expect(result[0].environment).toBe('production');
      expect(result[0].total).toBe(100);
      expect(result[0].crashed).toBe(2);
      expect(result[0].healthy).toBe(92);
      expect(result[0].crash_free_sessions_rate).toBeCloseTo(0.98);
      expect(result[0].crash_free_users_rate).toBeCloseTo(0.99);
    });

    it('passes period query param without error', async () => {
      const result = await client.sessions.stats(1, '7d');
      expect(result).toHaveLength(1);
      expect(result[0].release).toBe('1.0.0');
    });

    it('works without an explicit period', async () => {
      const result = await client.sessions.stats(1);
      expect(result).toHaveLength(1);
    });

    it('validates response schema — null rates are valid', async () => {
      const row = {
        release: '2.0.0',
        environment: 'staging',
        total: 0,
        errored: 0,
        crashed: 0,
        abnormal: 0,
        healthy: 0,
        crash_free_sessions_rate: null,
        crash_free_users_rate: null,
      };
      const { releaseHealthRowSchema } = await import(
        '../../src/schemas/session.js'
      );
      expect(() => releaseHealthRowSchema.parse(row)).not.toThrow();
    });
  });
});
