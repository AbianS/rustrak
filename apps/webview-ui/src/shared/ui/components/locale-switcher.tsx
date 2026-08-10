'use client';

import { Check, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { type Locale, routing } from '@/i18n/routing';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/components/shadcn/dropdown-menu';

/**
 * The language switch in the header.
 *
 * Swaps the locale prefix of the current URL and stays on the same page.
 * The query string is preserved by reading it from the browser at click time:
 * `usePathname` (from the i18n navigation) deliberately excludes it.
 */
export function LocaleSwitcher() {
  const t = useTranslations('locale');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    router.replace(`${pathname}${window.location.search}`, { locale: next });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('switch')}
          />
        }
      >
        <Globe className="size-4" />
        <span className="sr-only">{t('switch')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {routing.locales.map((candidate) => (
          <DropdownMenuItem key={candidate} onClick={() => switchTo(candidate)}>
            {candidate === locale && (
              <Check className="mr-2 size-4 text-primary" />
            )}
            {t(candidate)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
