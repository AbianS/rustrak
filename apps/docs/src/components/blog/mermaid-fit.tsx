'use client';

import { useEffect } from 'react';

/**
 * Gives every rendered Mermaid diagram its natural size back.
 *
 * Mermaid ships with `useMaxWidth` on, which means the `<svg>` it produces
 * carries `width="100%"` and an inline `max-width` holding the size it was
 * actually laid out for. In a reading column that is a quiet disaster: the
 * `flowchart LR` in the pipeline post is 1530px wide by design and was being
 * drawn at 732px, so every label in it rendered at half size — smaller than
 * the footnotes, and past the point where the diagram says anything.
 *
 * CSS alone cannot undo it. `width: auto` on a replaced element with a view
 * box and no intrinsic dimensions resolves to "fill the container", which is
 * the behaviour being escaped, and the real size is only knowable from the
 * view box — so the fix has to read the DOM.
 *
 * What it does is set the width and height the view box declares. The figure
 * around it scrolls (see `.blog-prose` in `globals.css`), so a wide diagram is
 * panned at full size rather than shrunk to fit, and a diagram that already
 * fits is untouched by the change.
 */
export function MermaidFit({ bodyId }: { bodyId: string }) {
  useEffect(() => {
    const body = document.getElementById(bodyId);
    if (!body) return;

    const fit = () => {
      const diagrams = body.querySelectorAll<SVGSVGElement>(
        'svg[aria-roledescription]:not([data-fitted])',
      );
      for (const svg of diagrams) {
        const box = svg.viewBox?.baseVal;
        if (!box?.width || !box.height) continue;
        // The flag is load-bearing, not bookkeeping: writing these styles is
        // itself a mutation, and without it the observer below would call this
        // again for the same element, forever.
        svg.dataset.fitted = 'true';
        svg.style.width = `${box.width}px`;
        svg.style.height = `${box.height}px`;
        svg.style.maxWidth = 'none';
      }
    };

    fit();

    // Mermaid renders in an effect of its own, after loading its bundle, so
    // the diagrams are not in the tree when this first runs.
    const observer = new MutationObserver(fit);
    observer.observe(body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [bodyId]);

  return null;
}
