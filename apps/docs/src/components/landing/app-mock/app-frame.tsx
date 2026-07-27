'use client';

import { motion } from 'motion/react';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import { EASE } from '../motion';

/**
 * The viewport the recreated app is authored against.
 *
 * Tall enough that the overview's bento reaches its third row: the app's own
 * measurements are used throughout (a 64px header, a 256px rail, `text-3xl`
 * stat tiles), so the frame has to be a plausible browser window rather than a
 * convenient rectangle — shrink it and the only way to fit the screens is to
 * start shaving the product down, which is exactly the dishonesty this
 * recreation exists to avoid.
 */
const DESIGN_WIDTH = 1240;
const DESIGN_HEIGHT = 840;

/**
 * The narrow design, for phones.
 *
 * Scaling one design to fit is fine until the container is a phone, and then it
 * stops being a trade-off and becomes a failure: at 340px the 1240px design
 * lands at 0.27, which renders the app's 14px label at *3.8px*. Not small —
 * gone. The panel is the first impression of the product and on a phone it was
 * grey noise in the shape of a dashboard.
 *
 * So below `COMPACT_BELOW` the screens render a genuinely narrower layout
 * instead of a smaller picture of the wide one: the project rail comes out, the
 * gutters tighten, tables drop the columns a phone has no room for, and the
 * bento halves its column count. 600px is the width that falls out of that —
 * wide enough that nothing had to be redesigned rather than merely re-flowed,
 * narrow enough that a 390px phone lands at ~0.6 and puts the same 14px label
 * at 8.5px, which is what the *desktop* page shows it at anyway. The two ends
 * of the page finally agree on how big the product looks.
 *
 * Taller than it is wide, because a phone is: the extra height buys back most
 * of the rows lost to the narrower grid.
 */
const COMPACT_WIDTH = 600;
const COMPACT_HEIGHT = 900;

/**
 * Which design a frame draws. Tailwind's `sm`, exactly — and that it is the
 * *viewport* rather than the container is the point.
 *
 * Keying off each frame's own width was the obvious reading and it was wrong.
 * The hero's panel and the panels in the platform chapters sit in cells of
 * different widths, so on a tablet one of them crossed the threshold and the
 * other did not: the same product, drawn two different ways, a scroll apart on
 * one screen. Which layout the app is in is a fact about the device, not about
 * the box it happens to be sitting in.
 *
 * Sharing the breakpoint with the stylesheet is what keeps it honest: the
 * gutters around these frames change at `sm` too, so the two decisions have to
 * flip on the same pixel or the frame gets a phone's gutters and a desktop's
 * contents.
 */
const COMPACT_QUERY = '(max-width: 639px)';

/** A region of the recreated UI, in the active design's own coordinates. */
export interface Spot {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Whether the surrounding frame is drawing its narrow layout.
 *
 * Published as context rather than passed down: the screens are four levels
 * deep in places, and this is a property of the *frame*, not of any one screen.
 * Read it with `useCompact` — the fallback is `false`, so a fragment rendered
 * outside a frame (the two-up minis, the hanging cards) keeps its wide layout.
 */
export const CompactContext = createContext(false);

export function useCompact(): boolean {
  return useContext(CompactContext);
}

/** Measuring has to land before paint, or the frame flashes at scale 1. */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The window the product is shown in. Deliberately not a fake macOS chrome
 * with three coloured dots — that device is the single clearest tell of a
 * generated landing. Just a hairline edge, a light catch along the top and a
 * deep shadow, so the eye reads "screen" and moves on to the content.
 *
 * Contents are authored at a fixed design size and scaled to fit, so the
 * recreated UI keeps identical proportions at every viewport instead of
 * reflowing into a layout the real app never has. There are two such sizes —
 * see `COMPACT_WIDTH` — and the frame picks between them by measuring itself.
 * Scaling reads `clientWidth`, a layout value, so the scroll-driven transforms
 * applied to ancestors do not feed back into it.
 */
export function AppFrame({
  children,
  className,
  spotlight,
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * Dims everything but this region. `null` keeps the overlay mounted but
   * clear, so moving between regions animates instead of flashing.
   */
  spotlight?: Spot | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, compact: false });

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Read here rather than through `useMediaQuery`: that hook answers after
    // paint, which on a phone would mean one frame of the wide design at 0.27
    // before it flipped. This lands before the first paint instead.
    const phone = window.matchMedia(COMPACT_QUERY);

    const measure = () => {
      const compact = phone.matches;
      setBox((current) => {
        const scale =
          element.clientWidth / (compact ? COMPACT_WIDTH : DESIGN_WIDTH);
        // Guarded so a ResizeObserver firing on a sub-pixel reflow does not
        // re-render the whole recreated app for nothing.
        return current.compact === compact &&
          Math.abs(current.scale - scale) < 0.0005
          ? current
          : { scale, compact };
      });
    };
    measure();

    // The observer covers almost every case on its own — crossing the
    // breakpoint resizes the container too. The query is listened to as well
    // for the one that it does not: a full-bleed frame whose width happens not
    // to change across the boundary.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    phone.addEventListener('change', measure);
    return () => {
      observer.disconnect();
      phone.removeEventListener('change', measure);
    };
  }, []);

  const width = box.compact ? COMPACT_WIDTH : DESIGN_WIDTH;
  const height = box.compact ? COMPACT_HEIGHT : DESIGN_HEIGHT;

  return (
    <div
      ref={ref}
      aria-hidden
      /* Not selectable, for the reason set out in `MockStage`. Repeated on the
         frame as well as on the stage inside it because this element also holds
         the pointer and the spotlight, which are chrome the stage never sees. */
      className={cn(
        'relative w-full select-none overflow-hidden rounded-xl border border-white/10',
        'bg-[oklch(0.155_0_0)] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]',
        className,
      )}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-linear-to-r from-transparent via-white/25 to-transparent" />
      <div
        className="origin-top-left"
        style={{ width, height, transform: `scale(${box.scale})` }}
      >
        <CompactContext.Provider value={box.compact}>
          {children}
        </CompactContext.Provider>

        {spotlight !== undefined ? (
          // A soft vignette that lifts one region out of a gently dimmed
          // frame, rather than a hard cut-out with a bright outline — the
          // outline read like a tooltip and the heavy dim muddied the UI. The
          // cut-out is an outsized box-shadow that tracks the box, so it is a
          // single element easing between beats.
          <motion.div
            className="pointer-events-none absolute rounded-xl"
            initial={false}
            animate={
              spotlight
                ? {
                    left: spotlight.x - 8,
                    top: spotlight.y - 8,
                    width: spotlight.w + 16,
                    height: spotlight.h + 16,
                    opacity: 1,
                  }
                : { opacity: 0 }
            }
            transition={{ duration: 0.85, ease: EASE }}
            style={{
              boxShadow:
                '0 0 0 9999px rgba(10,10,10,0.6), inset 0 0 0 1px rgba(197,241,30,0.22)',
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
