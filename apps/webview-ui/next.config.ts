import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin({
  requestConfig: './src/shared/i18n/request.ts',
  experimental: {
    messages: {
      path: './src/shared/i18n/messages',
      format: 'json',
      // The plugin can infer the locale list from the filenames in `path`, but
      // `routing.ts` is where this app decides which locales exist. Naming them
      // here keeps a stray `messages/de.json` from quietly becoming a locale.
      locales: ['en', 'zh', 'fr', 'es', 'ro'],
      sourceLocale: 'en',
      // Compiles the ICU strings at build time, through a Turbopack loader, into
      // the compact form next-intl formats from directly. Two effects that both
      // matter to a dashboard whose every page carries the dictionary: the
      // serialized messages get smaller, and formatting no longer parses ICU at
      // runtime.
      //
      // Costs `t.raw`, which stops working under precompilation. Nothing here
      // calls it, and a rule in `message-keys.test.ts` keeps it that way.
      precompile: true,
    },
  },
});

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
};

export default withNextIntl(nextConfig);
