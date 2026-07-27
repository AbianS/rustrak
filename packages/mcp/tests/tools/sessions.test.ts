import { SERVER_ERROR_MESSAGE } from '@rustrak/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv, fail, ok } from '../setup.js';

describe('session tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  const mockReleaseHealth = {
    items: [
      {
        release: '1.0.0',
        environment: 'production',
        total: 100,
        errored: 5,
        crashed: 2,
        abnormal: 1,
        healthy: 92,
        crash_free_sessions_rate: 0.98,
        crash_free_users_rate: 0.99,
      },
    ],
    total_count: 1,
    page: 1,
    per_page: 20,
    total_pages: 1,
  };

  beforeEach(async () => {
    mockClient = {
      sessions: {
        stats: vi.fn(),
      },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('get_release_health', () => {
    it('returns release health for a project', async () => {
      mockClient.sessions.stats.mockResolvedValue(ok(mockReleaseHealth));

      const result = await callTool({
        name: 'get_release_health',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items).toHaveLength(1);
      expect(parsed.total_count).toBe(1);
      expect(parsed.items[0].release).toBe('1.0.0');
      expect(parsed.items[0].crash_free_sessions_rate).toBeCloseTo(0.98);
      expect(mockClient.sessions.stats).toHaveBeenCalledWith(1, {
        period: undefined,
        page: undefined,
        per_page: undefined,
      });
    });

    it('passes period when provided', async () => {
      mockClient.sessions.stats.mockResolvedValue(ok(mockReleaseHealth));

      await callTool({
        name: 'get_release_health',
        arguments: { project_id: 1, period: '7d' },
      });

      expect(mockClient.sessions.stats).toHaveBeenCalledWith(1, {
        period: '7d',
        page: undefined,
        per_page: undefined,
      });
    });

    it('passes pagination params when provided', async () => {
      mockClient.sessions.stats.mockResolvedValue(ok(mockReleaseHealth));

      await callTool({
        name: 'get_release_health',
        arguments: { project_id: 1, page: 2, per_page: 50 },
      });

      expect(mockClient.sessions.stats).toHaveBeenCalledWith(1, {
        period: undefined,
        page: 2,
        per_page: 50,
      });
    });

    it('returns error content on API failure', async () => {
      mockClient.sessions.stats.mockResolvedValue(
        fail({
          kind: 'server_error',
          status: 500,
          message: SERVER_ERROR_MESSAGE,
        }),
      );

      const result = await callTool({
        name: 'get_release_health',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(SERVER_ERROR_MESSAGE);
    });
  });
});
