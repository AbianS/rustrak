import type { z } from 'zod';
import type {
  spanDetailSchema,
  spanSchema,
  transactionDetailSchema,
  transactionSchema,
  transactionStatsSchema,
} from '../schemas/transaction.js';

/**
 * Transaction type inferred from Zod schema
 */
export type Transaction = z.infer<typeof transactionSchema>;

/**
 * Transaction detail type (summary fields + full Sentry payload under `data`)
 */
export type TransactionDetail = z.infer<typeof transactionDetailSchema>;

/**
 * A single indexed span extracted from a transaction.
 */
export type Span = z.infer<typeof spanSchema>;

/**
 * A span plus its raw attribute bag — what `spans.get()` returns. The list
 * shape (`Span`) deliberately carries no attributes.
 */
export type SpanDetail = z.infer<typeof spanDetailSchema>;

/**
 * Aggregate performance stats for one (transaction_name, op) group.
 */
export type TransactionStats = z.infer<typeof transactionStatsSchema>;

/**
 * Options for listing spans (offset-based pagination + filters). Matches
 * spans regardless of origin (standalone or transaction-embedded), since
 * both share the same table.
 */
export interface ListSpansOptions {
  page?: number;
  per_page?: number;
  op?: string;
  status?: string;
  trace_id?: string;
  /** Filter by gen_ai.operation.type (`agent`/`tool`/`handoff`/`ai_client`). */
  operation_type?: string;
}
