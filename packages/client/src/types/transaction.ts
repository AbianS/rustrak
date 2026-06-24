import type { z } from 'zod';
import type {
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
 * Aggregate performance stats for one (transaction_name, op) group.
 */
export type TransactionStats = z.infer<typeof transactionStatsSchema>;
