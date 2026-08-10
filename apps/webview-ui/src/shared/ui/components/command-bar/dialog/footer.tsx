'use client';

import { useTranslations } from 'next-intl';
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
  const t = useTranslations();

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
        {t('commands.navigate')}
      </Hint>
      <Hint keys={<Kbd>↵</Kbd>}>{t('commands.open')}</Hint>

      {hasPreview ? (
        <Hint keys={<Kbd>⇥</Kbd>}>
          {previewOpen ? t('commands.hidePages') : t('commands.pages')}
        </Hint>
      ) : null}

      <Hint keys={<Kbd>esc</Kbd>}>{t('commands.close')}</Hint>
    </div>
  );
}
