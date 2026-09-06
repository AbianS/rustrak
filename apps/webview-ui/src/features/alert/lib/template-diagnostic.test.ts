import { describe, expect, it } from 'vitest';
import { locateTemplateError } from './template-diagnostic';

const doc = '{\n  "a": 1,\n  "b": 2\n}';

/**
 * The server says where a body stops making sense, in its own words. Turning
 * that into a document offset is what lets the editor underline the spot
 * instead of printing a sentence underneath.
 */
describe('locateTemplateError', () => {
  it('reads the line and column a JSON error reports', () => {
    // Line 2, column 3 is the `"` that opens "a".
    const range = locateTemplateError(
      doc,
      'not valid JSON: bad at line 2 column 3',
    );
    expect(range).toEqual({
      from: doc.indexOf('"a"'),
      to: doc.indexOf('"a"') + 1,
    });
  });

  it('reads the line a template syntax error reports', () => {
    // minijinja points at a line without a column, so the whole line is marked.
    expect(
      locateTemplateError(doc, 'syntax error: unexpected (in body:3)'),
    ).toEqual({
      from: doc.indexOf('  "b"'),
      to: doc.indexOf('  "b"') + '  "b": 2'.length,
    });
  });

  it('marks the whole body when the message says nowhere', () => {
    expect(
      locateTemplateError(doc, 'Template is too complex to render'),
    ).toEqual({
      from: 0,
      to: doc.length,
    });
  });

  it('never points past the end of a body that shrank while typing', () => {
    const range = locateTemplateError('{}', 'bad at line 40 column 9');
    expect(range.from).toBeLessThanOrEqual(2);
    expect(range.to).toBeLessThanOrEqual(2);
    expect(range.from).toBeLessThanOrEqual(range.to);
  });
});
