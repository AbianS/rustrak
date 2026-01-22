import { describe, expect, it } from 'vitest';
import {
  authTokenCreatedSchema,
  authTokenSchema,
  createProjectSchema,
  eventDetailSchema,
  issueSchema,
  paginatedResponseSchema,
  projectSchema,
} from '../../src/schemas/index.js';

describe('Schema Validation', () => {
  describe('projectSchema', () => {
    it('should validate valid project data', () => {
      const validProject = {
        id: 1,
        name: 'Test Project',
        slug: 'test-project',
        sentry_key: '123e4567-e89b-12d3-a456-426614174000',
        dsn: 'http://123e4567-e89b-12d3-a456-426614174000@localhost:8080/1',
        stored_event_count: 100,
        digested_event_count: 95,
        created_at: '2026-01-20T10:00:00.000Z',
        updated_at: '2026-01-20T10:00:00.000Z',
      };

      const result = projectSchema.safeParse(validProject);
      expect(result.success).toBe(true);
    });

    it('should reject project with invalid UUID', () => {
      const invalidProject = {
        id: 1,
        name: 'Test Project',
        slug: 'test-project',
        sentry_key: 'not-a-uuid',
        dsn: 'http://localhost:8080/1',
        stored_event_count: 100,
        digested_event_count: 95,
        created_at: '2026-01-20T10:00:00.000Z',
        updated_at: '2026-01-20T10:00:00.000Z',
      };

      const result = projectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });

    it('should reject project with invalid datetime', () => {
      const invalidProject = {
        id: 1,
        name: 'Test Project',
        slug: 'test-project',
        sentry_key: '123e4567-e89b-12d3-a456-426614174000',
        dsn: 'http://localhost:8080/1',
        stored_event_count: 100,
        digested_event_count: 95,
        created_at: 'not-a-date',
        updated_at: '2026-01-20T10:00:00.000Z',
      };

      const result = projectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });

    it('should reject project with missing required fields', () => {
      const invalidProject = {
        id: 1,
        name: 'Test Project',
      };

      const result = projectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });
  });

  describe('createProjectSchema', () => {
    it('should validate create project with all fields', () => {
      const input = {
        name: 'New Project',
        slug: 'new-project',
      };

      const result = createProjectSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate create project without optional slug', () => {
      const input = {
        name: 'New Project',
      };

      const result = createProjectSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const input = {
        name: '',
      };

      const result = createProjectSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('issueSchema', () => {
    it('should validate valid issue data', () => {
      const validIssue = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        project_id: 1,
        short_id: 'TEST-1',
        title: 'TypeError: Cannot read property',
        value: "Cannot read property 'x' of undefined",
        first_seen: '2026-01-20T10:00:00.000Z',
        last_seen: '2026-01-20T11:00:00.000Z',
        event_count: 5,
        level: 'error',
        platform: 'javascript',
        is_resolved: false,
        is_muted: false,
      };

      const result = issueSchema.safeParse(validIssue);
      expect(result.success).toBe(true);
    });

    it('should allow null level and platform', () => {
      const issue = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        project_id: 1,
        short_id: 'TEST-1',
        title: 'Error',
        value: 'Something went wrong',
        first_seen: '2026-01-20T10:00:00.000Z',
        last_seen: '2026-01-20T11:00:00.000Z',
        event_count: 5,
        level: null,
        platform: null,
        is_resolved: false,
        is_muted: false,
      };

      const result = issueSchema.safeParse(issue);
      expect(result.success).toBe(true);
    });
  });

  describe('eventDetailSchema', () => {
    it('should validate event with complex data object', () => {
      const validEvent = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        event_id: '223e4567-e89b-12d3-a456-426614174000',
        issue_id: '323e4567-e89b-12d3-a456-426614174000',
        title: 'Error: Something went wrong',
        timestamp: '2026-01-20T10:00:00.000Z',
        ingested_at: '2026-01-20T10:00:01.000Z',
        level: 'error',
        platform: 'javascript',
        release: '1.0.0',
        environment: 'production',
        server_name: 'web-1',
        sdk_name: '@sentry/browser',
        sdk_version: '7.0.0',
        data: {
          exception: {
            values: [
              {
                type: 'Error',
                value: 'Something went wrong',
                stacktrace: {
                  frames: [],
                },
              },
            ],
          },
          request: {
            url: 'https://example.com/api',
            method: 'GET',
          },
        },
      };

      const result = eventDetailSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it('should handle empty data object', () => {
      const event = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        event_id: '223e4567-e89b-12d3-a456-426614174000',
        issue_id: '323e4567-e89b-12d3-a456-426614174000',
        title: 'Error',
        timestamp: '2026-01-20T10:00:00.000Z',
        ingested_at: '2026-01-20T10:00:01.000Z',
        level: 'error',
        platform: 'javascript',
        release: '1.0.0',
        environment: 'production',
        server_name: 'web-1',
        sdk_name: '@sentry/browser',
        sdk_version: '7.0.0',
        data: {},
      };

      const result = eventDetailSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('paginatedResponseSchema', () => {
    it('should validate paginated response with items', () => {
      const response = {
        items: [
          {
            id: 1,
            name: 'Project 1',
            slug: 'project-1',
            sentry_key: '123e4567-e89b-12d3-a456-426614174000',
            dsn: 'http://localhost:8080/1',
            stored_event_count: 100,
            digested_event_count: 95,
            created_at: '2026-01-20T10:00:00.000Z',
            updated_at: '2026-01-20T10:00:00.000Z',
          },
        ],
        next_cursor: 'eyJzb3J0IjoiZGlnZXN0X29yZGVyIn0=',
        has_more: true,
      };

      const result = paginatedResponseSchema(projectSchema).safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate empty paginated response', () => {
      const response = {
        items: [],
        has_more: false,
      };

      const result = paginatedResponseSchema(projectSchema).safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should allow undefined next_cursor', () => {
      const response = {
        items: [],
        next_cursor: undefined,
        has_more: false,
      };

      const result = paginatedResponseSchema(projectSchema).safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('authTokenSchema', () => {
    it('should validate auth token with all fields', () => {
      const token = {
        id: 1,
        token_prefix: 'abc12345...',
        description: 'My Token',
        created_at: '2026-01-20T10:00:00.000Z',
        last_used_at: '2026-01-20T11:00:00.000Z',
      };

      const result = authTokenSchema.safeParse(token);
      expect(result.success).toBe(true);
    });

    it('should allow null description and last_used_at', () => {
      const token = {
        id: 1,
        token_prefix: 'abc12345...',
        description: null,
        created_at: '2026-01-20T10:00:00.000Z',
        last_used_at: null,
      };

      const result = authTokenSchema.safeParse(token);
      expect(result.success).toBe(true);
    });
  });

  describe('authTokenCreatedSchema', () => {
    it('should validate newly created token with full token', () => {
      const token = {
        id: 1,
        token: 'abc123456789def',
        description: 'CI Token',
        created_at: '2026-01-20T10:00:00.000Z',
      };

      const result = authTokenCreatedSchema.safeParse(token);
      expect(result.success).toBe(true);
    });
  });
});
