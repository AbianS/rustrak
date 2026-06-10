import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv } from '../setup.js';

describe('session tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  const mockReleaseHealth = [
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
  ];

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
      mockClient.sessions.stats.mockResolvedValue(mockReleaseHealth);

      const result = await callTool({
        name: 'get_release_health',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].release).toBe('1.0.0');
      expect(parsed[0].crash_free_sessions_rate).toBeCloseTo(0.98);
      expect(mockClient.sessions.stats).toHaveBeenCalledWith(1, undefined);
    });

    it('passes period when provided', async () => {
      mockClient.sessions.stats.mockResolvedValue(mockReleaseHealth);

      await callTool({
        name: 'get_release_health',
        arguments: { project_id: 1, period: '7d' },
      });

      expect(mockClient.sessions.stats).toHaveBeenCalledWith(1, '7d');
    });

    it('returns error content on API failure', async () => {
      mockClient.sessions.stats.mockRejectedValue(new Error('API error'));

      const result = await callTool({
        name: 'get_release_health',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unexpected error');
    });
  });
});
