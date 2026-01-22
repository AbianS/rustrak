import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { NotFoundError } from '../../src/errors/index.js';

describe('IssuesResource Integration', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('list()', () => {
    it('should fetch issues with pagination', async () => {
      const response = await client.issues.list(1);

      expect(response.items).toHaveLength(2);
      expect(response.total_count).toBe(2);
      expect(response.page).toBe(1);
      expect(response.per_page).toBe(20);
      expect(response.total_pages).toBe(1);
    });

    it('should support page pagination', async () => {
      const firstPage = await client.issues.list(1);
      const secondPage = await client.issues.list(1, { page: 2 });

      expect(firstPage.items).toHaveLength(2);
      expect(secondPage.items).toHaveLength(0);
      expect(secondPage.page).toBe(2);
    });

    it('should support sort parameter', async () => {
      const response = await client.issues.list(1, {
        sort: 'last_seen',
      });

      expect(response.items).toBeDefined();
    });

    it('should support order parameter', async () => {
      const response = await client.issues.list(1, {
        order: 'asc',
      });

      expect(response.items).toBeDefined();
    });

    it('should support filter parameter', async () => {
      const response = await client.issues.list(1, {
        filter: 'all',
      });

      expect(response.items).toBeDefined();
    });

    it('should handle empty results', async () => {
      const response = await client.issues.list(1, { page: 99 });

      expect(response.items).toHaveLength(0);
    });

    it('should validate UUID format in response', async () => {
      const response = await client.issues.list(1);

      response.items.forEach((issue) => {
        expect(issue.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      });
    });

    it('should handle null level and platform', async () => {
      const response = await client.issues.list(1);
      const firstIssue = response.items[0];

      expect(firstIssue).toBeDefined();
      // level and platform can be string or null
      expect(['string', 'object']).toContain(typeof firstIssue!.level);
    });
  });

  describe('get()', () => {
    it('should fetch single issue', async () => {
      const issue = await client.issues.get(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
      );

      expect(issue.id).toBe('323e4567-e89b-12d3-a456-426614174000');
      expect(issue.title).toBe('TypeError: Cannot read property');
    });

    it('should throw NotFoundError for non-existent issue', async () => {
      await expect(
        client.issues.get(1, '999e4567-e89b-12d3-a456-426614174000'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateState()', () => {
    it('should resolve issue', async () => {
      const updated = await client.issues.updateState(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
        { is_resolved: true },
      );

      expect(updated.is_resolved).toBe(true);
    });

    it('should mute issue', async () => {
      const updated = await client.issues.updateState(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
        { is_muted: true },
      );

      expect(updated.is_muted).toBe(true);
    });

    it('should update both flags', async () => {
      const updated = await client.issues.updateState(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
        {
          is_resolved: true,
          is_muted: true,
        },
      );

      expect(updated.is_resolved).toBe(true);
      expect(updated.is_muted).toBe(true);
    });

    it('should throw NotFoundError for non-existent issue', async () => {
      await expect(
        client.issues.updateState(1, '999e4567-e89b-12d3-a456-426614174000', {
          is_resolved: true,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete()', () => {
    it('should delete issue successfully', async () => {
      await expect(
        client.issues.delete(1, '323e4567-e89b-12d3-a456-426614174000'),
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundError for non-existent issue', async () => {
      await expect(
        client.issues.delete(1, '999e4567-e89b-12d3-a456-426614174000'),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
