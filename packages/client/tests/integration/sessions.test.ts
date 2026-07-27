import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { expectOk } from '../helpers/result.js';

describe('SessionsResource', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('stats()', () => {
    it('returns a paginated page of release health rows for a project', async () => {
      const result = expectOk(await client.sessions.stats(1));

      expect(result.items).toHaveLength(2);
      expect(result.total_count).toBe(2);
      expect(result.page).toBe(1);
      expect(result.total_pages).toBe(1);
      expect(result.items[0].release).toBe('1.0.0');
      expect(result.items[0].environment).toBe('production');
      expect(result.items[0].total).toBe(100);
      expect(result.items[0].crashed).toBe(2);
      expect(result.items[0].healthy).toBe(92);
      expect(result.items[0].crash_free_sessions_rate).toBeCloseTo(0.98);
      expect(result.items[0].crash_free_users_rate).toBeCloseTo(0.99);
    });

    it('passes period query param without error', async () => {
      const result = expectOk(await client.sessions.stats(1, { period: '7d' }));
      expect(result.items).toHaveLength(2);
    });

    it('works without an explicit period', async () => {
      const result = expectOk(await client.sessions.stats(1));
      expect(result.items).toHaveLength(2);
    });

    it('scopes to a single release server-side when release is passed', async () => {
      const result = expectOk(
        await client.sessions.stats(1, { release: '2.0.0' }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].release).toBe('2.0.0');
    });

    it('passes pagination params through to the server', async () => {
      const result = expectOk(
        await client.sessions.stats(1, { page: 2, per_page: 1 }),
      );

      expect(result.page).toBe(2);
      expect(result.per_page).toBe(1);
      expect(result.total_count).toBe(2);
      expect(result.total_pages).toBe(2);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].release).toBe('2.0.0');
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

  describe('summary()', () => {
    it('returns project-wide session health summary', async () => {
      const result = expectOk(await client.sessions.summary(1));

      expect(result.total).toBe(300);
      expect(result.errored).toBe(15);
      expect(result.crashed).toBe(6);
      expect(result.abnormal).toBe(3);
      expect(result.crash_free_sessions_rate).toBeCloseTo(0.98);
      expect(result.crash_free_users_rate).toBeCloseTo(0.99);
      expect(result.active_releases).toBe(2);
    });

    it('passes period query param without error', async () => {
      const result = expectOk(await client.sessions.summary(1, '7d'));
      expect(result.total).toBe(300);
    });
  });

  describe('timeseries()', () => {
    it('returns time-bucketed session trend points', async () => {
      const result = expectOk(await client.sessions.timeseries(1));

      expect(result).toHaveLength(2);
      expect(result[0].total).toBe(100);
      expect(result[0].crashed).toBe(2);
      expect(result[0].crash_free_sessions_rate).toBeCloseTo(0.98);
    });

    it('passes period and interval query params without error', async () => {
      const result = expectOk(await client.sessions.timeseries(1, '7d', 24));
      expect(result).toHaveLength(2);
    });
  });
});
