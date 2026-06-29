import { describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/index.js';

const client = new RustrakClient({
  baseUrl: 'http://localhost:8080',
  token: 'test-token',
});

describe('MonitorsResource', () => {
  describe('list()', () => {
    it('returns the project monitors', async () => {
      const monitors = await client.monitors.list(1);

      expect(monitors).toHaveLength(1);
      const monitor = monitors[0];
      expect(monitor.slug).toBe('nightly-backup');
      expect(monitor.status).toBe('ok');
      expect(monitor.schedule_type).toBe('crontab');
      expect(monitor.schedule_value).toBe('0 0 * * *');
      expect(monitor.next_expected_at).toBe('2026-06-19T00:00:00.000Z');
    });

    it('throws NotFoundError for an unknown project', async () => {
      await expect(client.monitors.list(999)).rejects.toThrow();
    });
  });

  describe('listCheckIns()', () => {
    it('returns paginated check-ins for a monitor', async () => {
      const result = await client.monitors.listCheckIns(1, 'nightly-backup');

      expect(result.total_count).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].status).toBe('ok');
      expect(result.items[0].duration).toBe(12.5);
      expect(result.items[1].status).toBe('error');
      expect(result.items[1].duration).toBeNull();
    });

    it('accepts pagination options', async () => {
      const result = await client.monitors.listCheckIns(1, 'job', {
        page: 1,
        per_page: 10,
      });
      expect(result).toBeDefined();
    });
  });
});
