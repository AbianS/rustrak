'use client';

import { type RefObject, useEffect, useState } from 'react';

/**
 * Which release the reader is currently inside, and whether the pinned strip
 * should be showing.
 *
 * ── Why a thin band and not the viewport ───────────────────────────────────
 *
 * A release entry runs several screens deep, so at any moment most of the
 * viewport belongs to one of them and "the most visible article" is a tie
 * between whichever two happen to share the fold. The marker would sit on the
 * wrong release for half of every scroll. What is wanted is the release under
 * the top edge of the reading area, and a 5%-tall observation band just below
 * the navbar selects exactly that, because only one article can cross a line.
 *
 * ── Why the sentinel gets its own observer ─────────────────────────────────
 *
 * It was in the one above, sharing the band, and that was a bug rather than an
 * economy. An `IntersectionObserver` only calls back when an element *crosses*
 * a boundary, and the boundary is the root rect after `rootMargin`, not the
 * viewport. So the sentinel's last callback fired as it left the band's top
 * edge, 15% of the way down the screen, and the test it was being put through
 * ("is it above the viewport?") was false at exactly the moment it was asked.
 * Nothing crossed anything after that, so no further callback ever came and the
 * strip never appeared at all.
 *
 * Two observers, each with the boundary it actually cares about, and each
 * comparing against `rootBounds` rather than against zero, which is the same
 * mistake stated in general form, since `rootBounds` *is* where the crossing
 * happens.
 */

/**
 * The strip's own height, so the crossing boundary can be its bottom edge.
 *
 * Hardcoded rather than measured: the strip is `position: fixed` and hidden
 * when this matters, so reading its box would mean measuring an element that is
 * deliberately not participating in layout, and a `ResizeObserver` for a bar of
 * fixed content is more machinery than a number. It is a readout line, an 18px
 * band and its padding. See `release-spectrum.tsx`. Being a few pixels out
 * moves when the strip appears by a few pixels and nothing else.
 */
const STRIP_HEIGHT = 55;

function navbarHeight(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    '--nextra-navbar-height',
  );
  return Number.parseFloat(raw) || 64;
}

export function useActiveRelease(
  sentinelRef: RefObject<HTMLElement | null>,
  /** Re-runs the observation when the set of rendered articles changes. */
  count: number,
  initialAnchor: string | null,
) {
  const [activeAnchor, setActiveAnchor] = useState<string | null>(
    initialAnchor,
  );
  const [pinned, setPinned] = useState(false);

  /** The strip, driven by the sentinel that sits under the header band. */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Above the boundary, not merely outside it: the sentinel is also
        // "not intersecting" while it is still below the fold, which is the
        // whole of a first page load.
        const boundary = entry.rootBounds?.top ?? 0;
        setPinned(
          !entry.isIntersecting && entry.boundingClientRect.top < boundary,
        );
      },
      // The boundary is the strip's own bottom edge, so the band is pinned at
      // the moment the header's copy of it would have scrolled underneath, so
      // the two never overlap and nothing is on screen twice.
      { rootMargin: `-${navbarHeight() + STRIP_HEIGHT}px 0px 0px 0px` },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef]);

  /** The marker, driven by whichever article crosses the reading line. */
  useEffect(() => {
    const articles = Array.from(
      document.querySelectorAll<HTMLElement>('[data-release]'),
    );
    if (!articles.length) return;

    /*
      DOM order is release order, newest first, and the band is tall enough
      that two articles can cross it at once, one ending in it and one
      starting. The winner is the one that started last, which is the *higher*
      index, because that is the release filling the screen below the line.

      This was the lower index and it was visibly wrong: landing on a release
      via the spectrum put its top a few pixels under the band, so the entry
      above it was still clipping the band's upper edge, and the strip named
      the release the reader had just jumped away from.
    */
    const order = new Map(
      articles.map((node, index) => [node.dataset.release ?? '', index]),
    );
    const crossing = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const anchor = (entry.target as HTMLElement).dataset.release ?? '';
          if (entry.isIntersecting) crossing.add(anchor);
          else crossing.delete(anchor);
        }

        let best: string | null = null;
        let bestIndex = Number.NEGATIVE_INFINITY;
        for (const anchor of crossing) {
          const index = order.get(anchor) ?? Number.NEGATIVE_INFINITY;
          if (index > bestIndex) {
            bestIndex = index;
            best = anchor;
          }
        }

        // Held rather than cleared when nothing crosses. The band is empty
        // between two articles and at both ends of the page, and blanking the
        // marker there makes it flicker on an ordinary scroll.
        if (best) setActiveAnchor(best);
      },
      /*
        The band sits at a fifth of the way down rather than at a seventh, and
        the extra is not cosmetic. An anchored release lands with its top just
        under the pinned strip, around 120px, so a line drawn any higher than
        that is still inside the entry above it, and the strip would name the
        release the reader had just left. A fifth of the viewport clears 120px
        on anything 600px tall or more, and below that the tie-break above
        catches it.
      */
      { rootMargin: '-20% 0px -75% 0px' },
    );

    for (const article of articles) observer.observe(article);
    return () => observer.disconnect();
  }, [count]);

  return { activeAnchor, pinned };
}
