import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { NotFoundError } from '../../src/errors/index.js';

describe('EventsResource Integration', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('list()', () => {
    it('should fetch events for an issue', async () => {
      const response = await client.events.list(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
      );

      expect(response.items).toHaveLength(1);
      expect(response.has_more).toBe(false);
    });

    it('should support order parameter', async () => {
      const response = await client.events.list(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
        { order: 'asc' },
      );

      expect(response.items).toBeDefined();
    });

    it('should support cursor pagination', async () => {
      const response = await client.events.list(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
        { cursor: 'some-cursor' },
      );

      expect(response.items).toBeDefined();
    });

    it('should validate event structure', async () => {
      const response = await client.events.list(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
      );

      const event = response.items[0];
      expect(event).toBeDefined();
      expect(event!.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(event!.event_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(event!.issue_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should validate datetime format', async () => {
      const response = await client.events.list(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
      );

      const event = response.items[0];
      expect(event).toBeDefined();
      expect(new Date(event!.timestamp).toISOString()).toBe(event!.timestamp);
    });
  });

  describe('get()', () => {
    it('should fetch event detail with full data', async () => {
      const event = await client.events.get(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
        '523e4567-e89b-12d3-a456-426614174000',
      );

      expect(event.id).toBe('523e4567-e89b-12d3-a456-426614174000');
      expect(event.title).toBe('TypeError: Cannot read property');
      expect(event.data).toBeDefined();
      expect(event.ingested_at).toBeDefined();
      expect(event.server_name).toBe('web-1');
      expect(event.sdk_name).toBe('@sentry/browser');
      expect(event.sdk_version).toBe('7.0.0');
    });

    it('should validate full Sentry event data', async () => {
      const event = await client.events.get(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
        '523e4567-e89b-12d3-a456-426614174000',
      );

      expect(event.data).toHaveProperty('exception');
      expect(event.data.exception).toHaveProperty('values');
    });

    it('should throw NotFoundError for non-existent event', async () => {
      await expect(
        client.events.get(
          1,
          '323e4567-e89b-12d3-a456-426614174000',
          '999e4567-e89b-12d3-a456-426614174000',
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('should validate datetime formats', async () => {
      const event = await client.events.get(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
        '523e4567-e89b-12d3-a456-426614174000',
      );

      expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
      expect(new Date(event.ingested_at).toISOString()).toBe(event.ingested_at);
    });
  });
});
