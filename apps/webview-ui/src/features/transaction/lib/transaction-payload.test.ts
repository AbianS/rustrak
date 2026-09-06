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

  // Captured from sentry-types 0.49.2, which serializes a span's two ends with
  // different encodings: ts_seconds_float and ts_rfc3339_opt.
  it('reads a real Rust-SDK span into arithmetic that yields a duration', () => {
    const payload = readTransactionPayload(
      txn({
        timestamp: '2025-09-04T15:33:20.800Z',
        start_timestamp: '2025-09-04T15:33:20.500Z',
        data: {
          start_timestamp: 1757000000.5,
          timestamp: '2025-09-04T15:33:20.8Z',
          spans: [
            {
              op: 'db.sql.query',
              span_id: 'f796eed91584d618',
              start_timestamp: 1757000000.5,
              timestamp: '2025-09-04T15:33:20.8Z',
              trace_id: 'db542d8976bbdc31d5940a8bfe604128',
            },
          ],
        },
      }),
    );

    const [span] = payload.spans;
    const durationMs =
      ((span.timestamp as number) - (span.start_timestamp as number)) * 1000;

    expect(durationMs).toBeCloseTo(300, 3);
    // Math.max over a string is NaN, which takes the whole waterfall window.
    expect(
      Math.max(payload.transactionStart, span.timestamp as number),
    ).not.toBeNaN();
  });

  it('reads a span timestamp with no offset as UTC, the way Relay does', () => {
    const [span] = readTransactionPayload(
      txn({
        data: {
          spans: [
            {
              span_id: 's1',
              start_timestamp: 1757000000.5,
              timestamp: '2025-09-04T15:33:20.8',
            },
          ],
        },
      }),
    ).spans;

    expect(span.timestamp).toBeCloseTo(1757000000.8, 3);
  });

  it('rejects date strings Relay would not have accepted', () => {
    const [span] = readTransactionPayload(
      txn({
        data: {
          spans: [
            // Date.parse turns both of these into a finite epoch.
            { span_id: 's1', start_timestamp: '2025/09/04', timestamp: '0' },
          ],
        },
      }),
    ).spans;

    expect(span.start_timestamp).toBeUndefined();
    expect(span.timestamp).toBeUndefined();
  });

  it('keeps microsecond precision so a sub-ms span is not negative', () => {
    // Both ends are the same instant; the SDK just encodes them differently.
    const [span] = readTransactionPayload(
      txn({
        data: {
          spans: [
            {
              span_id: 's1',
              start_timestamp: 1757000000.123456,
              timestamp: '2025-09-04T15:33:20.123456Z',
            },
          ],
        },
      }),
    ).spans;

    expect(span.timestamp).toBe(1757000000.123456);
    expect(
      ((span.timestamp as number) - (span.start_timestamp as number)) * 1000,
    ).toBe(0);
  });

  it('rejects calendar-impossible dates instead of rolling them forward', () => {
    const [span] = readTransactionPayload(
      txn({
        data: {
          spans: [
            {
              span_id: 's1',
              // Date.parse turns these into March 2nd and March 1st.
              start_timestamp: '2025-02-30T00:00:00Z',
              timestamp: '2025-02-29T00:00:00Z',
            },
          ],
        },
      }),
    ).spans;

    expect(span.start_timestamp).toBeUndefined();
    expect(span.timestamp).toBeUndefined();
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
