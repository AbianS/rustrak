import ky, { type HTTPError, type KyInstance } from 'ky';
import type { ClientConfig } from '../config.js';
import {
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  RustrakError,
  ServerError,
} from '../errors/index.js';

/**
 * Transform ky HTTPError to custom RustrakError
 */
async function transformHttpError(error: HTTPError): Promise<RustrakError> {
  const { response } = error;
  const status = response.status;

  // Try to extract error message from response body
  let errorMessage = `HTTP ${status} error`;
  try {
    const body = (await response.json()) as {
      error?: string;
      message?: string;
    };
    errorMessage = body.error || body.message || errorMessage;
  } catch {
    // Unable to parse body, use default message
  }

  // Map status codes to specific error types
  switch (status) {
    case 400:
      return new BadRequestError(errorMessage);
    case 401:
      return new AuthenticationError(errorMessage);
    case 403:
      return new AuthorizationError(errorMessage);
    case 404:
      return new NotFoundError(errorMessage);
    case 429: {
      const retryAfter = response.headers.get('Retry-After');
      return new RateLimitError(errorMessage, retryAfter ?? undefined);
    }
    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(errorMessage, status);
    default:
      return new RustrakError(errorMessage, { statusCode: status });
  }
}

/**
 * Create a configured ky instance with hooks and retry logic
 */
export function createKyInstance(config: ClientConfig): KyInstance {
  // Build headers object, only including Authorization if token is provided
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.headers,
  };

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  return ky.create({
    prefixUrl: config.baseUrl,
    timeout: config.timeout ?? 30000,
    // Enable credentials to send cookies with requests (for session auth)
    credentials: 'include',
    retry: {
      limit: config.maxRetries ?? 2,
      statusCodes: [408, 429, 500, 502, 503, 504],
      methods: ['get', 'post', 'put', 'patch', 'delete'],
    },
    headers,
    hooks: {
      beforeError: [
        async (error) => {
          // Transform network errors
          if (error.name === 'TimeoutError') {
            throw new NetworkError('Request timed out', error);
          }

          // Transform HTTP errors
          if (error.response) {
            const rustrakError = await transformHttpError(error);
            throw rustrakError;
          }

          // Generic network error
          throw new NetworkError(error.message, error);
        },
      ],
    },
  });
}
