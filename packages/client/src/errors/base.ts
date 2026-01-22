/**
 * Base error class for all Rustrak client errors
 */
export class RustrakError extends Error {
  /**
   * Whether this error is safe to retry
   */
  public readonly retryable: boolean;

  /**
   * HTTP status code if applicable
   */
  public readonly statusCode?: number;

  /**
   * Original error cause
   */
  public readonly cause?: Error;

  constructor(
    message: string,
    options?: {
      retryable?: boolean;
      statusCode?: number;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.retryable = options?.retryable ?? false;
    this.statusCode = options?.statusCode;
    this.cause = options?.cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
