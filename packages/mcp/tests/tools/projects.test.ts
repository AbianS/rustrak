import { NotFoundError } from '@rustrak/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv } from '../setup.js';

describe('project tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  beforeEach(async () => {
    mockClient = {
      projects: {
        list: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('list_projects', () => {
    it('returns all projects', async () => {
      const mockData = {
        items: [
          {
            id: 1,
            name: 'My App',
            slug: 'my-app',
            sentry_key: 'abc-123',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        per_page: 25,
      };
      mockClient.projects.list.mockResolvedValue(mockData);

      const result = await callTool({ name: 'list_projects', arguments: {} });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('My App');
    });

    it('returns isError on not found', async () => {
      mockClient.projects.list.mockRejectedValue(
        new NotFoundError('Resource not found: projects'),
      );

      const result = await callTool({ name: 'list_projects', arguments: {} });

      expect(result.isError).toBe(true);
    });
  });

  describe('get_project', () => {
    it('returns a single project by ID', async () => {
      const mockProject = {
        id: 42,
        name: 'Backend',
        slug: 'backend',
        sentry_key: 'xyz',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockClient.projects.get.mockResolvedValue(mockProject);

      const result = await callTool({
        name: 'get_project',
        arguments: { project_id: 42 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(42);
      expect(mockClient.projects.get).toHaveBeenCalledWith(42);
    });
  });

  describe('create_project', () => {
    it('creates a project with name', async () => {
      const mockProject = {
        id: 99,
        name: 'New Project',
        slug: 'new-project',
        sentry_key: 'new-key',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockClient.projects.create.mockResolvedValue(mockProject);

      const result = await callTool({
        name: 'create_project',
        arguments: { name: 'New Project' },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(99);
      expect(mockClient.projects.create).toHaveBeenCalledWith({
        name: 'New Project',
        slug: undefined,
      });
    });
  });
});
