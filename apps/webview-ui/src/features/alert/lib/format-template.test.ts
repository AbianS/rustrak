import { describe, expect, it } from 'vitest';
import { formatTemplate } from './format-template';

/**
 * The body is JSON with expressions in it, so `JSON.parse` cannot see it. The
 * formatter parks every `{{ … }}` behind a token, formats the JSON that is
 * left, and puts the expressions back where they were.
 */
describe('formatTemplate', () => {
  it('indents a one-line body', () => {
    expect(formatTemplate('{"a":1,"b":{"c":2}}')).toBe(
      '{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}',
    );
  });

  it('keeps an expression standing in a value position', () => {
    expect(formatTemplate('{"text":{{ issue.title | tojson }}}')).toBe(
      '{\n  "text": {{ issue.title | tojson }}\n}',
    );
  });

  it('keeps an expression embedded inside a string', () => {
    expect(formatTemplate('{"text":"Alert: {{ issue.title }}"}')).toBe(
      '{\n  "text": "Alert: {{ issue.title }}"\n}',
    );
  });

  it('keeps several expressions apart and in order', () => {
    expect(formatTemplate('{"a":{{ x }},"b":"{{ y }} and {{ z }}"}')).toBe(
      '{\n  "a": {{ x }},\n  "b": "{{ y }} and {{ z }}"\n}',
    );
  });

  it('leaves a body it cannot parse exactly as it was', () => {
    // Half-typed bodies are the normal state of a field being edited; the
    // button must never eat someone's work to punish them for that.
    const halfWritten = '{"a": ';
    expect(formatTemplate(halfWritten)).toBe(halfWritten);
    expect(formatTemplate('')).toBe('');
  });

  it('does not mistake braces inside a string for an expression', () => {
    expect(formatTemplate('{"a":"literal {{ not an expr"}')).toBe(
      '{\n  "a": "literal {{ not an expr"\n}',
    );
  });
});
