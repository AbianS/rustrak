import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { CommandGroup } from '@/shared/ui/components/shadcn/command';

/**
 * Group headings, restyled from outside the generated component: smaller,
 * uppercase and tracked out, so a heading reads as a divider rather than as
 * another row. `**:` reaches the `[cmdk-group-heading]` element cmdk renders
 * for us, which is the only handle we get on it.
 */
const GROUP_HEADING = cn(
  '**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-3',
  '**:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:text-[11px]',
  '**:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:uppercase',
  '**:[[cmdk-group-heading]]:tracking-[0.09em]',
  '**:[[cmdk-group-heading]]:text-muted-foreground/60',
);

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <CommandGroup heading={heading} className={cn('px-2', GROUP_HEADING)}>
      {children}
    </CommandGroup>
  );
}
