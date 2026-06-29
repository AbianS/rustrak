import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv } from '../setup.js';

describe('monitor tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  const mockMonitors = [
    {
      id: 'a1b2c3d4-e89b-12d3-a456-426614174000',
      slug: 'nightly-backup',
      status: 'ok',
      schedule_type: 'crontab',
      schedule_value: '0 0 * * *',
      schedule_unit: null,
      timezone: 'UTC',
      checkin_margin: 5,
      max_runtime: 30,
      last_check_in_at: '2026-06-18T00:00:01.000Z',
      last_check_in_status: 'ok',
      next_expected_at: '2026-06-19T00:00:00.000Z',
      created_at: '2026-06-01T00:00:00.000Z',
    },
  ];

  const mockCheckInPage = {
    items: [
      {
        id: 'c1c2c3c4-e89b-12d3-a456-426614174000',
        status: 'ok',
        duration: 12.5,
        environment: 'production',
        trace_id: null,
        timestamp: '2026-06-18T00:00:01.000Z',
      },
    ],
    total_count: 1,
    page: 1,
    per_page: 20,
    total_pages: 1,
  };

  beforeEach(async () => {
    mockClient = {
      monitors: {
        list: vi.fn(),
        listCheckIns: vi.fn(),
      },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('list_monitors', () => {
    it('returns monitors for a project', async () => {
      mockClient.monitors.list.mockResolvedValue(mockMonitors);

      const result = await callTool({
        name: 'list_monitors',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].slug).toBe('nightly-backup');
      expect(parsed[0].status).toBe('ok');
      expect(mockClient.monitors.list).toHaveBeenCalledWith(1);
    });

    it('returns error content on API failure', async () => {
      mockClient.monitors.list.mockRejectedValue(new Error('API error'));

      const result = await callTool({
        name: 'list_monitors',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unexpected error');
    });
  });

  describe('list_monitor_check_ins', () => {
    it('returns a check-in page for a monitor', async () => {
      mockClient.monitors.listCheckIns.mockResolvedValue(mockCheckInPage);

      const result = await callTool({
        name: 'list_monitor_check_ins',
        arguments: { project_id: 1, slug: 'nightly-backup' },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].status).toBe('ok');
      expect(mockClient.monitors.listCheckIns).toHaveBeenCalledWith(
        1,
        'nightly-backup',
        expect.any(Object),
      );
    });

    it('forwards pagination options', async () => {
      mockClient.monitors.listCheckIns.mockResolvedValue(mockCheckInPage);

      await callTool({
        name: 'list_monitor_check_ins',
        arguments: { project_id: 1, slug: 'job', page: 2, per_page: 50 },
      });

      expect(mockClient.monitors.listCheckIns).toHaveBeenCalledWith(
        1,
        'job',
        expect.objectContaining({ page: 2, per_page: 50 }),
      );
    });
  });
});
