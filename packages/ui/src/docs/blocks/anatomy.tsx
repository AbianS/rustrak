import type { ReactNode } from 'react';
import { Text } from '../../components/text/text';
import { cn } from '../../lib/cn';

/**
 * A live component with its parts numbered.
 *
 * The oldest figure in design documentation and still the fastest way to hand
 * somebody a vocabulary: after one look, "the trailing chevron" and "the
 * shortcut slot" are names both sides of a review already share.
 *
 * The pins sit above or below the component rather than on top of it -- a
 * numbered dot over a 32 px control covers the thing it is pointing at -- and
 * they are placed in per cent of the component's own width, so they keep
 * pointing at the same part when the type scale moves under them.
 */
export interface AnatomyPart {
  /** Where the pin points, in per cent of the component's width. */
  x: number;
  /** Above the component, or below it. Alternate to keep the leaders short. */
  below?: boolean;
  label: string;
  note?: ReactNode;
}

export function Anatomy({
  children,
  parts,
}: {
  children: ReactNode;
  parts: readonly AnatomyPart[];
}) {
  return (
    <figure className="my-6 flex flex-col gap-6 rounded-lg border border-border-subtle bg-canvas p-8">
      <div className="flex min-h-40 items-center justify-center">
        <div className="relative">
          {children}
          {parts.map((part, index) => (
            <Pin key={part.label} index={index} part={part} />
          ))}
        </div>
      </div>
      <ol className="grid grid-cols-1 gap-x-8 gap-y-2.5 border-border-divider border-t pt-5 sm:grid-cols-2">
        {parts.map((part, index) => (
          <li key={part.label} className="flex items-baseline gap-2.5">
            <Marker index={index} />
            <Text variant="meta" tone="secondary">
              <Text variant="mono-sm" render={<span />}>
                {part.label}
              </Text>
              {part.note ? <> — {part.note}</> : null}
            </Text>
          </li>
        ))}
      </ol>
    </figure>
  );
}

function Pin({ index, part }: { index: number; part: AnatomyPart }) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          'absolute w-px bg-border-muted',
          part.below ? 'top-full h-4' : 'bottom-full h-4',
        )}
        style={{ left: `${part.x}%` }}
      />
      {/*
        A zero-width box that centres what overflows it.
        `-translate-x-1/2` would be the obvious way to centre the pin on its
        leader, and it is the wrong one here: Tailwind compiles it to the
        `translate` property, which `motion.test.ts` then reads as something
        that moves and asks for a transition. Nothing moves -- the offset is
        static -- so the layout does it instead.
      */}
      <span
        className={cn(
          'absolute flex w-0 justify-center',
          part.below ? 'top-full mt-4' : 'bottom-full mb-4',
        )}
        style={{ left: `${part.x}%` }}
      >
        <Marker index={index} pinned />
      </span>
    </>
  );
}

function Marker({ index, pinned }: { index: number; pinned?: boolean }) {
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-pill border',
        pinned
          ? 'border-border-brand bg-surface-raised'
          : 'border-border-muted bg-surface-chip',
      )}
    >
      <Text variant="badge" tone={pinned ? 'brand' : 'meta'}>
        {index + 1}
      </Text>
    </span>
  );
}
