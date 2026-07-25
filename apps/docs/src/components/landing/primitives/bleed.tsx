'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import { CompactContext } from '../app-mock/app-frame';
import { WindowProgressContext } from '../app-mock/window-progress';

/**
 * A window onto a piece of the product, drawn at its own size and cropped.
 *
 * ── What this replaces ──────────────────────────────────────────────────────
 *
 * `AppFrame` shows a whole application: it authors the screen at 1240x840,
 * measures its container and scales the result down to fit. In an 800px cell
 * that lands at 0.65, which renders the app's 14px label at 9px and its 12px
 * mono at 7.8px. The panel stops being the product and becomes a photograph of
 * the product taken from across the room, and no amount of care spent on the
 * contents survives that division.
 *
 * The fix is not a bigger cell. It is to stop showing the whole application.
 * A surface drawn at 1:1 and allowed to run off the edge of the page reads as
 * the real thing at the real size, and the reader loses nothing by it: the
 * columns that leave through the right edge are the ones they were not going
 * to read anyway. Cropping shows less and communicates more.
 *
 * So `AppFrame` stays for exactly one chapter, where the point *is* the shape
 * of the whole application, and every other chapter gets one of these.
 *
 * ── Why there is no frame ───────────────────────────────────────────────────
 *
 * No border, no radius, no shadow. A rounded rectangle with a hairline and a
 * drop shadow says "screenshot pasted onto a page"; the same pixels bled off
 * the edge of the band say "this page has a hole in it and the product is
 * behind it". The second is the illusion worth having, and a frame is the one
 * thing guaranteed to break it, because a frame has an outside.
 *
 * ── The fade is the whole trick ─────────────────────────────────────────────
 *
 * Cropping with `overflow: hidden` alone gives a hard cut, and a hard cut is
 * just a smaller screenshot with a straight edge. The surface has to *dissolve*
 * into the band instead, which is a mask rather than an overlay:
 *
 *     mask-image: linear-gradient(to right, #000 62%, transparent 100%)
 *
 * An overlaid gradient in the band's colour would look identical here and be
 * wrong everywhere else: it has to be repainted for every surface tint, it
 * paints over anything sharing the cell, and it fails outright on the tinted
 * showcase cells where the band colour is not the page colour. A mask removes
 * the pixels, so whatever is behind is simply behind.
 *
 * Multiple edges compose with `mask-composite: intersect`, which is why each
 * entry is its own gradient rather than one clever radial.
 *
 * ── Phones do not crop ──────────────────────────────────────────────────────
 *
 * Cropping trades width for size, and a phone has no width to trade. Below
 * `sm` the surface switches to the narrow design the mocks already carry (see
 * `useCompact` in `app-mock/app-frame.tsx`) and is scaled to fit, because at
 * that width a legible fragment of one column is worth less than a small view
 * of the whole thing.
 */

/** Design width of the narrow layout the mocks fall back to. */
const COMPACT_WIDTH = 600;
const COMPACT_QUERY = '(max-width: 639px)';

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

export type Edge = 'top' | 'right' | 'bottom' | 'left';

/**
 * How much of each edge dissolves, as a fraction of the window.
 *
 * `{ right: 0.28 }` fades the rightmost 28% and leaves the rest untouched.
 * Always measured inward from the named edge, which is the only reading that
 * survives having two opposite edges in the same object: an earlier version
 * measured every gradient from its own start, so `left` and `right` meant
 * opposite things and a symmetric `{ left: 0.06, right: 0.06 }` erased almost
 * the entire surface.
 */
export type Fade = Partial<Record<Edge, number>>;

const DIRECTION: Record<Edge, string> = {
  top: 'to top',
  right: 'to right',
  bottom: 'to bottom',
  left: 'to left',
};

function maskFor(fade: Fade): string | undefined {
  const parts = Object.entries(fade).map(([edge, depth]) => {
    // A gradient runs from the far side towards the named edge, so the solid
    // part reaches to `1 - depth` and the remainder is the fade.
    const solid = Math.round((1 - depth) * 100);
    return `linear-gradient(${DIRECTION[edge as Edge]}, #000 ${solid}%, transparent 100%)`;
  });
  return parts.length ? parts.join(', ') : undefined;
}

export function Bleed({
  children,
  width,
  height,
  view,
  align = 'center',
  offsetY = 0,
  fade,
  framed = false,
  className,
}: {
  children: ReactNode;
  /** Authored width of the surface, in its own pixels. */
  width: number;
  /** Authored height of the surface, in its own pixels. */
  height: number;
  /**
   * Height of the window, in the same pixels. Shorter than `height` crops the
   * surface vertically, which is what makes a list run off the bottom of the
   * band instead of ending in white space.
   */
  view?: number;
  /**
   * Horizontal placement of the surface in the window. `left` pins it to the
   * left edge so it leaves through the right, which is the reading direction
   * and therefore the edge a reader will accept losing.
   */
  align?: 'left' | 'center';
  /** Pixels of the surface hidden above the top of the window. */
  offsetY?: number;
  fade?: Fade;
  /**
   * Draws the two edges the surface actually closes on: a hairline along the
   * top and down the left, meeting in a rounded top-left corner.
   *
   * Not a return of the window chrome, and the difference is which edges are
   * left out. The right edge and the bottom get nothing, because those are the
   * two the surface *leaves* through. Border them and the whole device
   * collapses back into a screenshot in a box.
   *
   * The two that remain earn their place for a specific reason. Every one of
   * these surfaces carries the app's own near-black background, which is close
   * enough to the band behind it that the two met with no seam at all: the
   * screen appeared to start wherever its first row of content happened to fall
   * rather than where it actually starts, so the tops of five chapters lined up
   * with neither each other nor the ruled frame around them.
   *
   * The hairline states the edge, the corner keeps it from reading as one more
   * rule in a page already full of them, and the mask fades both out towards
   * the right along with everything else, so the frame dissolves exactly where
   * the content does.
   */
  framed?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, compact: false });

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const phone = window.matchMedia(COMPACT_QUERY);

    const measure = () => {
      const compact = phone.matches;
      setBox((current) => {
        // Only the narrow design scales. On a desktop the surface is drawn at
        // 1:1 and whatever does not fit is cropped, which is the entire point.
        const scale = compact ? element.clientWidth / COMPACT_WIDTH : 1;
        return current.compact === compact &&
          Math.abs(current.scale - scale) < 0.0005
          ? current
          : { scale, compact };
      });
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    phone.addEventListener('change', measure);
    return () => {
      observer.disconnect();
      phone.removeEventListener('change', measure);
    };
  }, []);

  const visible = view ?? height;
  const mask = box.compact ? undefined : maskFor(fade ?? {});

  /*
    The clock the surface inside runs on. Measured on the *window*, because the
    window is the part a reader can see: the surface itself is up to 840px tall
    behind a 590px hole, so its own travel through the viewport finishes long
    after the visible rows have gone past. See `app-mock/window-progress.ts`.
  */
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'center center'],
  });

  /*
    The frame, drawn rather than switched on.

    `inset(0 100% 0 0)` hides the stroke entirely and `inset(0 0 0 0)` reveals
    all of it, so animating the right inset wipes the outline in from the left:
    the corner arcs into place and the top rule runs out after it. It lands in
    the first fifth of the approach, well before the contents start arriving, so
    the reader sees the window get drawn and then get filled. A frame that
    appears at full strength on the same frame as its contents reads as a
    screenshot being swapped in.

    A clip on an overlay rather than a `scaleX` on two separate lines, because
    the rounded corner is the one part that cannot be faked with a scaled rule,
    and it is the part that says the edge was drawn on purpose.
  */
  const strokeClip = useTransform(
    scrollYProgress,
    [0, 0.2],
    ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'],
  );

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        'relative w-full overflow-hidden',
        // The radius stays on the container because it is what clips the
        // content into the corner. Only the *stroke* moves to the overlay
        // below, so it can be drawn rather than switched on.
        framed && 'rounded-tl-xl',
        className,
      )}
      style={{
        // The window keeps the surface's proportions on a phone, where nothing
        // is cropped, and holds an exact pixel height on a desktop, where the
        // crop is the layout.
        height: box.compact ? undefined : visible,
        aspectRatio: box.compact ? `${COMPACT_WIDTH} / ${visible}` : undefined,
        ...(mask
          ? {
              maskImage: mask,
              WebkitMaskImage: mask,
              maskComposite: 'intersect',
              WebkitMaskComposite: 'source-in',
            }
          : null),
      }}
    >
      <div
        className="absolute top-0 origin-top-left"
        style={{
          width: box.compact ? COMPACT_WIDTH : width,
          height,
          // Centring is done here rather than with `left-1/2` and a utility
          // class, because the vertical offset has to share the same
          // `transform` and the two would otherwise overwrite each other.
          left: !box.compact && align === 'center' ? '50%' : 0,
          transform: box.compact
            ? `scale(${box.scale})`
            : [
                align === 'center' ? 'translateX(-50%)' : null,
                offsetY ? `translateY(${-offsetY}px)` : null,
              ]
                .filter(Boolean)
                .join(' ') || undefined,
        }}
      >
        <CompactContext.Provider value={box.compact}>
          <WindowProgressContext.Provider value={scrollYProgress}>
            {children}
          </WindowProgressContext.Provider>
        </CompactContext.Provider>
      </div>

      {framed ? (
        <motion.span
          className="pointer-events-none absolute inset-0 z-10 rounded-tl-xl border-l border-t border-white/10"
          style={{ clipPath: strokeClip }}
        />
      ) : null}
    </div>
  );
}
