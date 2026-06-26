import { NotFoundError, RateLimitError } from '@rustrak/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv } from '../setup.js';

describe('issue tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  beforeEach(async () => {
    mockClient = {
      issues: {
        list: vi.fn(),
        get: vi.fn(),
        updateState: vi.fn(),
        delete: vi.fn(),
      },
      projects: { list: vi.fn(), get: vi.fn(), create: vi.fn() },
      events: { list: vi.fn(), get: vi.fn() },
      tokens: { list: vi.fn(), get: vi.fn(), create: vi.fn(), delete: vi.fn() },
      alertIntegrations: { list: vi.fn(), test: vi.fn() },
      alertRules: { list: vi.fn() },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('list_issues', () => {
    it('returns paginated issues for a project', async () => {
      const mockData = {
        items: [
          {
            id: 'abc123',
            title: 'TypeError: Cannot read property',
            is_resolved: false,
            is_muted: false,
            event_count: 5,
            user_count: 2,
            first_seen: '2024-01-01T00:00:00Z',
            last_seen: '2024-01-02T00:00:00Z',
            project_id: 1,
          },
        ],
        total: 1,
        page: 1,
        per_page: 25,
      };
      mockClient.issues.list.mockResolvedValue(mockData);

      const result = await callTool({
        name: 'list_issues',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0]?.type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items).toHaveLength(1);
      expect(mockClient.issues.list).toHaveBeenCalledWith(1, {
        page: undefined,
        per_page: undefined,
        filter: undefined,
      });
    });
  });

  describe('resolve_issue', () => {
    it('resolves an issue successfully', async () => {
      const mockIssue = {
        id: 'abc123',
        title: 'TypeError',
        is_resolved: true,
        is_muted: false,
        event_count: 1,
        user_count: 1,
        first_seen: '2024-01-01T00:00:00Z',
        last_seen: '2024-01-01T00:00:00Z',
        project_id: 1,
      };
      mockClient.issues.updateState.mockResolvedValue(mockIssue);

      const result = await callTool({
        name: 'resolve_issue',
        arguments: { project_id: 1, issue_id: 'abc123' },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.is_resolved).toBe(true);
      expect(mockClient.issues.updateState).toHaveBeenCalledWith(1, 'abc123', {
        is_resolved: true,
      });
    });
  });

  describe('error handling', () => {
    it('returns isError: true on 404', async () => {
      mockClient.issues.get.mockRejectedValue(new NotFoundError('issue-xyz'));

      const result = await callTool({
        name: 'get_issue',
        arguments: { project_id: 1, issue_id: 'xyz' },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toMatch(/not found/i);
    });

    it('returns isError: true on 429 rate limit', async () => {
      mockClient.issues.list.mockRejectedValue(
        new RateLimitError('Rate limit exceeded', 60),
      );

      const result = await callTool({
        name: 'list_issues',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toMatch(/60/);
    });
  });
});
