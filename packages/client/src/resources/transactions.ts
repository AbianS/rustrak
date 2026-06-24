import { z } from 'zod';
import {
  offsetPaginatedResponseSchema,
  spanSchema,
  transactionDetailSchema,
  transactionSchema,
  transactionStatsSchema,
} from '../schemas/index.js';
import type {
  ListTransactionsOptions,
  OffsetPaginatedResponse,
  Span,
  Transaction,
  TransactionDetail,
  TransactionStats,
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
    if (options?.name) {
      searchParams.name = options.name;
    }
    if (options?.op) {
      searchParams.op = options.op;
    }
    if (options?.status) {
      searchParams.status = options.status;
    }
    if (options?.environment) {
      searchParams.environment = options.environment;
    }
    if (options?.release) {
      searchParams.release = options.release;
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
   * Get the indexed spans extracted from a transaction, in waterfall order.
   */
  async getSpans(projectId: number, transactionId: string): Promise<Span[]> {
    const data = await this.http
      .get(`api/projects/${projectId}/transactions/${transactionId}/spans`)
      .json();

    return this.validate(data, z.array(spanSchema));
  }

  /**
   * Get aggregate performance stats (count, p50/p95/p99 latency, failure rate)
   * grouped by transaction name + op, most frequent first, with offset-based
   * pagination — same shape as the other list endpoints.
   */
  async getStats(
    projectId: number,
    options?: { page?: number; per_page?: number },
  ): Promise<OffsetPaginatedResponse<TransactionStats>> {
    const searchParams: Record<string, string> = {};
    if (options?.page) {
      searchParams.page = String(options.page);
    }
    if (options?.per_page) {
      searchParams.per_page = String(options.per_page);
    }

    const data = await this.http
      .get(`api/projects/${projectId}/transactions/stats`, { searchParams })
      .json();

    return this.validate(
      data,
      offsetPaginatedResponseSchema(transactionStatsSchema),
    );
  }

  /**
   * Get aggregate stats for a single (transaction name, op) group — a direct
   * lookup that works regardless of how many groups the project has. Throws
   * NotFoundError when the group has no transactions.
   */
  async getStatForGroup(
    projectId: number,
    name: string,
    op?: string,
  ): Promise<TransactionStats> {
    const searchParams: Record<string, string> = { name };
    if (op) {
      searchParams.op = op;
    }

    const data = await this.http
      .get(`api/projects/${projectId}/transactions/stats/group`, {
        searchParams,
      })
      .json();

    return this.validate(data, transactionStatsSchema);
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
