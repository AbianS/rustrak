'use client';

import { useEffect, useState } from 'react';

/**
 * False on the server and for the first client frame, true from then on.
 *
 * This replaces the gate the opening animation used to provide. Everything on
 * the landing that enters — the headline, the nav, the product panel, the
 * painting resolving out of noise — used to wait on the intro finishing, both
 * so the timings could be sequenced from one clock and so nothing played out
 * behind an opaque overlay.
 *
 * With the intro gone the sequencing still matters, so the gate stays; it just
 * opens at mount instead. Keeping it a state flip rather than a bare `true`
 * preserves the other thing it was doing: the server renders the resting state,
 * so the copy is present in the HTML for a reader without JavaScript, and the
 * animations begin when there is a client alive to run them rather than being
 * half over by the time the page is interactive.
 */
export function useStarted(): boolean {
  const [started, setStarted] = useState(false);
  useEffect(() => setStarted(true), []);
  return started;
}
