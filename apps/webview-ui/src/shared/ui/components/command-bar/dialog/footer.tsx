'use client';

import type { ReactNode } from 'react';
import { Kbd, KbdGroup } from '@/shared/ui/components/shadcn/kbd';

function Hint({ keys, children }: { keys: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {keys}
      {children}
    </span>
  );
}

/** The key legend under the list. */
export function CommandBarFooter({
  hasPreview,
  previewOpen,
}: {
  hasPreview: boolean;
  previewOpen: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-5 border-t border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-xs text-muted-foreground">
      <Hint
        keys={
          <KbdGroup>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
          </KbdGroup>
        }
      >
        navigate
      </Hint>
      <Hint keys={<Kbd>↵</Kbd>}>open</Hint>

      {hasPreview ? (
        <Hint keys={<Kbd>⇥</Kbd>}>{previewOpen ? 'hide pages' : 'pages'}</Hint>
      ) : null}

      <Hint keys={<Kbd>esc</Kbd>}>close</Hint>
    </div>
  );
}
