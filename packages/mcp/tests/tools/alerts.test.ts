import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv, ok } from '../setup.js';

describe('alert tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  beforeEach(async () => {
    mockClient = {
      alertIntegrations: {
        list: vi.fn(),
        test: vi.fn(),
      },
      alertRules: {
        list: vi.fn(),
      },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('list_alert_channels', () => {
    it('returns all alert notification channels', async () => {
      const mockChannels = [
        {
          id: 1,
          name: 'Slack #errors',
          channel_type: 'slack',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      mockClient.alertIntegrations.list.mockResolvedValue(ok(mockChannels));

      const result = await callTool({
        name: 'list_alert_channels',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].channel_type).toBe('slack');
    });
  });

  describe('test_alert_channel', () => {
    it('sends a test notification to the channel', async () => {
      const mockResponse = { success: true, message: 'Test notification sent' };
      mockClient.alertIntegrations.test.mockResolvedValue(ok(mockResponse));

      const result = await callTool({
        name: 'test_alert_channel',
        arguments: { channel_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(mockClient.alertIntegrations.test).toHaveBeenCalledWith(1);
    });
  });

  describe('list_alert_rules', () => {
    it('returns alert rules for a project', async () => {
      const mockRules = [
        {
          id: 1,
          project_id: 42,
          channel_id: 1,
          alert_type: 'new_issue',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      mockClient.alertRules.list.mockResolvedValue(ok(mockRules));

      const result = await callTool({
        name: 'list_alert_rules',
        arguments: { project_id: 42 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].alert_type).toBe('new_issue');
      expect(mockClient.alertRules.list).toHaveBeenCalledWith(42);
    });
  });
});
