/**
 * Where an expression is open in a message-body template.
 *
 * Suggestions only belong between `{{` and `}}`: there the reader is naming a
 * payload field, and everywhere else they are writing JSON, where a list of
 * field names would be noise. Kept as a pure function so the rule is testable
 * without an editor, and so the editor stays a thin shell around it.
 */
export interface OpenExpression {
  /** Document offset where the word being typed starts. */
  from: number;
  /** What has been typed so far, possibly empty. */
  word: string;
}

/** Characters that make up a payload path: `issue.short_id`. */
const PATH_CHARS = /[\w.]/;

export function expressionAt(
  doc: string,
  caret: number,
): OpenExpression | null {
  const open = doc.lastIndexOf('{{', caret);
  if (open === -1) return null;

  // A `}}` between the opener and the caret closes it, so the caret is out.
  const close = doc.indexOf('}}', open);
  if (close !== -1 && close < caret) return null;

  let from = caret;
  while (from > open + 2 && PATH_CHARS.test(doc[from - 1] ?? '')) from--;
  return { from, word: doc.slice(from, caret) };
}
