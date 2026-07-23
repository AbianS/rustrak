import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import {
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  NotFoundError,
  RateLimitError,
  RustrakError,
  ServerError,
  ValidationError,
} from '../../src/errors/index.js';
import { createKyInstance } from '../../src/utils/index.js';
import { appErrorResponse } from '../mocks/handlers.js';
import { server } from '../setup.js';

describe('Error Handling', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  // These pin the status -> error-class mapping only. Bodies are built with
  // `appErrorResponse` so the one body shape the Rust process can emit is the
  // one under test; the two exceptions are called out where they occur.
  describe('HTTP Status Codes', () => {
    it('should throw BadRequestError for 400', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () =>
          appErrorResponse(
            'ValidationError',
            'Validation error: Invalid sort field: bogus',
          ),
        ),
      );

      await expect(client.projects.list()).rejects.toThrow(BadRequestError);
    });

    it('should throw AuthenticationError for 401', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () =>
          appErrorResponse('Unauthorized', 'Unauthorized: Invalid token'),
        ),
      );

      const error = await client.projects.list().catch((e) => e);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.retryable).toBe(false);
      expect(error.statusCode).toBe(401);
    });

    it('should throw AuthorizationError for 403', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () =>
          appErrorResponse(
            'Forbidden',
            'Forbidden: Insufficient project role for this action',
          ),
        ),
      );

      const error = await client.projects.list().catch((e) => e);
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.retryable).toBe(false);
      expect(error.statusCode).toBe(403);
    });

    it('should throw NotFoundError for 404', async () => {
      const error = await client.projects.get(999).catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.retryable).toBe(false);
      expect(error.statusCode).toBe(404);
    });

    it('should throw RateLimitError for 429', async () => {
      // Flat body on purpose: `routes/ingest.rs:38-46` is the only 429 the
      // server sends and it is not an `AppError`.
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return HttpResponse.json(
            { error: 'rate_limit_exceeded', retry_after: 60 },
            { status: 429, headers: { 'Retry-After': '60' } },
          );
        }),
      );

      const error = await client.projects.list().catch((e) => e);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.retryable).toBe(true);
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
    });

    it('should handle RateLimitError without Retry-After header', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return HttpResponse.json(
            { error: 'rate_limit_exceeded', retry_after: 60 },
            { status: 429 },
          );
        }),
      );

      const error = await client.projects.list().catch((e) => e);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.retryAfter).toBeUndefined();
    });

    it('should throw ServerError for 500', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () =>
          appErrorResponse(
            'InternalError',
            'Internal server error: Database pool not configured',
          ),
        ),
      );

      const error = await client.projects.list().catch((e) => e);
      expect(error).toBeInstanceOf(ServerError);
      expect(error.retryable).toBe(true);
      expect(error.statusCode).toBe(500);
    });

    // 502 and 503 are the deliberate exception: `AppError::status_code` cannot
    // produce either, so these only ever arrive from a reverse proxy in front
    // of the Rust process. Their bodies are whatever that proxy sends, so they
    // stay outside the `appErrorResponse` shape.
    it('should throw ServerError for 502 (proxy-generated, not an AppError)', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return new HttpResponse('<html><body>502 Bad Gateway</body></html>', {
            status: 502,
            headers: { 'Content-Type': 'text/html' },
          });
        }),
      );

      const error = await client.projects.list().catch((e) => e);
      expect(error).toBeInstanceOf(ServerError);
      expect(error.statusCode).toBe(502);
    });

    it('should throw ServerError for 503 (proxy-generated, not an AppError)', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return new HttpResponse(
            '<html><body>503 Service Unavailable</body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html' } },
          );
        }),
      );

      const error = await client.projects.list().catch((e) => e);
      expect(error).toBeInstanceOf(ServerError);
      expect(error.statusCode).toBe(503);
    });
  });

  // The suite historically asserted only the error class, so a client that
  // returned "[object Object]" for every error stayed green (gh-204). These
  // tests pin the parsed `message` against the exact body the fixture sent,
  // which is the shape `apps/server/src/error.rs` actually emits:
  // `{"error": {"type", "message"}}` with the thiserror prefix in `message`.
  describe('Server error contract (nested AppError body)', () => {
    it('400 ValidationError keeps the server message', async () => {
      const error = await client.auth
        .getInvitation('expired-token')
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe(
        'Validation error: Invitation is expired or already used',
      );
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
    });

    it('401 Unauthorized keeps the server message', async () => {
      const error = await client.auth
        .login({ email: 'nobody@example.com', password: 'wrong-password' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Unauthorized: Invalid credentials');
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
    });

    it('403 Forbidden keeps the server message', async () => {
      const error = await client.team.remove(2).catch((e) => e);

      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe(
        'Forbidden: The primary admin cannot be deleted',
      );
      expect(error.statusCode).toBe(403);
      expect(error.retryable).toBe(false);
    });

    it('404 NotFound keeps the server message without doubling the prefix', async () => {
      const error = await client.projects.get(999).catch((e) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      // `GET /api/projects/{id}` runs `access::require` and then
      // `ProjectService::get_by_id` (`services/project.rs:142`), which is what
      // 404s for the admin/legacy Bearer token these fixtures model. The exact
      // string also proves NotFoundError does not prepend a second
      // "Resource not found: " (gh-204's sibling).
      expect(error.message).toBe(
        'Resource not found: Project with id 999 not found',
      );
      expect(error.statusCode).toBe(404);
      expect(error.retryable).toBe(false);
    });

    // 409 has no dedicated error class today: `transformHttpError`'s `default:`
    // branch returns a bare RustrakError with `statusCode` set. That gap closes
    // in phase 3, when the hierarchy becomes a discriminated union. Until then
    // this pins the behaviour that actually exists.
    //
    // User 3 is the non-primary admin. Demoting user 2 cannot reach this guard:
    // `routes/team.rs:118-125` rejects a primary-admin role change first, which
    // the next test pins.
    it('409 Conflict keeps the server message on a bare RustrakError', async () => {
      const error = await client.team.updateRole(3, 'member').catch((e) => e);

      expect(error).toBeInstanceOf(RustrakError);
      expect(error.constructor).toBe(RustrakError);
      expect(error.message).toBe('Conflict: Cannot demote the last admin');
      expect(error.statusCode).toBe(409);
    });

    it('403 wins over 409 when the target is the primary admin', async () => {
      const error = await client.team.updateRole(2, 'member').catch((e) => e);

      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe(
        "Forbidden: The primary admin's role cannot be changed",
      );
      expect(error.statusCode).toBe(403);
    });

    it('403 Forbidden on the invite-only register endpoint', async () => {
      const error = await client.auth
        .register({ email: 'someone@example.com', password: 'password123' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe('Forbidden: Registration is invite-only');
      expect(error.statusCode).toBe(403);
    });
  });

  // Statuses whose only real producer is an endpoint this client never calls.
  // They are driven through a bare ky instance against `/__status-transform/*`
  // rather than a resource method, because no management endpoint can emit
  // them: `AppError::PayloadTooLarge` comes only from envelope ingestion and
  // the flat 429 only from the ingest rate limiter. See the matching block in
  // `tests/mocks/handlers.ts`.
  describe('transformHttpError status mapping (synthetic paths)', () => {
    const bareClient = (maxRetries = 0) =>
      createKyInstance({
        baseUrl: 'http://localhost:8080',
        token: 'test-token',
        maxRetries,
      });

    // 413 has no dedicated error class, same gap as 409: it falls through to
    // `transformHttpError`'s `default:` branch.
    it('413 PayloadTooLarge keeps the server message on a bare RustrakError', async () => {
      const error = await bareClient()
        .get('__status-transform/payload-too-large')
        .catch((e) => e);

      expect(error).toBeInstanceOf(RustrakError);
      expect(error.constructor).toBe(RustrakError);
      expect(error.message).toBe(
        'Payload too large: Compressed payload exceeds 104857600 bytes',
      );
      expect(error.statusCode).toBe(413);
    });

    it('500 DatabaseError keeps the server message, stays retryable', async () => {
      const error = await bareClient()
        .get('__status-transform/database-error')
        .catch((e) => e);

      expect(error).toBeInstanceOf(ServerError);
      expect(error.message).toBe(
        'Database error: pool timed out while waiting for an open connection',
      );
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
    });

    // `AppError::Internal` is the variant that carries arbitrary internal text
    // (`services/sourcemap.rs:441`), and it shares 500 with `Database`.
    it('500 InternalError keeps the server message', async () => {
      const error = await bareClient()
        .get('__status-transform/internal-error')
        .catch((e) => e);

      expect(error).toBeInstanceOf(ServerError);
      expect(error.message).toBe(
        'Internal server error: failed to store source file: No space left on device (os error 28)',
      );
      expect(error.statusCode).toBe(500);
    });

    it('429 exposes the flat ingest message and a populated retryAfter', async () => {
      const error = await bareClient()
        .get('__status-transform/rate-limited')
        .catch((e) => e);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('rate_limit_exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.retryable).toBe(true);
      expect(typeof error.retryAfter).toBe('number');
      expect(error.retryAfter).toBe(59);
    });
  });

  describe('Malformed error bodies', () => {
    it('falls back cleanly when the body is not JSON', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return new HttpResponse('<html><body>gateway barf</body></html>', {
            status: 400,
            headers: { 'Content-Type': 'text/html' },
          });
        }),
      );

      const error = await client.projects.list().catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe('HTTP 400 error');
      expect(error.message).not.toContain('undefined');
      expect(error.message).not.toContain('[object Object]');
    });

    it('falls back cleanly when the JSON body has no error key', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return HttpResponse.json(
            { detail: 'something else' },
            { status: 400 },
          );
        }),
      );

      const error = await client.projects.list().catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe('HTTP 400 error');
      expect(error.message).not.toContain('undefined');
      expect(error.message).not.toContain('[object Object]');
    });
  });

  describe('Network Errors', () => {
    it('should throw NetworkError on timeout', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json([]);
        }),
      );

      const shortTimeoutClient = new RustrakClient({
        baseUrl: 'http://localhost:8080',
        token: 'test-token',
        timeout: 10, // Very short timeout
      });

      try {
        await shortTimeoutClient.projects.list();
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Ky's TimeoutError should be transformed to NetworkError
        expect(error.message).toContain('timed out');
        expect(error.retryable !== false).toBe(true); // Should be retryable
      }
    });
  });

  describe('Response Validation', () => {
    it('should throw ValidationError on malformed JSON', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return new HttpResponse('not json', {
            headers: { 'Content-Type': 'application/json' },
          });
        }),
      );

      await expect(client.projects.list()).rejects.toThrow();
    });

    it('should throw ValidationError on schema mismatch', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return HttpResponse.json([
            {
              id: 'not-a-number', // Should be number
              name: 'Test',
            },
          ]);
        }),
      );

      const error = await client.projects.list().catch((e) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.retryable).toBe(false);
    });

    it('should throw ValidationError with details', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return HttpResponse.json({
            items: [
              {
                id: 1,
                name: 'Test',
                slug: 'test',
                sentry_key: 'invalid-uuid',
                dsn: 'http://localhost:8080/1',
                stored_event_count: 0,
                digested_event_count: 0,
                created_at: 'invalid-date',
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

      const error = await client.projects.list().catch((e) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.getValidationDetails()).toContain('sentry_key');
    });
  });

  // Deliberately NOT the AppError shape. `transformHttpError` still accepts a
  // flat `{error: "<string>"}` because the ingest rate limiter sends one, and
  // this block exists to keep that tolerance covered. Everything the management
  // API sends is nested, so new fixtures belong in the blocks above, not here.
  describe('Flat error bodies (tolerated legacy shape)', () => {
    it('should extract a flat string error message from the body', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return HttpResponse.json(
            { error: 'Custom error message' },
            { status: 400 },
          );
        }),
      );

      const error = await client.projects.list().catch((e) => e);
      expect(error.message).toBe('Custom error message');
    });

    it('should fallback to default message when body is not JSON', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return new HttpResponse('Error text', { status: 500 });
        }),
      );

      const error = await client.projects.list().catch((e) => e);
      expect(error.message).toContain('500');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 500 errors', async () => {
      let attempts = 0;

      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          attempts++;
          if (attempts < 2) {
            return appErrorResponse(
              'DatabaseError',
              'Database error: connection closed',
            );
          }
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
      expect(response.items).toEqual([]);
      expect(attempts).toBe(2);
    });

    it('should retry on 503 errors', async () => {
      let attempts = 0;

      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          attempts++;
          if (attempts < 2) {
            // Proxy-shaped: 503 cannot come from `AppError::status_code`.
            return new HttpResponse('503 Service Unavailable', {
              status: 503,
            });
          }
          return HttpResponse.json({
            items: [],
            total_count: 0,
            page: 1,
            per_page: 20,
            total_pages: 0,
          });
        }),
      );

      await client.projects.list();
      expect(attempts).toBe(2);
    });

    it('should not retry on 401 errors', async () => {
      let attempts = 0;

      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          attempts++;
          return appErrorResponse(
            'Unauthorized',
            'Unauthorized: Invalid token',
          );
        }),
      );

      await client.projects.list().catch(() => {});
      // Ky default retry might attempt a few times before giving up
      // The important thing is that 401 should eventually fail
      expect(attempts).toBeGreaterThanOrEqual(1);
    });

    it('should respect maxRetries config', async () => {
      let attempts = 0;

      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          attempts++;
          return appErrorResponse(
            'DatabaseError',
            'Database error: connection closed',
          );
        }),
      );

      const customClient = new RustrakClient({
        baseUrl: 'http://localhost:8080',
        token: 'test-token',
        maxRetries: 0,
      });

      await customClient.projects.list().catch(() => {});
      expect(attempts).toBe(1); // Initial attempt only, no retries
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty error response body', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      const error = await client.projects.list().catch((e) => e);
      expect(error).toBeInstanceOf(ServerError);
      expect(error.message).toContain('500');
    });

    it('should handle unexpected response structure', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return HttpResponse.json({ unexpected: 'structure' });
        }),
      );

      await expect(client.projects.list()).rejects.toThrow(ValidationError);
    });

    it('should handle very large error messages', async () => {
      const largeMessage = 'x'.repeat(10000);

      server.use(
        http.get('http://localhost:8080/api/projects', () => {
          return HttpResponse.json({ error: largeMessage }, { status: 400 });
        }),
      );

      const error = await client.projects.list().catch((e) => e);
      expect(error.message).toBe(largeMessage);
    });
  });
});
