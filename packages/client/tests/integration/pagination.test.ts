import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { server } from '../setup.js';

describe('Pagination', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('Issues Pagination', () => {
    it('should handle multiple pages', async () => {
      let requestCount = 0;

      server.use(
        http.get(
          'http://localhost:8080/api/projects/:projectId/issues',
          ({ request }) => {
            requestCount++;
            const url = new URL(request.url);
            const cursor = url.searchParams.get('cursor');

            if (!cursor) {
              // First page
              return HttpResponse.json({
                items: [
                  {
                    id: '323e4567-e89b-12d3-a456-426614174000',
                    project_id: 1,
                    short_id: 'TEST-1',
                    title: 'Issue 1',
                    first_seen: '2026-01-20T10:00:00.000Z',
                    last_seen: '2026-01-20T11:00:00.000Z',
                    event_count: 5,
                    level: 'error',
                    platform: 'javascript',
                    is_resolved: false,
                    is_muted: false,
                  },
                ],
                next_cursor: 'page2',
                has_more: true,
              });
            } else if (cursor === 'page2') {
              // Second page
              return HttpResponse.json({
                items: [
                  {
                    id: '423e4567-e89b-12d3-a456-426614174000',
                    project_id: 1,
                    short_id: 'TEST-2',
                    title: 'Issue 2',
                    first_seen: '2026-01-20T09:00:00.000Z',
                    last_seen: '2026-01-20T10:00:00.000Z',
                    event_count: 3,
                    level: 'error',
                    platform: 'javascript',
                    is_resolved: false,
                    is_muted: false,
                  },
                ],
                next_cursor: 'page3',
                has_more: true,
              });
            } else {
              // Last page
              return HttpResponse.json({
                items: [],
                has_more: false,
              });
            }
          },
        ),
      );

      // Iterate through all pages
      const allIssues = [];
      let cursor: string | undefined;

      do {
        const response = await client.issues.list(1, { cursor });
        allIssues.push(...response.items);
        cursor = response.next_cursor;
      } while (cursor);

      expect(allIssues).toHaveLength(2);
      expect(requestCount).toBe(3); // 3 requests total
    });

    it('should handle empty first page', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects/:projectId/issues', () => {
          return HttpResponse.json({
            items: [],
            has_more: false,
          });
        }),
      );

      const response = await client.issues.list(1);

      expect(response.items).toHaveLength(0);
      expect(response.has_more).toBe(false);
      expect(response.next_cursor).toBeUndefined();
    });

    it('should handle pagination with query parameters', async () => {
      server.use(
        http.get(
          'http://localhost:8080/api/projects/:projectId/issues',
          ({ request }) => {
            const url = new URL(request.url);
            const sort = url.searchParams.get('sort');
            const order = url.searchParams.get('order');
            const includeResolved = url.searchParams.get('include_resolved');

            // Verify parameters are passed correctly
            expect(sort).toBe('last_seen');
            expect(order).toBe('asc');
            expect(includeResolved).toBe('true');

            return HttpResponse.json({
              items: [],
              has_more: false,
            });
          },
        ),
      );

      await client.issues.list(1, {
        sort: 'last_seen',
        order: 'asc',
        include_resolved: true,
      });
    });

    it('should preserve query params across pagination', async () => {
      const capturedParams: {
        first: URLSearchParams | null;
        second: URLSearchParams | null;
      } = {
        first: null,
        second: null,
      };

      server.use(
        http.get(
          'http://localhost:8080/api/projects/:projectId/issues',
          ({ request }) => {
            const url = new URL(request.url);
            const cursor = url.searchParams.get('cursor');

            if (!cursor) {
              capturedParams.first = url.searchParams;
              return HttpResponse.json({
                items: [],
                next_cursor: 'page2',
                has_more: true,
              });
            } else {
              capturedParams.second = url.searchParams;
              return HttpResponse.json({
                items: [],
                has_more: false,
              });
            }
          },
        ),
      );

      const firstPage = await client.issues.list(1, {
        sort: 'last_seen',
        include_resolved: true,
      });

      await client.issues.list(1, {
        sort: 'last_seen',
        include_resolved: true,
        cursor: firstPage.next_cursor,
      });

      expect(capturedParams.first?.get('sort')).toBe('last_seen');
      expect(capturedParams.second?.get('sort')).toBe('last_seen');
      expect(capturedParams.second?.get('cursor')).toBe('page2');
    });
  });

  describe('Events Pagination', () => {
    it('should handle events pagination', async () => {
      server.use(
        http.get(
          'http://localhost:8080/api/projects/:projectId/issues/:issueId/events',
          ({ request }) => {
            const url = new URL(request.url);
            const cursor = url.searchParams.get('cursor');

            if (!cursor) {
              return HttpResponse.json({
                items: [
                  {
                    id: '523e4567-e89b-12d3-a456-426614174000',
                    event_id: '623e4567-e89b-12d3-a456-426614174000',
                    issue_id: '323e4567-e89b-12d3-a456-426614174000',
                    title: 'Event 1',
                    timestamp: '2026-01-20T11:00:00.000Z',
                    level: 'error',
                    platform: 'javascript',
                    release: '1.0.0',
                    environment: 'production',
                  },
                ],
                next_cursor: 'next',
                has_more: true,
              });
            }

            return HttpResponse.json({
              items: [],
              has_more: false,
            });
          },
        ),
      );

      const firstPage = await client.events.list(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
      );

      expect(firstPage.items).toHaveLength(1);
      expect(firstPage.has_more).toBe(true);

      const secondPage = await client.events.list(
        1,
        '323e4567-e89b-12d3-a456-426614174000',
        { cursor: firstPage.next_cursor },
      );

      expect(secondPage.items).toHaveLength(0);
      expect(secondPage.has_more).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle cursor with special characters', async () => {
      const specialCursor = 'eyJzb3J0IjoibGFzdF9zZWVuIiwib3JkZXIiOiJkZXNjIn0=';

      server.use(
        http.get(
          'http://localhost:8080/api/projects/:projectId/issues',
          ({ request }) => {
            const url = new URL(request.url);
            const cursor = url.searchParams.get('cursor');

            expect(cursor).toBe(specialCursor);

            return HttpResponse.json({
              items: [],
              has_more: false,
            });
          },
        ),
      );

      await client.issues.list(1, { cursor: specialCursor });
    });

    it('should handle has_more without next_cursor', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects/:projectId/issues', () => {
          return HttpResponse.json({
            items: [],
            has_more: false,
            // next_cursor is omitted
          });
        }),
      );

      const response = await client.issues.list(1);

      expect(response.has_more).toBe(false);
      expect(response.next_cursor).toBeUndefined();
    });

    it('should handle very long cursor strings', async () => {
      const longCursor = 'x'.repeat(1000);

      server.use(
        http.get(
          'http://localhost:8080/api/projects/:projectId/issues',
          ({ request }) => {
            const url = new URL(request.url);
            const cursor = url.searchParams.get('cursor');

            if (cursor === longCursor) {
              return HttpResponse.json({
                items: [],
                has_more: false,
              });
            }

            return HttpResponse.json(
              { error: 'Invalid cursor' },
              { status: 400 },
            );
          },
        ),
      );

      const response = await client.issues.list(1, { cursor: longCursor });
      expect(response.items).toHaveLength(0);
    });

    it('should handle rapid pagination requests', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects/:projectId/issues', () => {
          return HttpResponse.json({
            items: [],
            has_more: false,
          });
        }),
      );

      // Make 10 rapid requests
      const requests = Array.from({ length: 10 }, (_, i) =>
        client.issues.list(1, { cursor: `page${i}` }),
      );

      const responses = await Promise.all(requests);
      expect(responses).toHaveLength(10);
      responses.forEach((response) => {
        expect(response.has_more).toBe(false);
      });
    });
  });
});
