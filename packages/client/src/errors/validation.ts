import type { ZodError } from 'zod';
import { RustrakError } from './base.js';

/**
 * Validation error when API response doesn't match expected schema
 * Not retryable - indicates API contract mismatch
 */
export class ValidationError extends RustrakError {
  /**
   * Zod validation errors
   */
  public readonly validationErrors?: ZodError;

  constructor(message: string, validationErrors?: ZodError) {
    super(message, { retryable: false });
    this.validationErrors = validationErrors;
  }

  /**
   * Get a formatted string of validation errors
   */
  public getValidationDetails(): string {
    if (!this.validationErrors) {
      return this.message;
    }

    const errors = this.validationErrors.issues
      .map((err) => `${err.path.map(String).join('.')}: ${err.message}`)
      .join(', ');

    return `${this.message} - ${errors}`;
  }
}
