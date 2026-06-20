import type { z } from 'zod';
import type {
  transactionDetailSchema,
  transactionSchema,
} from '../schemas/transaction.js';

/**
 * Transaction type inferred from Zod schema
 */
export type Transaction = z.infer<typeof transactionSchema>;

/**
 * Transaction detail type (summary fields + full Sentry payload under `data`)
 */
export type TransactionDetail = z.infer<typeof transactionDetailSchema>;
