import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';
import { server } from '../setup.js';

describe('ProjectsResource Integration', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('list()', () => {
    it('should fetch all projects', async () => {
      const response = await client.projects.list();

      expect(response.items).toHaveLength(2);
      expect(response.items[0]?.name).toBe('Test Project');
      expect(response.items[1]?.name).toBe('Another Project');
      expect(response.total_count).toBe(2);
      expect(response.page).toBe(1);
    });

    it('should validate response schema', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return HttpResponse.json({
            items: [
              {
                id: 1,
                name: 'Invalid',
                slug: 'invalid',
                sentry_key: 'not-a-uuid', // Invalid UUID
                dsn: 'http://localhost:8080/1',
                stored_event_count: 0,
                digested_event_count: 0,
                created_at: '2026-01-20T10:00:00.000Z',
                updated_at: '2026-01-20T10:00:00.000Z',
              },
            ],
            total_count: 1,
            page: 1,
            per_page: 20,
            total_pages: 1,
          });
        }),
      );

      await expect(client.projects.list()).rejects.toThrow(ValidationError);
    });

    it('should handle empty array', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return HttpResponse.json({
            items: [],
            total_count: 0,
            page: 1,
            per_page: 20,
            total_pages: 0,
          });
        }),
      );

      const response = await client.projects.list();
      expect(response.items).toHaveLength(0);
    });
  });

  describe('get()', () => {
    it('should fetch single project by id', async () => {
      const project = await client.projects.get(1);

      expect(project.id).toBe(1);
      expect(project.name).toBe('Test Project');
      expect(project.slug).toBe('test-project');
    });

    it('should throw NotFoundError for non-existent project', async () => {
      await expect(client.projects.get(999)).rejects.toThrow(NotFoundError);
    });

    it('should validate UUID format', async () => {
      const project = await client.projects.get(1);

      expect(project.sentry_key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should validate datetime format', async () => {
      const project = await client.projects.get(1);

      expect(new Date(project.created_at).toISOString()).toBe(
        project.created_at,
      );
      expect(new Date(project.updated_at).toISOString()).toBe(
        project.updated_at,
      );
    });
  });

  describe('create()', () => {
    it('should create project with all fields', async () => {
      const project = await client.projects.create({
        name: 'New Project',
        slug: 'new-project',
      });

      expect(project.name).toBe('New Project');
      expect(project.slug).toBe('new-project');
      expect(project.id).toBe(3);
    });

    it('should create project without optional slug', async () => {
      const project = await client.projects.create({
        name: 'Auto Slug Project',
      });

      expect(project.name).toBe('Auto Slug Project');
      expect(project.slug).toBeTruthy();
    });

    it('should reject empty name', async () => {
      await expect(client.projects.create({ name: '' })).rejects.toThrow(
        ValidationError,
      );
    });

    it('should reject malformed input', async () => {
      await expect(
        // @ts-expect-error - Testing runtime validation
        client.projects.create({ invalid: 'field' }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update()', () => {
    it('should update project name', async () => {
      const updated = await client.projects.update(1, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.id).toBe(1);
    });

    it('should throw NotFoundError for non-existent project', async () => {
      await expect(
        client.projects.update(999, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject empty name', async () => {
      await expect(client.projects.update(1, { name: '' })).rejects.toThrow(
        ValidationError,
      );
    });

    it('should update timestamp', async () => {
      const original = await client.projects.get(1);
      const updated = await client.projects.update(1, { name: 'Updated' });

      expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(original.updated_at).getTime(),
      );
    });
  });

  describe('delete()', () => {
    it('should delete project successfully', async () => {
      await expect(client.projects.delete(1)).resolves.toBeUndefined();
    });

    it('should throw NotFoundError for non-existent project', async () => {
      await expect(client.projects.delete(999)).rejects.toThrow(NotFoundError);
    });
  });
});
