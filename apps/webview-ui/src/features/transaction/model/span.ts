/**
 * The spans embedded in a transaction event's payload.
 *
 * **Not the same type as `Span` from `@rustrak/client`**, despite the name, and
 * the difference is why this one is declared rather than imported. The client's
 * `Span` is a row of the `spans` table, ingested through the span protocol and
 * carrying `gen_ai_*` fields; `features/agent-trace` reads those. This one is
 * the `spans` array inside a transaction event's own JSON, which arrives with
 * the event and is never a row of anything.
 *
 * Two features therefore speak of "spans" and mean different things, which is
 * exactly the case that would look like a reason to reach sideways. It is not:
 * neither slice imports the other, and neither type belongs in `shared`.
 *
 * Every field is optional because SDKs omit most of them. A minimal legal span
 * is `{ span_id, start_timestamp, timestamp }`. The transaction payload reader
 * normalizes timestamps from either epoch numbers or RFC3339 strings before
 * this type reaches the UI.
 */
export interface Span {
  span_id?: string;
  parent_span_id?: string;
  op?: string;
  description?: string;
  status?: string;
  start_timestamp?: number;
  timestamp?: number;
  exclusive_time?: number;
}

/** The `trace` entry of an event's `contexts`, describing the root span. */
export interface TraceContext {
  span_id?: string;
  op?: string;
  status?: string;
  description?: string;
}
