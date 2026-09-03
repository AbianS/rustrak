import type { TransactionDetail } from '@rustrak/client';
import { describe, expect, it } from 'vitest';
import { readTransactionPayload } from './transaction-payload';

function txn(over: Partial<TransactionDetail> = {}): TransactionDetail {
  return {
    id: 't1',
    transaction_name: 'GET /',
    duration_ms: 12,
    timestamp: '2026-01-01T00:00:10.000Z',
    start_timestamp: '2026-01-01T00:00:00.000Z',
    data: {},
    ...over,
  } as unknown as TransactionDetail;
}

describe('readTransactionPayload', () => {
  it('reads the trace context, its op and its status', () => {
    const payload = readTransactionPayload(
      txn({
        data: { contexts: { trace: { op: 'http.server', status: 'ok' } } },
      }),
    );

    expect(payload.op).toBe('http.server');
    expect(payload.status).toBe('ok');
    expect(payload.trace).toEqual({ op: 'http.server', status: 'ok' });
  });

  it('ignores an op or status that is not a string', () => {
    const payload = readTransactionPayload(
      txn({ data: { contexts: { trace: { op: 7, status: null } } } }),
    );

    expect(payload.op).toBeUndefined();
    expect(payload.status).toBeUndefined();
  });

  it('treats a missing trace context as absent rather than empty', () => {
    expect(readTransactionPayload(txn()).trace).toBeUndefined();
  });

  it('rejects an array where an object is expected', () => {
    // `typeof [] === 'object'`, so a payload with `tags: []` would otherwise
    // render an empty key/value panel instead of nothing.
    expect(readTransactionPayload(txn({ data: { tags: [] } })).tags).toBeNull();
  });

  it('reads spans only when the payload holds a list', () => {
    expect(
      readTransactionPayload(txn({ data: { spans: [{}, {}] } })).spans,
    ).toHaveLength(2);
    expect(
      readTransactionPayload(txn({ data: { spans: 'nope' } })).spans,
    ).toEqual([]);
  });

  it('normalizes mixed numeric and RFC3339 span timestamps', () => {
    const payload = readTransactionPayload(
      txn({
        data: {
          spans: [
            {
              span_id: 's1',
              start_timestamp: 1000,
              timestamp: '1970-01-01T00:16:42.000Z',
            },
          ],
        },
      }),
    );

    expect(payload.spans).toEqual([
      {
        span_id: 's1',
        start_timestamp: 1000,
        timestamp: 1002,
      },
    ]);
  });

  it('drops invalid span timestamps instead of exposing NaN arithmetic', () => {
    const payload = readTransactionPayload(
      txn({
        data: {
          spans: [
            {
              span_id: 's1',
              start_timestamp: Number.NaN,
              timestamp: 'not-a-timestamp',
            },
          ],
        },
      }),
    );

    expect(payload.spans).toEqual([
      {
        span_id: 's1',
        start_timestamp: undefined,
        timestamp: undefined,
      },
    ]);
  });

  it('prefers the payload epoch seconds over the row timestamps', () => {
    const payload = readTransactionPayload(
      txn({ data: { start_timestamp: 1000, timestamp: 1002 } }),
    );

    expect(payload.transactionStart).toBe(1000);
    expect(payload.transactionEnd).toBe(1002);
  });

  it('falls back to the row timestamps when the payload has none', () => {
    // The SDK sends epoch seconds; the row stores ISO. The waterfall's clock
    // is in seconds, so a fallback has to be converted, not passed through.
    const payload = readTransactionPayload(txn());

    expect(payload.transactionStart).toBe(
      Date.parse('2026-01-01T00:00:00.000Z') / 1000,
    );
    expect(payload.transactionEnd).toBe(
      Date.parse('2026-01-01T00:00:10.000Z') / 1000,
    );
  });

  it('falls back to the end timestamp when the row has no start', () => {
    const payload = readTransactionPayload(txn({ start_timestamp: null }));

    expect(payload.transactionStart).toBe(
      Date.parse('2026-01-01T00:00:10.000Z') / 1000,
    );
  });
});
