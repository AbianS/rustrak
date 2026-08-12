import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always',
  /**
   * Remember the viewer's choice: the first visit follows the browser
   * language (defaulting to English), and a manual switch writes this cookie
   * so later visits keep it.
   */
  localeCookie: true,
});

export type Locale = (typeof routing.locales)[number];
