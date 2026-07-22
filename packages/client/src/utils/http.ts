import ky, { type HTTPError, isHTTPError, type KyInstance } from 'ky';
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

function transformHttpError(error: HTTPError): RustrakError {
  const { response } = error;
  const status = response.status;

  let errorMessage = `HTTP ${status} error`;
  // Two shapes are live: most handlers send `{error: {type, message}}` while
  // the 429 path sends a flat `{error: "..."}`. Reading only the flat one
  // turned every structured error into "[object Object]". See #204.
  const body = error.data as {
    error?: string | { type?: string; message?: string };
    message?: string;
  } | null;
  if (body) {
    const nested =
      typeof body.error === 'object' ? body.error?.message : body.error;
    errorMessage = nested || body.message || errorMessage;
  }

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

export function createKyInstance(config: ClientConfig): KyInstance {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.headers,
  };

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  return ky.create({
    prefix: config.baseUrl,
    timeout: config.timeout ?? 30000,
    credentials: 'include',
    retry: {
      limit: config.maxRetries ?? 2,
      statusCodes: [408, 500, 502, 503, 504],
      methods: ['get', 'post', 'put', 'patch', 'delete'],
    },
    headers,
    hooks: {
      beforeError: [
        ({ error }) => {
          if (error.name === 'TimeoutError') {
            throw new NetworkError('Request timed out', error);
          }

          if (isHTTPError(error)) {
            throw transformHttpError(error);
          }

          throw new NetworkError(error.message, error);
        },
      ],
    },
  });
}
