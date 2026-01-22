import { RustrakError } from './base.js';

/**
 * Network error (connection issues, timeouts)
 * Retryable by default
 */
export class NetworkError extends RustrakError {
  constructor(message: string, cause?: Error) {
    super(message, { retryable: true, cause });
  }
}

/**
 * Authentication error (401 Unauthorized)
 * Not retryable - requires new credentials
 */
export class AuthenticationError extends RustrakError {
  constructor(message = 'Authentication failed') {
    super(message, { retryable: false, statusCode: 401 });
  }
}

/**
 * Authorization error (403 Forbidden)
 * Not retryable - requires different permissions
 */
export class AuthorizationError extends RustrakError {
  constructor(message = 'Insufficient permissions') {
    super(message, { retryable: false, statusCode: 403 });
  }
}

/**
 * Not found error (404 Not Found)
 * Not retryable
 */
export class NotFoundError extends RustrakError {
  constructor(resource: string) {
    super(`Resource not found: ${resource}`, {
      retryable: false,
      statusCode: 404,
    });
  }
}

/**
 * Rate limit error (429 Too Many Requests)
 * Retryable after delay
 */
export class RateLimitError extends RustrakError {
  /**
   * Number of seconds to wait before retrying (from Retry-After header)
   */
  public readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: string | number) {
    super(message, { retryable: true, statusCode: 429 });

    if (retryAfter !== undefined) {
      this.retryAfter =
        typeof retryAfter === 'string' ? parseInt(retryAfter, 10) : retryAfter;
    }
  }
}

/**
 * Server error (500+)
 * Retryable by default
 */
export class ServerError extends RustrakError {
  constructor(message: string, statusCode = 500) {
    super(message, { retryable: true, statusCode });
  }
}

/**
 * Bad request error (400)
 * Not retryable - client error
 */
export class BadRequestError extends RustrakError {
  constructor(message: string) {
    super(message, { retryable: false, statusCode: 400 });
  }
}
