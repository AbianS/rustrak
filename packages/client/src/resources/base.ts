import type { KyInstance } from 'ky';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../errors/index.js';

/**
 * Base resource class with validation helper
 */
export abstract class BaseResource {
  protected readonly http: KyInstance;

  constructor(http: KyInstance) {
    this.http = http;
  }

  /**
   * Validate API response against Zod schema
   * @throws {ValidationError} if validation fails
   */
  protected validate<T>(data: unknown, schema: ZodSchema<T>): T {
    const result = schema.safeParse(data);

    if (!result.success) {
      throw new ValidationError('API response validation failed', result.error);
    }

    return result.data;
  }
}
