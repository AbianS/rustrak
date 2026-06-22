import {
  offsetPaginatedResponseSchema,
  transactionDetailSchema,
  transactionSchema,
} from '../schemas/index.js';
import type {
  ListTransactionsOptions,
  OffsetPaginatedResponse,
  Transaction,
  TransactionDetail,
} from '../types/index.js';
import { BaseResource } from './base.js';

/**
 * Transactions API resource
 */
export class TransactionsResource extends BaseResource {
  /**
   * List transactions for a project with offset-based pagination (newest first)
   */
  async list(
    projectId: number,
    options?: ListTransactionsOptions,
  ): Promise<OffsetPaginatedResponse<Transaction>> {
    const searchParams: Record<string, string> = {};

    if (options?.page) {
      searchParams.page = String(options.page);
    }
    if (options?.per_page) {
      searchParams.per_page = String(options.per_page);
    }

    const data = await this.http
      .get(`api/projects/${projectId}/transactions`, {
        searchParams,
      })
      .json();

    return this.validate(
      data,
      offsetPaginatedResponseSchema(transactionSchema),
    );
  }

  /**
   * Get a single transaction by ID with its full Sentry payload (spans,
   * contexts.trace, measurements, tags) for the performance detail view.
   */
  async get(
    projectId: number,
    transactionId: string,
  ): Promise<TransactionDetail> {
    const data = await this.http
      .get(`api/projects/${projectId}/transactions/${transactionId}`)
      .json();

    return this.validate(data, transactionDetailSchema);
  }
}
