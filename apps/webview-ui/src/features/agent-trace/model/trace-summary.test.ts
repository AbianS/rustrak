import type { Span } from '@rustrak/client';
import { describe, expect, it } from 'vitest';
import { resolveSelectedSpan, summarizeTrace } from './trace-summary';

function span(over: Partial<Span> & { id: string }): Span {
  return {
    gen_ai_operation_type: null,
    gen_ai_agent_name: null,
    gen_ai_request_model: null,
    gen_ai_response_model: null,
    gen_ai_usage_total_tokens: null,
    start_timestamp: null,
    timestamp: null,
    status: null,
    ...over,
  } as unknown as Span;
}

describe('summarizeTrace', () => {
  it('spans the whole trace, earliest start to latest end', () => {
    const summary = summarizeTrace([
      span({
        id: 'a',
        start_timestamp: '2026-01-01T00:00:00.000Z',
        timestamp: '2026-01-01T00:00:01.000Z',
      }),
      span({
        id: 'b',
        start_timestamp: '2026-01-01T00:00:00.500Z',
        timestamp: '2026-01-01T00:00:03.000Z',
      }),
    ]);

    expect(summary.duration).toBe(3000);
    expect(summary.startedAt).toBe(Date.parse('2026-01-01T00:00:00.000Z'));
  });

  it('has no duration when nothing carries a timestamp', () => {
    const summary = summarizeTrace([span({ id: 'a' })]);

    expect(summary.duration).toBeNull();
    expect(summary.startedAt).toBeNull();
  });

  /**
   * The one rule here that is not arithmetic. An agent span reports the total
   * for everything under it, so counting it alongside its children bills the
   * same tokens twice. The Traces list query excludes them for the same reason.
   */
  it('excludes agent spans from the token total', () => {
    const summary = summarizeTrace([
      span({
        id: 'agent',
        gen_ai_operation_type: 'agent',
        gen_ai_usage_total_tokens: 300,
      }),
      span({
        id: 'llm',
        gen_ai_operation_type: 'ai_client',
        gen_ai_usage_total_tokens: 200,
      }),
      span({
        id: 'tool',
        gen_ai_operation_type: 'tool',
        gen_ai_usage_total_tokens: 100,
      }),
    ]);

    expect(summary.totalTokens).toBe(300);
  });

  it('counts calls by operation type', () => {
    const summary = summarizeTrace([
      span({ id: '1', gen_ai_operation_type: 'ai_client' }),
      span({ id: '2', gen_ai_operation_type: 'ai_client' }),
      span({ id: '3', gen_ai_operation_type: 'tool' }),
    ]);

    expect(summary.llmCallCount).toBe(2);
    expect(summary.toolCallCount).toBe(1);
  });

  it('counts any status that is not ok as an error, but not a missing one', () => {
    const summary = summarizeTrace([
      span({ id: '1', status: 'ok' }),
      span({ id: '2', status: 'internal_error' }),
      span({ id: '3', status: null }),
    ]);

    expect(summary.errorCount).toBe(1);
  });

  it('takes the agent name from whichever span reports one', () => {
    const summary = summarizeTrace([
      span({ id: '1' }),
      span({ id: '2', gen_ai_agent_name: 'researcher' }),
    ]);

    expect(summary.agentName).toBe('researcher');
  });

  it('names the requested model when a failed call reported no response one', () => {
    // A call that threw has no response model but still names what it tried.
    const summary = summarizeTrace([
      span({ id: '1', gen_ai_request_model: 'claude-opus-4' }),
    ]);

    expect(summary.models).toEqual(['claude-opus-4']);
  });

  it('prefers the response model and lists each one once', () => {
    const summary = summarizeTrace([
      span({
        id: '1',
        gen_ai_request_model: 'asked-for',
        gen_ai_response_model: 'answered-with',
      }),
      span({ id: '2', gen_ai_response_model: 'answered-with' }),
    ]);

    expect(summary.models).toEqual(['answered-with']);
  });
});

describe('resolveSelectedSpan', () => {
  const spans = [
    span({ id: 'a', gen_ai_operation_type: 'ai_client' }),
    span({ id: 'b' }),
  ];

  it('honours a requested span that belongs to this trace', () => {
    expect(resolveSelectedSpan(spans, 'b')).toEqual({
      selectedSpanId: 'b',
      requestedMissing: false,
    });
  });

  /**
   * `getSpan` is scoped to the project, not the trace, so without this a span
   * from another trace would render beside this one's waterfall: the URL and
   * the panel describing different things.
   */
  it('refuses a span from another trace and says it is missing', () => {
    expect(resolveSelectedSpan(spans, 'elsewhere')).toEqual({
      selectedSpanId: undefined,
      requestedMissing: true,
    });
  });

  it('opens the default span when none was requested', () => {
    expect(resolveSelectedSpan(spans, undefined)).toEqual({
      selectedSpanId: 'a',
      requestedMissing: false,
    });
  });

  it('selects nothing for an empty trace', () => {
    expect(resolveSelectedSpan([], undefined)).toEqual({
      selectedSpanId: undefined,
      requestedMissing: false,
    });
  });
});
