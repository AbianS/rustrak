import type { z } from 'zod';
import type { transactionSchema } from '../schemas/transaction.js';

/**
 * Transaction type inferred from Zod schema
 */
export type Transaction = z.infer<typeof transactionSchema>;
