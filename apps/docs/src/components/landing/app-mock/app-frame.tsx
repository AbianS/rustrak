'use client';

import * as m from 'motion/react-m';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { EASE } from '../motion';
import {
  COMPACT_HEIGHT,
  COMPACT_WIDTH,
  CompactContext,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  useDesignScale,
} from './design';

/** A region of the recreated UI, in the active design's own coordinates. */
export interface Spot {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The window the product is shown in. Deliberately not a fake macOS chrome
 * with three coloured dots — that device is the single clearest tell of a
 * generated landing. Just a hairline edge, a light catch along the top and a
 * deep shadow, so the eye reads "screen" and moves on to the content.
 *
 * Contents are authored at a fixed design size and scaled to fit, so the
 * recreated UI keeps identical proportions at every viewport instead of
 * reflowing into a layout the real app never has. Scaling reads `clientWidth`,
 * a layout value, so the scroll-driven transforms applied to ancestors do not
 * feed back into it.
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
  const box = useDesignScale(ref, DESIGN_WIDTH);

  const width = box.compact ? COMPACT_WIDTH : DESIGN_WIDTH;
  const height = box.compact ? COMPACT_HEIGHT : DESIGN_HEIGHT;

  return (
    <div
      ref={ref}
      aria-hidden
      /* Not selectable, for the reason set out in `MockStage`. Repeated here
         because this element also holds the pointer and the spotlight, which
         are chrome the stage never sees. */
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
          // A soft vignette that lifts one region out of a gently dimmed frame,
          // rather than a hard cut-out with a bright outline — the outline read
          // like a tooltip and the heavy dim muddied the UI.
          <m.div
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
