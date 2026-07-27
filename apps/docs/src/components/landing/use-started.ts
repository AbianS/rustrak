'use client';

import { useEffect, useState } from 'react';

/**
 * False on the server and for the first client frame, true from then on.
 *
 * The one clock everything on the landing that enters is sequenced from. A
 * state flip rather than a bare `true` because that is what makes the server
 * render the resting state — the copy is in the HTML for a reader without
 * JavaScript, and the animations begin when there is a client alive to run them
 * rather than being half over by the time the page is interactive.
 */
export function useStarted(): boolean {
  const [started, setStarted] = useState(false);
  useEffect(() => setStarted(true), []);
  return started;
}
