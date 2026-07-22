'use server';

import type {
  ListTransactionsOptions,
  OffsetPaginatedResponse,
  Span,
  Transaction,
  TransactionDetail,
  TransactionStats,
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

export async function getTransactionStats(
  projectId: number,
  options?: { page?: number; per_page?: number },
): Promise<OffsetPaginatedResponse<TransactionStats>> {
  const client = await createClient();
  return client.transactions.getStats(projectId, options);
}

export async function getTransactionSpans(
  projectId: number,
  transactionId: string,
): Promise<Span[]> {
  const client = await createClient();
  return client.transactions.getSpans(projectId, transactionId);
}

export async function getTransactionStatForGroup(
  projectId: number,
  name: string,
  op?: string,
): Promise<TransactionStats | null> {
  const client = await createClient();
  // A group with no transactions returns 404 — treat as "no metrics".
  return client.transactions
    .getStatForGroup(projectId, name, op)
    .catch(() => null);
}
