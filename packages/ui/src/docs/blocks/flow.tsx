import type { ReactNode } from 'react';
import { ArrowRightIcon } from '../../components/icon/icon-catalog';
import { Text } from '../../components/text/text';

/**
 * A chain: a value that becomes another value that becomes a utility, a
 * pointer-down that becomes a press that becomes a panel.
 *
 * The system has a handful of these and they are the part people get wrong
 * from prose. Drawn once, the layering stops being a paragraph to remember.
 */
export function Flow({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 flex flex-col items-stretch gap-2 rounded-lg border border-border-subtle bg-canvas p-5 sm:flex-row sm:items-center">
      {children}
    </div>
  );
}

export function Step({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  /** The last step in a chain is the one that reaches the component. */
  tone?: 'default' | 'brand';
}) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-md border border-border-divider bg-panel px-3 py-2.5">
      <Text variant="column" tone="ghost">
        {label}
      </Text>
      <Text variant="mono-sm" tone={tone === 'brand' ? 'brand' : 'secondary'}>
        {value}
      </Text>
    </div>
  );
}

export function Arrow() {
  return (
    <ArrowRightIcon
      size="sm"
      className="shrink-0 rotate-90 self-center text-fg-ghost sm:rotate-0"
    />
  );
}
