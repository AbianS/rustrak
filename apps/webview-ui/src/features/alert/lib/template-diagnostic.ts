/** A document range, as CodeMirror's lint expects one. */
export interface TemplateErrorRange {
  from: number;
  to: number;
}

/**
 * Where in the body an error message is pointing.
 *
 * The server reports a refusal in its own words, and the two engines behind it
 * word it differently: `serde_json` gives a line and a column, minijinja gives
 * a line alone. Turning either into an offset is what lets the editor underline
 * the spot the way an editor does, rather than printing a sentence underneath
 * the field and leaving the reader to count lines.
 *
 * A message that points nowhere marks the whole body: something is wrong with
 * it and we cannot say where, which is still worth showing.
 */
export function locateTemplateError(
  doc: string,
  message: string,
): TemplateErrorRange {
  const whole = { from: 0, to: doc.length };

  const jsonAt = message.match(/line (\d+) column (\d+)/);
  if (jsonAt) {
    return characterAt(doc, Number(jsonAt[1]), Number(jsonAt[2]));
  }

  const templateAt = message.match(/\bbody:(\d+)/);
  if (templateAt) return wholeLine(doc, Number(templateAt[1]));

  return whole;
}

/** Offset of the start of `line`, or `null` when the body is shorter. */
function lineStart(doc: string, line: number): number | null {
  let offset = 0;
  for (let current = 1; current < line; current++) {
    const next = doc.indexOf('\n', offset);
    if (next === -1) return null;
    offset = next + 1;
  }
  return offset <= doc.length ? offset : null;
}

function wholeLine(doc: string, line: number): TemplateErrorRange {
  const from = lineStart(doc, line);
  if (from === null) return { from: doc.length, to: doc.length };
  const newline = doc.indexOf('\n', from);
  return { from, to: newline === -1 ? doc.length : newline };
}

function characterAt(
  doc: string,
  line: number,
  column: number,
): TemplateErrorRange {
  const start = lineStart(doc, line);
  if (start === null) return { from: doc.length, to: doc.length };
  // Columns are 1-based and point at the offending character.
  const from = Math.min(start + Math.max(column - 1, 0), doc.length);
  return { from, to: Math.min(from + 1, doc.length) };
}
