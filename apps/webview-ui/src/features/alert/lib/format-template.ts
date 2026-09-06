/**
 * Indents a message body the way anyone would write JSON by hand.
 *
 * The body is JSON with template expressions in it, so `JSON.parse` cannot
 * read it directly: `{"text":{{ issue.title }}}` is not JSON until it renders.
 * So every `{{ … }}` is parked behind a token first, the JSON that remains is
 * formatted, and the expressions go back where they were.
 *
 * A body it cannot parse comes back untouched. Half-written is the normal
 * state of a field somebody is editing, and a formatter that eats your work to
 * punish you for that is worse than no formatter.
 */
export function formatTemplate(template: string): string {
  const { parked, expressions } = parkExpressions(template);

  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(parked), null, 2);
  } catch {
    return template;
  }

  return expressions.reduce(
    (text, expression, index) =>
      text
        .replace(`"${token(index)}"`, expression)
        .replace(token(index), expression),
    formatted,
  );
}

const token = (index: number) => `__rustrak_expr_${index}__`;

/**
 * Replaces every `{{ … }}` with a token, leaving parseable JSON behind.
 *
 * A token has to survive in both places an expression can appear, and those
 * need different shapes: standing where a value goes it must be a JSON value
 * of its own, and inside a string it is already surrounded by the quotes it
 * needs. Which one applies is decided by tracking whether the scan is inside a
 * string literal, which is also what keeps a `{{` typed inside quoted prose
 * from being read as an expression at all.
 */
function parkExpressions(template: string): {
  parked: string;
  expressions: string[];
} {
  const expressions: string[] = [];
  let parked = '';
  let inString = false;

  for (let i = 0; i < template.length; i++) {
    const char = template[i] as string;

    if (inString && char === '\\') {
      parked += char + (template[i + 1] ?? '');
      i++;
      continue;
    }
    if (char === '"') inString = !inString;

    const end =
      char === '{' && template[i + 1] === '{'
        ? template.indexOf('}}', i + 2)
        : -1;
    if (end === -1) {
      parked += char;
      continue;
    }

    parked += inString
      ? token(expressions.length)
      : `"${token(expressions.length)}"`;
    expressions.push(template.slice(i, end + 2));
    i = end + 1;
  }

  return { parked, expressions };
}
