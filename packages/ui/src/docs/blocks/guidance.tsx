import type { ReactNode } from 'react';
import { Text } from '../../components/text/text';
import { tv } from '../../lib/tv';

/**
 * Where the component appears in Rustrak.
 *
 * The one question a props table never answers, and the one that decides how
 * a component gets used: "a button triggers an action" tells a reader nothing,
 * "the primary is the Resolve in the issue detail" tells them how many belong
 * on a screen.
 */
export function UsedIn({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-divider sm:grid-cols-2">
      {children}
    </div>
  );
}

/** One screen, and what the component is doing on it. */
export function Place({ at, children }: { at: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 bg-panel p-4">
      <Text variant="column" tone="brand">
        {at}
      </Text>
      <Text variant="meta" tone="secondary">
        {children}
      </Text>
    </div>
  );
}

const guideline = tv({
  slots: {
    frame: 'flex min-h-32 items-center justify-center rounded-lg border p-6',
    verdict: 'shrink-0',
  },
  variants: {
    verdict: {
      do: {
        frame: 'border-success bg-success-surface',
        verdict: 'text-success',
      },
      dont: {
        frame: 'border-danger bg-danger-surface',
        verdict: 'text-danger',
      },
    },
  },
});

/**
 * A do / don't pair, always both halves.
 *
 * A "do" on its own is a preference; it is the rejected half that carries the
 * rule. Both are rendered live rather than screenshotted, so the guidance
 * cannot quietly stop matching the component.
 */
export function DoDont({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  );
}

function Guideline({
  verdict,
  example,
  children,
}: {
  verdict: 'do' | 'dont';
  example: ReactNode;
  children: ReactNode;
}) {
  const styles = guideline({ verdict });
  return (
    <div className="flex flex-col gap-2.5">
      <div className={styles.frame()}>{example}</div>
      <div className="flex items-baseline gap-2">
        <Text variant="column" className={styles.verdict()}>
          {verdict === 'do' ? 'Do' : "Don't"}
        </Text>
        <Text variant="meta" tone="secondary">
          {children}
        </Text>
      </div>
    </div>
  );
}

export function Do({
  example,
  children,
}: {
  example: ReactNode;
  children: ReactNode;
}) {
  return (
    <Guideline verdict="do" example={example}>
      {children}
    </Guideline>
  );
}

export function Dont({
  example,
  children,
}: {
  example: ReactNode;
  children: ReactNode;
}) {
  return (
    <Guideline verdict="dont" example={example}>
      {children}
    </Guideline>
  );
}

/**
 * What the component promises beyond how it looks: the keyboard path, what it
 * announces, what the types refuse. Every line is a claim a `play` function in
 * the same folder holds up.
 */
export function Guarantees({ children }: { children: ReactNode }) {
  return (
    <ul className="my-6 flex flex-col gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-divider">
      {children}
    </ul>
  );
}

export function Guarantee({
  children,
  story,
}: {
  children: ReactNode;
  /** The story that asserts it, by name. */
  story?: string;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 bg-panel px-4 py-3">
      <Text variant="meta" tone="secondary" className="max-w-prose">
        {children}
      </Text>
      {story ? (
        <Text variant="mono-sm" tone="ghost">
          {story}
        </Text>
      ) : null}
    </li>
  );
}
