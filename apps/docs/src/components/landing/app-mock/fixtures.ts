/**
 * Static data for the recreated UI.
 *
 * Shaped like the API payloads the real screens render, not like the minimum a
 * mockup needs: issues carry the status, substatus, priority and trend the list
 * endpoint returns; the volume series is split by severity because the chart
 * stacks it; transactions carry a failure rate because that is what decides
 * whether a latency bar is coloured. Fixtures that match the real shape are
 * what keep the recreated components honest — a component fed a simpler object
 * quietly stops being the same component.
 *
 * Realistic enough to be legible, obviously a sample rather than a claim: the
 * project is `checkout-api`, not a real customer, and the volumes are plausible
 * for one mid-size service.
 */

export type Level = 'fatal' | 'error' | 'warning' | 'info' | 'debug';
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
export type Status = 'unresolved' | 'resolved' | 'ignored';
export type Priority = 'high' | 'medium' | 'low';

export interface MockIssue {
  title: string;
  /** Everything after the `Type: ` prefix — the app shows it as the message. */
  value: string;
  culprit: string;
  level: Level;
  status: Status;
  substatus: string;
  priority: Priority | null;
  platform: string;
  shortId: string;
  events: number;
  users: number;
  age: string;
  lastSeen: string;
  /** 24 hourly buckets, oldest first. Drives the row's trend sparkline. */
  trend: number[];
}

export const ISSUES: MockIssue[] = [
  {
    title: "TypeError: Cannot read property 'id' of undefined",
    value: "Cannot read property 'id' of undefined",
    culprit: 'services/auth_provider in validateSession',
    level: 'error',
    status: 'unresolved',
    substatus: 'Escalating',
    priority: 'high',
    platform: 'node',
    shortId: 'CHECKOUT-4F2',
    events: 12412,
    users: 842,
    age: '6 days',
    lastSeen: '2 minutes ago',
    trend: [
      3, 5, 4, 8, 6, 11, 9, 14, 12, 18, 22, 19, 24, 21, 28, 33, 30, 41, 38, 46,
      52, 49, 61, 74,
    ],
  },
  {
    title: 'PoolTimedOut: connection acquire timeout after 30s',
    value: 'connection acquire timeout after 30s',
    culprit: 'db::pool::acquire',
    level: 'error',
    status: 'unresolved',
    substatus: 'Ongoing',
    priority: 'high',
    platform: 'rust',
    shortId: 'CHECKOUT-3B9',
    events: 3104,
    users: 291,
    age: '11 days',
    lastSeen: '5 minutes ago',
    trend: [
      8, 7, 9, 6, 7, 5, 6, 4, 5, 3, 4, 2, 5, 4, 6, 3, 4, 2, 3, 4, 2, 3, 2, 1,
    ],
  },
  {
    title: 'StripeCardError: Your card was declined',
    value: 'Your card was declined',
    culprit: 'payments/charge in createIntent',
    level: 'warning',
    status: 'unresolved',
    substatus: 'Ongoing',
    priority: 'medium',
    platform: 'node',
    shortId: 'CHECKOUT-2A1',
    events: 1918,
    users: 1204,
    age: '2 months',
    lastSeen: '8 minutes ago',
    trend: [
      5, 6, 5, 7, 6, 6, 7, 6, 8, 7, 7, 8, 6, 7, 7, 6, 8, 7, 6, 7, 8, 7, 6, 7,
    ],
  },
  {
    title: 'UnhandledRejection: fetch failed (ECONNRESET)',
    value: 'fetch failed (ECONNRESET)',
    culprit: 'lib/http in request',
    level: 'error',
    status: 'unresolved',
    substatus: 'New',
    priority: 'medium',
    platform: 'node',
    shortId: 'CHECKOUT-8C4',
    events: 904,
    users: 186,
    age: '9 hours',
    lastSeen: '11 minutes ago',
    trend: [
      0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8,
    ],
  },
  {
    title: 'ValidationError: address.postal_code is required',
    value: 'address.postal_code is required',
    culprit: 'orders/checkout in submit',
    level: 'warning',
    status: 'unresolved',
    substatus: 'Ongoing',
    priority: 'low',
    platform: 'node',
    shortId: 'CHECKOUT-7D0',
    events: 612,
    users: 498,
    age: '3 weeks',
    lastSeen: '14 minutes ago',
    trend: [
      4, 3, 4, 4, 3, 4, 3, 3, 4, 3, 3, 2, 4, 3, 3, 4, 3, 2, 3, 3, 4, 3, 2, 3,
    ],
  },
  {
    title: 'panicked at src/digest/group.rs:118: index out of bounds',
    value: 'index out of bounds: the len is 4 but the index is 7',
    culprit: 'digest::group::fingerprint',
    level: 'fatal',
    status: 'unresolved',
    substatus: 'Regressed',
    priority: 'high',
    platform: 'rust',
    shortId: 'CHECKOUT-1E6',
    events: 148,
    users: 31,
    age: '4 days',
    lastSeen: '17 minutes ago',
    trend: [
      0, 0, 1, 0, 2, 1, 3, 2, 4, 6, 9, 12, 8, 11, 14, 9, 12, 16, 11, 14, 18, 13,
      17, 21,
    ],
  },
];

export interface VolumeBucket {
  /** Hours before now, for the time axis. */
  hoursAgo: number;
  errors: number;
  fatal: number;
  warning: number;
  info: number;
}

/**
 * 24 hourly buckets for the error-volume chart, split the way the endpoint
 * splits them. `fatal` is carried separately but stacks inside `errors`, which
 * is exactly what `ErrorVolumeChart` does.
 */
export const VOLUME: VolumeBucket[] = [
  { hoursAgo: 23, errors: 118, fatal: 2, warning: 44, info: 190 },
  { hoursAgo: 22, errors: 142, fatal: 1, warning: 51, info: 205 },
  { hoursAgo: 21, errors: 126, fatal: 0, warning: 38, info: 181 },
  { hoursAgo: 20, errors: 164, fatal: 3, warning: 62, info: 220 },
  { hoursAgo: 19, errors: 198, fatal: 4, warning: 71, info: 244 },
  { hoursAgo: 18, errors: 176, fatal: 2, warning: 58, info: 231 },
  { hoursAgo: 17, errors: 151, fatal: 1, warning: 49, info: 210 },
  { hoursAgo: 16, errors: 188, fatal: 2, warning: 66, info: 238 },
  { hoursAgo: 15, errors: 264, fatal: 6, warning: 88, info: 271 },
  { hoursAgo: 14, errors: 342, fatal: 9, warning: 104, info: 296 },
  { hoursAgo: 13, errors: 381, fatal: 11, warning: 118, info: 312 },
  { hoursAgo: 12, errors: 364, fatal: 8, warning: 111, info: 305 },
  { hoursAgo: 11, errors: 402, fatal: 12, warning: 126, info: 328 },
  { hoursAgo: 10, errors: 446, fatal: 14, warning: 138, info: 341 },
  { hoursAgo: 9, errors: 414, fatal: 10, warning: 129, info: 334 },
  { hoursAgo: 8, errors: 368, fatal: 7, warning: 116, info: 318 },
  { hoursAgo: 7, errors: 458, fatal: 15, warning: 142, info: 352 },
  { hoursAgo: 6, errors: 552, fatal: 21, warning: 168, info: 379 },
  { hoursAgo: 5, errors: 588, fatal: 24, warning: 176, info: 391 },
  { hoursAgo: 4, errors: 506, fatal: 16, warning: 154, info: 366 },
  { hoursAgo: 3, errors: 432, fatal: 11, warning: 134, info: 344 },
  { hoursAgo: 2, errors: 326, fatal: 6, warning: 102, info: 298 },
  { hoursAgo: 1, errors: 251, fatal: 4, warning: 84, info: 264 },
  { hoursAgo: 0, errors: 208, fatal: 3, warning: 69, info: 241 },
];

export interface SessionBucket {
  hoursAgo: number;
  total: number;
  crashed: number;
}

/** Session volume behind the crash-free rate, same buckets as the volume chart. */
export const SESSIONS: SessionBucket[] = [
  { hoursAgo: 23, total: 2140, crashed: 11 },
  { hoursAgo: 22, total: 2260, crashed: 9 },
  { hoursAgo: 21, total: 2085, crashed: 14 },
  { hoursAgo: 20, total: 2410, crashed: 12 },
  { hoursAgo: 19, total: 2680, crashed: 18 },
  { hoursAgo: 18, total: 2520, crashed: 15 },
  { hoursAgo: 17, total: 2340, crashed: 10 },
  { hoursAgo: 16, total: 2610, crashed: 16 },
  { hoursAgo: 15, total: 2960, crashed: 27 },
  { hoursAgo: 14, total: 3180, crashed: 38 },
  { hoursAgo: 13, total: 3310, crashed: 44 },
  { hoursAgo: 12, total: 3240, crashed: 36 },
  { hoursAgo: 11, total: 3420, crashed: 41 },
  { hoursAgo: 10, total: 3580, crashed: 52 },
  { hoursAgo: 9, total: 3460, crashed: 43 },
  { hoursAgo: 8, total: 3290, crashed: 33 },
  { hoursAgo: 7, total: 3640, crashed: 55 },
  { hoursAgo: 6, total: 3910, crashed: 74 },
  { hoursAgo: 5, total: 4020, crashed: 81 },
  { hoursAgo: 4, total: 3780, crashed: 58 },
  { hoursAgo: 3, total: 3510, crashed: 42 },
  { hoursAgo: 2, total: 3140, crashed: 28 },
  { hoursAgo: 1, total: 2860, crashed: 19 },
  { hoursAgo: 0, total: 2640, crashed: 14 },
];

export interface MockTransaction {
  name: string;
  p95Ms: number;
  failureRate: number;
  count: number;
}

/** Slowest transactions by p95, as the latency tile ranks them. */
export const TRANSACTIONS: MockTransaction[] = [
  { name: 'POST /v1/payments', p95Ms: 1240, failureRate: 0.081, count: 41200 },
  { name: 'POST /v1/orders', p95Ms: 412, failureRate: 0.012, count: 128400 },
  {
    name: 'GET /v1/checkout/:id',
    p95Ms: 246,
    failureRate: 0.061,
    count: 92100,
  },
  { name: 'GET /v1/products', p95Ms: 61, failureRate: 0.002, count: 314000 },
  { name: 'GET /v1/cart/:id', p95Ms: 38, failureRate: 0.001, count: 486000 },
];

export interface MockLog {
  id: string;
  level: LogLevel;
  body: string;
  traceId: string | null;
  timestamp: string;
  severityNumber: number;
  attributes: Array<{ key: string; value: string; type: string }>;
}

/**
 * Age by *row position*, not by log.
 *
 * The tail advances by shifting lines up a slot, so an age carried on the line
 * itself would travel with it and the column would count backwards. Reading it
 * off the position is also what the real column means: row 0 is the newest
 * thing this project has said, whatever that currently is.
 */
export function logAge(row: number): string {
  if (row === 0) return 'just now';
  const seconds = row * 3 + 1;
  return `${seconds} seconds ago`;
}

export const LOGS: MockLog[] = [
  {
    id: 'l1',
    level: 'error',
    body: 'charge failed intent=pi_3Qk order=8814 code=card_declined',
    traceId: '9f58f1872ac04d1e',
    timestamp: 'Jul 24, 2026 at 14:22:07.114',
    severityNumber: 17,
    attributes: [
      { key: 'service.name', value: 'checkout-api', type: 'string' },
      { key: 'http.route', value: '/v1/payments', type: 'string' },
      { key: 'order.id', value: '8814', type: 'int' },
      { key: 'stripe.code', value: 'card_declined', type: 'string' },
    ],
  },
  {
    id: 'l2',
    level: 'warn',
    body: 'pool at 92% capacity (46/50) waiters=7',
    traceId: '4c19b7e0d3f8a215',
    timestamp: 'Jul 24, 2026 at 14:22:06.980',
    severityNumber: 13,
    attributes: [],
  },
  {
    id: 'l3',
    level: 'info',
    body: 'POST /v1/orders 201 in 84ms',
    traceId: '4c19b7e0d3f8a215',
    timestamp: 'Jul 24, 2026 at 14:22:06.451',
    severityNumber: 9,
    attributes: [],
  },
  {
    id: 'l4',
    level: 'error',
    body: "TypeError: cannot read property 'id' of undefined",
    traceId: '9f58f1872ac04d1e',
    timestamp: 'Jul 24, 2026 at 14:22:05.902',
    severityNumber: 17,
    attributes: [],
  },
  {
    id: 'l5',
    level: 'info',
    body: 'job settled id=4c19 attempts=1 duration=212ms',
    traceId: null,
    timestamp: 'Jul 24, 2026 at 14:22:05.338',
    severityNumber: 9,
    attributes: [],
  },
  {
    id: 'l6',
    level: 'debug',
    body: 'miss key=cart:8814 ttl=300',
    traceId: 'a71c04e9b8253df6',
    timestamp: 'Jul 24, 2026 at 14:22:04.771',
    severityNumber: 5,
    attributes: [],
  },
  {
    id: 'l7',
    level: 'info',
    body: 'GET /v1/cart/8814 200 in 11ms',
    traceId: 'a71c04e9b8253df6',
    timestamp: 'Jul 24, 2026 at 14:22:04.190',
    severityNumber: 9,
    attributes: [],
  },
  {
    id: 'l8',
    level: 'trace',
    body: 'span end name=db.query rows=1 duration=2.4ms',
    traceId: 'a71c04e9b8253df6',
    timestamp: 'Jul 24, 2026 at 14:22:03.612',
    severityNumber: 1,
    attributes: [],
  },
  // The pool past the first screenful. The tail cycles through all of it, so
  // the stream keeps saying something new instead of looping four lines.
  {
    id: 'l9',
    level: 'warn',
    body: 'retrying webhook delivery attempt=2 endpoint=/hooks/orders',
    traceId: 'e2f9a83b71c045d0',
    timestamp: 'Jul 24, 2026 at 14:22:03.104',
    severityNumber: 13,
    attributes: [],
  },
  {
    id: 'l10',
    level: 'info',
    body: 'GET /v1/products?cursor=8f2a 200 in 27ms',
    traceId: 'e2f9a83b71c045d0',
    timestamp: 'Jul 24, 2026 at 14:22:02.559',
    severityNumber: 9,
    attributes: [],
  },
  {
    id: 'l11',
    level: 'fatal',
    body: 'digest worker panicked, restarting supervisor tree',
    traceId: '61b0d7f42e98a3c5',
    timestamp: 'Jul 24, 2026 at 14:22:02.011',
    severityNumber: 21,
    attributes: [],
  },
  {
    id: 'l12',
    level: 'debug',
    body: 'envelope accepted items=2 size=4.1kb project=1',
    traceId: '61b0d7f42e98a3c5',
    timestamp: 'Jul 24, 2026 at 14:22:01.480',
    severityNumber: 5,
    attributes: [],
  },
  {
    id: 'l13',
    level: 'info',
    body: 'POST /v1/payments 402 in 231ms',
    traceId: '9f58f1872ac04d1e',
    timestamp: 'Jul 24, 2026 at 14:22:00.902',
    severityNumber: 9,
    attributes: [],
  },
  {
    id: 'l14',
    level: 'trace',
    body: 'span end name=http.client status=200 duration=18.7ms',
    traceId: 'a71c04e9b8253df6',
    timestamp: 'Jul 24, 2026 at 14:22:00.338',
    severityNumber: 1,
    attributes: [],
  },
];

/** `gen_ai.operation.type`, which is what colours a row in the waterfall. */
export type OperationType = 'agent' | 'ai_client' | 'tool' | 'handoff';

export interface MockSpan {
  id: string;
  operation: OperationType;
  /** The row's label: agent name, tool name or response model. */
  label: string;
  op: string;
  depth: number;
  /** Milliseconds from the start of the trace. */
  startMs: number;
  durationMs: number;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** One agent run, as `listSpans({ trace_id })` returns it. */
export const SPANS: MockSpan[] = [
  {
    id: 'a1',
    operation: 'agent',
    label: 'support-triage-agent',
    op: 'gen_ai.invoke_agent',
    depth: 0,
    startMs: 0,
    durationMs: 8420,
    status: 'ok',
    inputTokens: null,
    outputTokens: null,
  },
  {
    id: 'a2',
    operation: 'ai_client',
    label: 'claude-opus-4-8',
    op: 'gen_ai.chat',
    depth: 1,
    startMs: 168,
    durationMs: 2610,
    status: 'ok',
    inputTokens: 18240,
    outputTokens: 1412,
  },
  {
    id: 'a3',
    operation: 'tool',
    label: 'search_docs',
    op: 'gen_ai.execute_tool',
    depth: 1,
    startMs: 2862,
    durationMs: 1020,
    status: 'ok',
    inputTokens: null,
    outputTokens: null,
  },
  {
    id: 'a4',
    operation: 'tool',
    label: 'run_query',
    op: 'gen_ai.execute_tool',
    depth: 1,
    startMs: 3948,
    durationMs: 1850,
    status: 'internal_error',
    inputTokens: null,
    outputTokens: null,
  },
  {
    id: 'a5',
    operation: 'ai_client',
    label: 'claude-opus-4-8',
    op: 'gen_ai.chat',
    depth: 1,
    startMs: 5892,
    durationMs: 2280,
    status: 'ok',
    inputTokens: 21460,
    outputTokens: 918,
  },
  {
    id: 'a6',
    operation: 'handoff',
    label: 'billing-agent',
    op: 'gen_ai.handoff',
    depth: 1,
    startMs: 8210,
    durationMs: 190,
    status: 'ok',
    inputTokens: null,
    outputTokens: null,
  },
];

export interface MockRelease {
  version: string;
  environment: string;
  /** Sessions recorded against this release in the window. */
  sessions: number;
  /** 0-1, as the API returns it. */
  crashFreeSessions: number;
  crashFreeUsers: number;
  crashed: number;
  /** Issues first seen in this release. Not on the list endpoint; shown here
      because it is the number that makes a release row worth reading. */
  newIssues: number;
  age: string;
}

/**
 * Ordered newest first, as the real list is, and deliberately not all healthy:
 * a release table where every row is green is a table with nothing to say. The
 * regression in 2.13.0 is what makes the crash-free colour tiers legible, and
 * it is the reason the row above it exists to be compared against.
 */
export const RELEASES: MockRelease[] = [
  {
    version: '2.14.0',
    environment: 'production',
    sessions: 73986,
    crashFreeSessions: 0.9947,
    crashFreeUsers: 0.9971,
    crashed: 392,
    newIssues: 3,
    age: '2 hours ago',
  },
  {
    version: '2.13.2',
    environment: 'production',
    sessions: 128401,
    crashFreeSessions: 0.9962,
    crashFreeUsers: 0.9984,
    crashed: 488,
    newIssues: 1,
    age: '3 days ago',
  },
  {
    version: '2.13.0',
    environment: 'production',
    sessions: 96220,
    crashFreeSessions: 0.9418,
    crashFreeUsers: 0.9605,
    crashed: 5601,
    newIssues: 12,
    age: '6 days ago',
  },
  {
    version: '2.12.4',
    environment: 'staging',
    sessions: 4108,
    crashFreeSessions: 0.9989,
    crashFreeUsers: 0.9994,
    crashed: 4,
    newIssues: 0,
    age: '9 days ago',
  },
  {
    version: '2.12.3',
    environment: 'production',
    sessions: 141902,
    crashFreeSessions: 0.9974,
    crashFreeUsers: 0.9988,
    crashed: 369,
    newIssues: 2,
    age: '14 days ago',
  },
];

/**
 * A span in a web transaction's waterfall, flattened.
 *
 * The real `SpanWaterfall` takes raw Sentry spans (`start_timestamp`,
 * `timestamp`, `parent_span_id`) and does the tree building, the flattening and
 * the self-time arithmetic itself. None of that is worth recreating for a fixed
 * fixture that is never collapsed and never reordered, so the tree is authored
 * already flat and already measured. What is kept is every field the row
 * actually *draws*, because those are what the reader is looking at.
 */
export interface MockTxnSpan {
  id: string;
  /** Sentry `op`, which is what picks the bar colour. */
  op: string;
  description: string;
  depth: number;
  /** Milliseconds from the start of the transaction. */
  startMs: number;
  durationMs: number;
  /** Own time, minus direct children. `null` for a leaf, where it equals the duration. */
  selfMs: number | null;
  status: string;
}

/**
 * `POST /v1/payments`, the transaction the performance chapter opens on.
 *
 * Chosen because the shape carries the argument on its own: two sequential
 * database calls, a third-party HTTP call that costs more than everything else
 * put together, and a cache read that returns a miss. A reader who has ever
 * opened a slow endpoint recognises the picture before reading a single label,
 * which is the only reason to show a waterfall rather than a number.
 *
 * The gap between the Stripe call ending and the last insert starting is
 * deliberate and load bearing: a waterfall with no gaps is a stacked bar chart
 * wearing a costume, and the gaps are where the reader learns that these are
 * real timings rather than a decorative gradient.
 */
export const TXN_SPANS: MockTxnSpan[] = [
  {
    id: 't1',
    op: 'http.server',
    description: 'POST /v1/payments',
    depth: 0,
    startMs: 0,
    durationMs: 1242,
    selfMs: 38,
    status: 'ok',
  },
  {
    id: 't2',
    op: 'db.sql.query',
    description: 'SELECT * FROM orders WHERE id = $1',
    depth: 1,
    startMs: 14,
    durationMs: 62,
    selfMs: null,
    status: 'ok',
  },
  {
    id: 't3',
    op: 'cache.get',
    description: 'payment_intent:ord_8f21c4',
    depth: 1,
    startMs: 82,
    durationMs: 9,
    selfMs: null,
    status: 'not_found',
  },
  {
    id: 't4',
    op: 'http.client',
    description: 'POST api.stripe.com/v1/payment_intents',
    depth: 1,
    startMs: 96,
    durationMs: 903,
    selfMs: 41,
    status: 'ok',
  },
  {
    id: 't5',
    op: 'http.client',
    description: 'GET api.stripe.com/v1/customers/cus_Qk2',
    depth: 2,
    startMs: 118,
    durationMs: 214,
    selfMs: null,
    status: 'ok',
  },
  {
    id: 't6',
    op: 'http.client',
    description: 'POST api.stripe.com/v1/confirm',
    depth: 2,
    startMs: 348,
    durationMs: 648,
    selfMs: null,
    status: 'ok',
  },
  {
    id: 't7',
    op: 'db.sql.query',
    description: 'INSERT INTO payments (order_id, amount, ...)',
    depth: 1,
    startMs: 1042,
    durationMs: 118,
    selfMs: null,
    status: 'ok',
  },
  {
    id: 't8',
    op: 'db.sql.query',
    description: 'UPDATE orders SET status = $1 WHERE id = $2',
    depth: 1,
    startMs: 1168,
    durationMs: 54,
    selfMs: null,
    status: 'ok',
  },
  {
    id: 't9',
    op: 'resource.script',
    description: 'emit order.paid',
    depth: 1,
    startMs: 1226,
    durationMs: 12,
    selfMs: null,
    status: 'ok',
  },
];
