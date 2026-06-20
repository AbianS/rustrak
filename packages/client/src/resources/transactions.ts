import {
  paginatedResponseSchema,
  transactionSchema,
} from '../schemas/index.js';
import type {
  ListTransactionsOptions,
  PaginatedResponse,
  Transaction,
} from '../types/index.js';
import { BaseResource } from './base.js';

/**
 * Transactions API resource
 */
export class TransactionsResource extends BaseResource {
  /**
   * List transactions for a project with cursor-based pagination (newest first)
   */
  async list(
    projectId: number,
    options?: ListTransactionsOptions,
  ): Promise<PaginatedResponse<Transaction>> {
    const searchParams: Record<string, string> = {};

    if (options?.cursor) {
      searchParams.cursor = options.cursor;
    }

    const data = await this.http
      .get(`api/projects/${projectId}/transactions`, {
        searchParams,
      })
      .json();

    return this.validate(data, paginatedResponseSchema(transactionSchema));
  }
}
