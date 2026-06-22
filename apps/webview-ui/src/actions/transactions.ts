'use server';

import type {
  ListTransactionsOptions,
  OffsetPaginatedResponse,
  Transaction,
  TransactionDetail,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

export async function listTransactions(
  projectId: number,
  options?: ListTransactionsOptions,
): Promise<OffsetPaginatedResponse<Transaction>> {
  const client = await createClient();
  return client.transactions.list(projectId, options);
}

export async function getTransaction(
  projectId: number,
  transactionId: string,
): Promise<TransactionDetail> {
  const client = await createClient();
  return client.transactions.get(projectId, transactionId);
}
