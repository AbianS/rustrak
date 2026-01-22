/**
 * Configuration options for RustrakClient
 */
export interface ClientConfig {
  /**
   * Base URL of the Rustrak API server
   * Example: 'http://localhost:8080' or 'https://rustrak.example.com'
   */
  baseUrl: string;

  /**
   * Authentication token (Bearer token)
   * Optional - use this for API token authentication,
   * or omit to use session-based authentication (cookies)
   */
  token?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Maximum number of retry attempts for retryable errors
   * @default 2
   */
  maxRetries?: number;

  /**
   * Custom headers to include in all requests
   */
  headers?: Record<string, string>;
}
