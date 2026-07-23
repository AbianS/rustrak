import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv, ok } from '../setup.js';

describe('event tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  beforeEach(async () => {
    mockClient = {
      events: {
        list: vi.fn(),
        get: vi.fn(),
      },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('list_events', () => {
    it('returns events for an issue', async () => {
      const mockData = {
        items: [
          {
            id: 'evt-1',
            issue_id: 'iss-1',
            timestamp: '2024-01-01T00:00:00Z',
            platform: 'javascript',
          },
        ],
        next_cursor: null,
        has_more: false,
      };
      mockClient.events.list.mockResolvedValue(ok(mockData));

      const result = await callTool({
        name: 'list_events',
        arguments: { project_id: 1, issue_id: 'iss-1' },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items).toHaveLength(1);
      expect(mockClient.events.list).toHaveBeenCalledWith(1, 'iss-1', {
        cursor: undefined,
        order: undefined,
      });
    });
  });

  describe('get_event', () => {
    it('returns a single event with full detail', async () => {
      const mockEvent = {
        id: 'evt-42',
        issue_id: 'iss-1',
        timestamp: '2024-01-01T00:00:00Z',
        platform: 'javascript',
        data: { exception: { values: [{ type: 'TypeError', value: 'oops' }] } },
      };
      mockClient.events.get.mockResolvedValue(ok(mockEvent));

      const result = await callTool({
        name: 'get_event',
        arguments: { project_id: 1, issue_id: 'iss-1', event_id: 'evt-42' },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe('evt-42');
      expect(parsed.data.exception.values[0].type).toBe('TypeError');
      expect(mockClient.events.get).toHaveBeenCalledWith(1, 'iss-1', 'evt-42');
    });
  });
});
