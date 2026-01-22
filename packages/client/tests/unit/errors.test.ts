import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  RustrakError,
  ServerError,
  ValidationError,
} from '../../src/errors/index.js';

describe('Error Classes', () => {
  describe('RustrakError', () => {
    it('should create base error with message', () => {
      const error = new RustrakError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('RustrakError');
      expect(error.retryable).toBe(false);
      expect(error.statusCode).toBeUndefined();
    });

    it('should support retryable flag', () => {
      const error = new RustrakError('Test error', { retryable: true });

      expect(error.retryable).toBe(true);
    });

    it('should support status code', () => {
      const error = new RustrakError('Test error', { statusCode: 500 });

      expect(error.statusCode).toBe(500);
    });

    it('should support cause', () => {
      const cause = new Error('Original error');
      const error = new RustrakError('Test error', { cause });

      expect(error.cause).toBe(cause);
    });

    it('should be instance of Error', () => {
      const error = new RustrakError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RustrakError);
    });
  });

  describe('NetworkError', () => {
    it('should be retryable by default', () => {
      const error = new NetworkError('Connection failed');

      expect(error.retryable).toBe(true);
      expect(error.name).toBe('NetworkError');
    });

    it('should support cause', () => {
      const cause = new Error('ECONNREFUSED');
      const error = new NetworkError('Connection failed', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('AuthenticationError', () => {
    it('should not be retryable', () => {
      const error = new AuthenticationError();

      expect(error.retryable).toBe(false);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Authentication failed');
    });

    it('should support custom message', () => {
      const error = new AuthenticationError('Invalid token');

      expect(error.message).toBe('Invalid token');
    });
  });

  describe('AuthorizationError', () => {
    it('should not be retryable', () => {
      const error = new AuthorizationError();

      expect(error.retryable).toBe(false);
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Insufficient permissions');
    });
  });

  describe('NotFoundError', () => {
    it('should include resource in message', () => {
      const error = new NotFoundError('Project');

      expect(error.message).toBe('Resource not found: Project');
      expect(error.retryable).toBe(false);
      expect(error.statusCode).toBe(404);
    });
  });

  describe('RateLimitError', () => {
    it('should be retryable', () => {
      const error = new RateLimitError();

      expect(error.retryable).toBe(true);
      expect(error.statusCode).toBe(429);
      expect(error.message).toBe('Rate limit exceeded');
    });

    it('should parse string retry-after header', () => {
      const error = new RateLimitError('Rate limited', '60');

      expect(error.retryAfter).toBe(60);
    });

    it('should accept numeric retry-after', () => {
      const error = new RateLimitError('Rate limited', 120);

      expect(error.retryAfter).toBe(120);
    });

    it('should handle missing retry-after', () => {
      const error = new RateLimitError();

      expect(error.retryAfter).toBeUndefined();
    });
  });

  describe('ServerError', () => {
    it('should be retryable with 500 status by default', () => {
      const error = new ServerError('Internal server error');

      expect(error.retryable).toBe(true);
      expect(error.statusCode).toBe(500);
    });

    it('should support custom status code', () => {
      const error = new ServerError('Bad Gateway', 502);

      expect(error.statusCode).toBe(502);
    });
  });

  describe('BadRequestError', () => {
    it('should not be retryable', () => {
      const error = new BadRequestError('Invalid input');

      expect(error.retryable).toBe(false);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('ValidationError', () => {
    it('should create error without validation details', () => {
      const error = new ValidationError('Validation failed');

      expect(error.message).toBe('Validation failed');
      expect(error.retryable).toBe(false);
      expect(error.validationErrors).toBeUndefined();
    });

    it('should store Zod validation errors', () => {
      // Create a real Zod validation error
      const schema = z.object({ name: z.string() });
      const result = schema.safeParse({ name: 123 });

      if (!result.success) {
        const error = new ValidationError('Validation failed', result.error);
        expect(error.validationErrors).toBeDefined();
        expect(error.validationErrors?.issues.length).toBeGreaterThan(0);
      }
    });

    it('should format validation details', () => {
      // Create a real Zod validation error with multiple fields
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const result = schema.safeParse({ name: 123, age: 'not a number' });

      if (!result.success) {
        const error = new ValidationError('Validation failed', result.error);
        const details = error.getValidationDetails();

        expect(details).toContain('name');
        expect(details).toContain('age');
        expect(details).toContain('Validation failed');
      }
    });

    it('should return message when no validation errors', () => {
      const error = new ValidationError('Validation failed');
      const details = error.getValidationDetails();

      expect(details).toBe('Validation failed');
    });
  });
});
