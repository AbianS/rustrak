import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { NotFoundError } from '../../src/errors/index.js';

describe('StatsResource', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('timeseries()', () => {
    it('returns error volume split by severity', async () => {
      const result = await client.stats.timeseries(1);

      expect(result).toHaveLength(2);
      expect(result[0].total).toBe(10);
      expect(result[0].fatal).toBe(1);
      expect(result[0].error).toBe(6);
      expect(result[0].warning).toBe(2);
      expect(result[0].info).toBe(1);
    });

    it('keeps segments summing to the total', async () => {
      const result = await client.stats.timeseries(1);

      for (const point of result) {
        expect(point.fatal + point.error + point.warning + point.info).toBe(
          point.total,
        );
      }
    });

    it('keeps zero-filled buckets rather than dropping them', async () => {
      const result = await client.stats.timeseries(1);
      expect(result[1].total).toBe(0);
    });

    it('passes period and interval through to the server', async () => {
      const result = await client.stats.timeseries(1, '7d', 6);
      // The handler spaces buckets 6h apart only when interval reached it.
      expect(result[1].bucket).toBe('2026-01-20T16:00:00.000Z');
    });

    it('works without a period (all time)', async () => {
      const result = await client.stats.timeseries(1);
      expect(result).toHaveLength(2);
    });

    it('throws NotFoundError for a missing project', async () => {
      await expect(client.stats.timeseries(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('summary()', () => {
    it('returns counters with their previous-period comparison', async () => {
      const result = await client.stats.summary(1, '24h');

      expect(result.period_hours).toBe(24);
      expect(result.events.current).toBe(1200);
      expect(result.events.previous).toBe(1000);
      expect(result.new_issues.current).toBe(14);
      expect(result.new_issues.previous).toBe(9);
      expect(result.open_issues).toBe(40);
    });

    it('leaves previous null for an all-time request', async () => {
      const result = await client.stats.summary(1);

      expect(result.period_hours).toBeNull();
      expect(result.events.current).toBe(5000);
      expect(result.events.previous).toBeNull();
      expect(result.new_issues.previous).toBeNull();
    });

    it('throws NotFoundError for a missing project', async () => {
      await expect(client.stats.summary(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('schema validation', () => {
    it('accepts a null previous on a metric delta', async () => {
      const { metricDeltaSchema } = await import('../../src/schemas/stats.js');
      expect(() =>
        metricDeltaSchema.parse({ current: 3, previous: null }),
      ).not.toThrow();
    });

    it('rejects a fractional event count', async () => {
      const { eventTimeseriesPointSchema } = await import(
        '../../src/schemas/stats.js'
      );
      expect(() =>
        eventTimeseriesPointSchema.parse({
          bucket: '2026-01-20T10:00:00.000Z',
          total: 1.5,
          fatal: 0,
          error: 1.5,
          warning: 0,
          info: 0,
        }),
      ).toThrow();
    });
  });
});
