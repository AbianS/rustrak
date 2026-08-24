import { type ReactNode, useState } from 'react';
import { Button } from '../../components/button/button';
import { RefreshIcon } from '../../components/icon/icon-catalog';
import { Text } from '../../components/text/text';

/**
 * A transition you can replay.
 *
 * Motion is the part of a design system that documentation habitually loses:
 * a still frame shows the end state and says nothing about the 110 ms in
 * front of it. This runs the real transition on the real component, on
 * demand, with the two tokens that produced it named underneath.
 *
 * The state is a plain toggle driven by the button. There is no effect here on
 * purpose: an effect that starts an animation on mount fires once, before
 * anybody has scrolled to it, and then never again.
 */
export function MotionDemo({
  children,
  duration,
  ease,
  label = 'Replay',
}: {
  children: (playing: boolean) => ReactNode;
  /** The duration token the transition uses: `duration-fast`. */
  duration: string;
  /** The easing token: `ease-entrance`. */
  ease: string;
  label?: string;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <figure className="my-6 flex flex-col gap-3 rounded-lg border border-border-subtle bg-canvas p-6">
      <div className="flex min-h-28 items-center justify-center">
        {children(playing)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-border-divider border-t pt-3">
        <div className="flex gap-4">
          <Text variant="mono-sm" tone="meta">
            {duration}
          </Text>
          <Text variant="mono-sm" tone="meta">
            {ease}
          </Text>
        </div>
        <Button
          size="xs"
          variant="ghost"
          icon={RefreshIcon}
          onClick={() => setPlaying((on) => !on)}
        >
          {label}
        </Button>
      </div>
    </figure>
  );
}
