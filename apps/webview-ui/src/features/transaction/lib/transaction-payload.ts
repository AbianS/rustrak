import type { TransactionDetail } from '@rustrak/client';
import type { Span, TraceContext } from '@/features/transaction/model/span';

function asObject(value: unknown): Record<string, unknown> | null {
  // `typeof [] === 'object'`, and a list is never one of the key/value panels
  // this reads, so an array is not an object here.
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** The grammar Relay accepts for a timestamp string, and no more. */
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/;

/** February 30th is a date `Date.parse` rolls into March and chrono rejects. */
function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * A moment on the waterfall's clock, which counts seconds.
 *
 * No offset means UTC, as it does in Relay. `Date.parse` would read it as the
 * reader's local time and place the same span differently in every timezone.
 *
 * The fraction is added back by hand because `Date.parse` truncates it to
 * milliseconds, and the SDK sends microseconds: against a full-precision
 * `start_timestamp` float that truncation renders sub-millisecond spans with a
 * negative duration.
 */
function parseEpochSeconds(raw: unknown): number | undefined {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : undefined;
  }
  if (typeof raw !== 'string') return undefined;

  const match = ISO_DATE_TIME.exec(raw);
  if (!match) return undefined;

  const [, year, month, day, time, fraction, offset] = match;
  if (!isRealCalendarDate(Number(year), Number(month), Number(day))) {
    return undefined;
  }

  const milliseconds = Date.parse(
    `${year}-${month}-${day}T${time}${offset ?? 'Z'}`,
  );
  if (!Number.isFinite(milliseconds)) return undefined;

  return milliseconds / 1000 + (fraction ? Number(`0.${fraction}`) : 0);
}

/**
 * A moment on the waterfall's clock, which counts seconds.
 *
 * The SDK sends epoch seconds inside the payload; the row stores ISO strings.
 * The fallback has to be converted rather than passed through, or every bar
 * would be placed a thousand times too far along.
 */
function epochSeconds(raw: unknown, fallbackIso: string): number {
  return parseEpochSeconds(raw) ?? Date.parse(fallbackIso) / 1000;
}

/**
 * Normalizes timestamps on a transaction-embedded span to epoch seconds.
 *
 * Sentry SDKs may encode protocol timestamps as either epoch numbers or
 * RFC3339 strings. Keeping that distinction out of the waterfall prevents
 * arithmetic on a string from producing `NaN` durations and geometry.
 */
function readSpan(raw: unknown): Span | null {
  const span = asObject(raw);
  if (!span) return null;

  return {
    ...span,
    start_timestamp: parseEpochSeconds(span.start_timestamp),
    timestamp: parseEpochSeconds(span.timestamp),
  } as Span;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Everything the transaction detail page reads out of the stored payload. */
export interface TransactionPayload {
  trace: TraceContext | undefined;
  spans: Span[];
  measurements: Record<string, unknown> | null;
  tags: Record<string, unknown> | null;
  request: Record<string, unknown> | null;
  user: Record<string, unknown> | null;
  /** Epoch seconds, the left edge of the waterfall. */
  transactionStart: number;
  /** Epoch seconds, its right edge. */
  transactionEnd: number;
  op: string | undefined;
  status: string | undefined;
}

/**
 * The stored event payload, narrowed into the shapes the page renders.
 *
 * `data` is whatever the SDK sent, so every read here is a question about an
 * `unknown`. Doing it once, in one place, is what keeps those questions out of
 * the page and provable on their own.
 */
export function readTransactionPayload(
  txn: TransactionDetail,
): TransactionPayload {
  const data = (txn.data ?? {}) as Record<string, unknown>;
  const trace = asObject(asObject(data.contexts)?.trace) ?? undefined;

  return {
    trace: trace as TraceContext | undefined,
    spans: Array.isArray(data.spans)
      ? data.spans.flatMap((span) => {
          const normalized = readSpan(span);
          return normalized ? [normalized] : [];
        })
      : [],
    measurements: asObject(data.measurements),
    tags: asObject(data.tags),
    request: asObject(data.request),
    user: asObject(data.user),

    transactionStart: epochSeconds(
      data.start_timestamp,
      txn.start_timestamp ?? txn.timestamp,
    ),
    transactionEnd: epochSeconds(data.timestamp, txn.timestamp),

    op: asString(trace?.op),
    status: asString(trace?.status),
  };
}
