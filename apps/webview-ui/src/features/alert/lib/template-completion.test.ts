import { describe, expect, it } from 'vitest';
import { expressionAt } from './template-completion';

/**
 * Autocomplete only makes sense inside an expression: between `{{` and `}}`
 * the reader is naming a payload field, everywhere else they are writing JSON
 * and a list of field names would be noise.
 */
describe('expressionAt', () => {
  const doc = '{"a": {{ issue.ti }}, "b": 1}';

  it('finds the word being typed inside an expression', () => {
    // Caret right after "issue.ti".
    expect(expressionAt(doc, doc.indexOf(' }}'))).toEqual({
      from: doc.indexOf('issue.ti'),
      word: 'issue.ti',
    });
  });

  it('offers nothing outside an expression', () => {
    expect(expressionAt(doc, 3)).toBeNull();
    expect(expressionAt(doc, doc.length - 1)).toBeNull();
  });

  it('offers everything at an empty expression', () => {
    const empty = '{"a": {{  }}}';
    const caret = empty.indexOf('{{') + 3;
    expect(expressionAt(empty, caret)).toEqual({ from: caret, word: '' });
  });

  it('stops at the closing braces rather than running to the end', () => {
    // A caret past `}}` is outside, even though a `{{` exists earlier.
    const after = '{{ issue.title }} trailing';
    expect(expressionAt(after, after.length)).toBeNull();
  });

  it('treats an unclosed expression as open, since it is still being typed', () => {
    const typing = '{"a": {{ issue.ti';
    expect(expressionAt(typing, typing.length)).toEqual({
      from: typing.indexOf('issue.ti'),
      word: 'issue.ti',
    });
  });
});
