'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useTransition } from 'react';
import { useRouter } from '@/shared/i18n/navigation';
import { type Locale, routing } from '@/shared/i18n/routing';
import { Label } from '@/shared/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/components/shadcn/select';

/**
 * The language control, as an ordinary form field.
 *
 * **It was a globe dropdown in the header first, then a row of tiles.** The
 * header was wrong because a header slot is for what you reach for while
 * working, and a language is set once; the tiles were wrong because tiles are
 * for a small closed set you pick between visually, like a theme, and a
 * language list is neither small in principle nor visual. A select is what
 * every other product uses for this, and it stays right at twelve locales.
 *
 * **Each language names itself.** `简体中文`, not "Chinese" -- a reader who
 * needs this control is by definition not reading the current language well,
 * and the one string they will recognise is their own.
 *
 * No flags, deliberately. A language is not a country, and `zh` in particular
 * is spoken across several.
 */
export function LanguageSelector() {
  const t = useTranslations('locale');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();

  const switchTo = (next: string | null) => {
    if (!next || next === locale) return;

    // Read from the browser at click time rather than through `usePathname`.
    // That hook subscribes this component to every URL change in the app to
    // deliver a value only ever read here, in a handler -- react-doctor flags
    // exactly that (`rerender-defer-reads-hook`). It also drops the query
    // string, which has to be preserved by hand anyway.
    //
    // `router.replace` wants the path without a locale on it, and
    // `window.location` has one, so it comes back off.
    const { pathname, search } = window.location;
    const prefix = `/${locale}`;
    const unprefixed = pathname.startsWith(prefix)
      ? pathname.slice(prefix.length) || '/'
      : pathname;

    startTransition(() => {
      router.replace(`${unprefixed}${search}`, { locale: next as Locale });
    });
  };

  return (
    <div className="flex flex-col gap-2 sm:max-w-xs">
      <Label htmlFor={fieldId}>{t('label')}</Label>
      <Select
        value={locale}
        onValueChange={switchTo}
        // Unlike the theme, changing this is a server navigation. Without the
        // pending state a slow response reads as a dead control and invites a
        // second pick.
        disabled={isPending}
      >
        <SelectTrigger id={fieldId} className="w-full">
          <SelectValue>{(value) => t(String(value) as Locale)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {routing.locales.map((candidate) => (
            <SelectItem key={candidate} value={candidate}>
              {t(candidate)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t('storedOnDevice')}</p>
    </div>
  );
}
