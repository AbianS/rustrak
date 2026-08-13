import { describe, expect, it } from 'vitest';
import {
  aiInput,
  aiOutput,
  availableTools,
  hasTokenMismatch,
  tokenBreakdown,
} from './gen-ai';

describe('tokenBreakdown', () => {
  it('reads cached input tokens under the current attribute name', () => {
    // Relay emits `gen_ai.usage.cache_read.input_tokens` at c455da18 —
    // the `.cached` suffix spelling is gone from its normalization.
    const breakdown = tokenBreakdown({
      'gen_ai.usage.input_tokens': 1000,
      'gen_ai.usage.cache_read.input_tokens': 400,
      'gen_ai.usage.output_tokens': 200,
      'gen_ai.usage.total_tokens': 1200,
    });

    expect(breakdown).not.toBeNull();
    expect(breakdown?.cached).toBe(400);
    expect(breakdown?.netNewInput).toBe(600);
  });

  it('falls back to the retired spelling for older data', () => {
    // Spans ingested before Relay renamed the attribute still carry
    // `gen_ai.usage.input_tokens.cached`. Sentry's frontend reads both.
    const breakdown = tokenBreakdown({
      'gen_ai.usage.input_tokens': 1000,
      'gen_ai.usage.input_tokens.cached': 400,
      'gen_ai.usage.output_tokens': 200,
      'gen_ai.usage.total_tokens': 1200,
    });

    expect(breakdown?.cached).toBe(400);
    expect(breakdown?.netNewInput).toBe(600);
  });

  it('is null when the span reports no usage at all', () => {
    // A tool or handoff span is not a failed LLM call — the caller needs to
    // tell "not an LLM call" from "an LLM call that used zero tokens".
    expect(tokenBreakdown({ 'gen_ai.tool.name': 'search' })).toBeNull();
  });
});

describe('aiInput', () => {
  it('prefers gen_ai.input.messages over every older attribute', () => {
    // Sentry's documented priority: gen_ai.input.messages >
    // gen_ai.request.messages > ai.input_messages > ai.prompt. A span
    // instrumented across an SDK upgrade can carry several at once.
    const input = aiInput({
      'gen_ai.input.messages': '[{"role":"user","content":"new"}]',
      'gen_ai.request.messages': '[{"role":"user","content":"old"}]',
      'ai.prompt': 'oldest',
    });

    expect(input?.messages).toBe('[{"role":"user","content":"new"}]');
  });

  it('falls back down the chain when the preferred attribute is absent', () => {
    expect(aiInput({ 'ai.prompt': 'oldest' })?.messages).toBe('oldest');
  });

  it('carries system instructions separately from the messages', () => {
    // Sentry prepends them to the rendered conversation, but they are a
    // distinct attribute and a reader needs to see which is which.
    const input = aiInput({
      'gen_ai.input.messages': '[{"role":"user","content":"hi"}]',
      'gen_ai.system_instructions': 'You are terse.',
    });

    expect(input?.systemInstructions).toBe('You are terse.');
  });

  it('reads a tool call’s arguments as its input', () => {
    // A tool span has no messages at all — its input is the call arguments.
    const input = aiInput({
      'gen_ai.tool.name': 'search',
      'gen_ai.tool.call.arguments': '{"query":"weather"}',
    });

    expect(input?.messages).toBe('{"query":"weather"}');
  });

  it('is null when the span carries no input of any kind', () => {
    expect(aiInput({ 'gen_ai.operation.type': 'handoff' })).toBeNull();
  });
});

describe('aiOutput', () => {
  it('prefers gen_ai.output.messages over gen_ai.response.text', () => {
    expect(
      aiOutput({
        'gen_ai.output.messages': '[{"role":"assistant","content":"new"}]',
        'gen_ai.response.text': 'old',
      })?.text,
    ).toBe('[{"role":"assistant","content":"new"}]');
  });

  it('reads a tool call’s result as its output', () => {
    expect(
      aiOutput({
        'gen_ai.tool.name': 'search',
        'gen_ai.tool.call.result': '{"temp":21}',
      })?.text,
    ).toBe('{"temp":21}');
  });

  it('surfaces requested tool calls even with no text response', () => {
    // The interesting output of a planning step is often *which tools it
    // decided to call*, with no prose at all.
    const output = aiOutput({
      'gen_ai.response.tool_calls': '[{"name":"search"}]',
    });

    expect(output?.toolCalls).toBe('[{"name":"search"}]');
    expect(output?.text).toBeNull();
  });

  it('is null when the span produced nothing', () => {
    expect(aiOutput({ 'gen_ai.operation.type': 'handoff' })).toBeNull();
  });
});

describe('availableTools', () => {
  it('parses the tool definitions an agent span was given', () => {
    expect(
      availableTools({
        'gen_ai.tool.definitions': '[{"name":"search"},{"name":"calculator"}]',
      }),
    ).toEqual(['search', 'calculator']);
  });

  it('falls back to the request-scoped attribute', () => {
    expect(
      availableTools({
        'gen_ai.request.available_tools': '[{"name":"search"}]',
      }),
    ).toEqual(['search']);
  });

  it('is null rather than throwing on a malformed value', () => {
    // These arrive as SDK-serialized JSON strings; a truncated one must not
    // take the whole details panel down.
    expect(
      availableTools({ 'gen_ai.tool.definitions': '[{"name":' }),
    ).toBeNull();
  });
});

describe('tokenBreakdown, against providers that disagree with the convention', () => {
  it('treats input as exclusive of cached when that is what makes the total add up', () => {
    // OTel says input INCLUDES cached. This provider reports them separately:
    // 600 + 400 + 200 = 1200 = total. Subtracting cached from input would
    // show 200 net-new and lose 400 tokens the user was billed for.
    const breakdown = tokenBreakdown({
      'gen_ai.usage.input_tokens': 600,
      'gen_ai.usage.cache_read.input_tokens': 400,
      'gen_ai.usage.output_tokens': 200,
      'gen_ai.usage.total_tokens': 1200,
    });

    expect(breakdown?.netNewInput).toBe(600);
    expect(breakdown?.cached).toBe(400);
  });

  it('still subtracts cached when input is reported inclusive of it', () => {
    // 1000 + 200 = 1200 = total, so input already contains the 400 cached.
    const breakdown = tokenBreakdown({
      'gen_ai.usage.input_tokens': 1000,
      'gen_ai.usage.cache_read.input_tokens': 400,
      'gen_ai.usage.output_tokens': 200,
      'gen_ai.usage.total_tokens': 1200,
    });

    expect(breakdown?.netNewInput).toBe(600);
  });

  it('applies the same reasoning to reasoning tokens inside output', () => {
    // 500 + 200 + 300 = 1000 = total: output is exclusive of reasoning here.
    const breakdown = tokenBreakdown({
      'gen_ai.usage.input_tokens': 500,
      'gen_ai.usage.output_tokens': 200,
      'gen_ai.usage.reasoning.output_tokens': 300,
      'gen_ai.usage.total_tokens': 1000,
    });

    expect(breakdown?.output).toBe(500);
  });
});

describe('hasTokenMismatch', () => {
  it('is false when the parts add up', () => {
    expect(
      hasTokenMismatch({
        'gen_ai.usage.input_tokens': 1000,
        'gen_ai.usage.output_tokens': 200,
        'gen_ai.usage.total_tokens': 1200,
      }),
    ).toBe(false);
  });

  it('is true when the parts do not add up to the reported total', () => {
    // Broken instrumentation: the sum is 1200 but the SDK claims 5000. Worth
    // saying so — a reader comparing token counts across spans would
    // otherwise trust a number nothing supports.
    expect(
      hasTokenMismatch({
        'gen_ai.usage.input_tokens': 1000,
        'gen_ai.usage.output_tokens': 200,
        'gen_ai.usage.total_tokens': 5000,
      }),
    ).toBe(true);
  });

  it('is true for a negative count', () => {
    expect(
      hasTokenMismatch({
        'gen_ai.usage.input_tokens': -5,
        'gen_ai.usage.output_tokens': 200,
        'gen_ai.usage.total_tokens': 195,
      }),
    ).toBe(true);
  });

  it('tolerates rounding within one percent', () => {
    // Providers round. A 1% band is Sentry's own tolerance and stops the
    // warning firing on every large span.
    expect(
      hasTokenMismatch({
        'gen_ai.usage.input_tokens': 10000,
        'gen_ai.usage.output_tokens': 2000,
        'gen_ai.usage.total_tokens': 12050,
      }),
    ).toBe(false);
  });

  it('is false when the span reports no usage at all', () => {
    // A tool span is not broken instrumentation.
    expect(hasTokenMismatch({ 'gen_ai.tool.name': 'search' })).toBe(false);
  });
});
