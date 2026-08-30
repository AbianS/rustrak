/**
 * The credential fields the user actually filled in.
 *
 * Every integration dialog reads a blank input as "leave the stored value
 * alone" rather than "clear it". The server never returns a Slack bot token or
 * an SMTP password, so those fields start empty on edit and staying empty is
 * the absence of new information, not an instruction: posting `''` would
 * overwrite a working secret with nothing.
 *
 * Whitespace counts as blank. A token of three spaces is a paste that went
 * wrong in every case these forms have, and the server rejects it anyway.
 *
 * Only strings are judged. `0` and `false` are answers, and an SMTP port of
 * zero has to reach the server so it can say what is wrong with it.
 */
export function filledCredentials(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const filled: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (value == null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    filled[key] = value;
  }

  return filled;
}
