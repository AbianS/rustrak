'use client';

import type { MotionValue } from 'motion/react';
import * as m from 'motion/react-m';
import { AppFrame } from '../../app-mock/app-frame';
import { MockOverview } from '../../app-mock/mock-overview';
import { Tour } from '../../app-mock/tour';
import { EASE } from '../../motion';

/**
 * The product, as a screen the reader is stepped towards.
 *
 * `held` is the desktop story: the panel is pinned in a tall track and the
 * tour plays through it. A phone gets the overview once at full size instead,
 * because a screen swapping under a thumb holding the page still is a layout
 * shift nobody asked for.
 */
export function HeroPanel({
  panelRef,
  visible,
  held,
  started,
  reduced,
  scale,
  gate,
  onCaretAway,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** Whether the panel is on screen. Gates the tour, the pointer and the log tail. */
  visible: boolean;
  held: boolean;
  started: boolean;
  reduced: boolean | null;
  scale: MotionValue<number>;
  gate: MotionValue<number>;
  onCaretAway: (away: boolean) => void;
}) {
  return (
    <div className="relative mt-14 sm:mt-20 lg:h-[138vh]">
      <div className="px-3 sm:px-6 lg:sticky lg:top-[13vh] lg:px-10">
        {/*
        The panel's arrival, nested inside the track rather than applied to
        it: a transform on the track would be an ancestor transform over its
        own `sticky` child, which changes what the child sticks to.

        Delayed until the painting behind it has finished resolving, which
        takes about 2.75s. Opacity and scale only — a blur here reads well
        and costs badly, since an element with five hundred descendants has
        to be rasterised to a buffer and gaussian-blurred every frame for
        the whole 1.9s. A deeper scale buys the same sense of a subject
        being approached out of properties the compositor animates for free.
      */}
        <m.div
          initial={reduced ? undefined : { opacity: 0, y: 72, scale: 0.92 }}
          animate={
            reduced || !started ? undefined : { opacity: 1, y: 0, scale: 1 }
          }
          transition={{ duration: 1.9, ease: EASE, delay: 2 }}
        >
          <m.div
            ref={panelRef}
            className="relative mx-auto w-full max-w-[1160px]"
            style={held ? { scale } : undefined}
          >
            {held ? (
              /*
              The product using itself: a pointer clicks through five
              screens, each playing its own entrance (`app-mock/tour.tsx`).
              A reader looking at one held dashboard learns that there is a
              dashboard; a reader watching the issue list open into a stack
              trace, then a log stream, then an agent waterfall, learns the
              shape of the whole product before scrolling once.

              It opens its own `AppFrame`, because the pointer starts below
              the product and the frame hides its overflow.
            */
              <Tour
                armed={started && visible}
                gate={gate}
                onCaret={onCaretAway}
              />
            ) : (
              /*
              Below `lg`: the overview alone, played once on entry rather
              than scrubbed on scroll, since it is already on the page at
              first paint and scrubbing would mean an empty dashboard until
              the visitor scrolled.

              The fill-in trails the panel by three tenths of a second
              rather than starting at mount. `armed` answers "is there a
              client alive to run this", not "is there anything to see": the
              panel is at `opacity: 0` until 2s, so an unheld fill-in
              animated sixty-odd motion values where nobody could watch them
              — on the same frames as the painting's reveal, which is where
              the opening fell from 120fps to 64.
            */
              <AppFrame>
                <MockOverview mode="enter" armed={started} enterDelay={2.3} />
              </AppFrame>
            )}
          </m.div>
        </m.div>
      </div>
    </div>
  );
}
