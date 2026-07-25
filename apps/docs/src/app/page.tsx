import { LandingPage } from '@/components/landing/landing-page';

/**
 * The landing, as its own route.
 *
 * It used to be `content/index.mdx` — a one-line MDX file whose entire body was
 * `<LandingPage />`. That put it through the whole documentation pipeline for
 * no reason: the MDX compiler, the theme's page wrapper, the sidebar, the table
 * of contents, and a `_meta.js` entry whose only job was to switch off six
 * theme features one at a time. The page was configured almost entirely by
 * negation.
 *
 * As a plain route it opts in to nothing, so there is nothing to opt out of.
 */
export const metadata = {
  title: 'Rustrak: everything Sentry does, on a server you own',
  description:
    'Self-hosted, Sentry-compatible error tracking. Point any official Sentry SDK at a binary you run yourself. Open source under GPL-3.0, in under 100MB of RAM.',
};

export default function Page() {
  return <LandingPage />;
}
