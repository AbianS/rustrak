import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

/**
 * The square that carries an icon, so every row starts on the same line and
 * the preview column repeats the shape one size up.
 */
export function IconTile({
  children,
  size = 'row',
}: {
  children: ReactNode;
  size?: 'row' | 'detail';
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border transition-colors duration-100',
        'border-foreground/10 bg-foreground/5',
        'group-data-[selected=true]/command-item:border-primary/30',
        'group-data-[selected=true]/command-item:bg-primary/10',
        size === 'row' ? 'size-9' : 'size-14',
      )}
    >
      {children}
    </span>
  );
}
