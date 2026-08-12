import { PlugZap } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getServerVersion } from '@/shared/api/server-version';
import { APP_VERSION } from '@/shared/config/constants';
import { describeError } from '@/shared/lib/error-copy';
import { RustrakWordmark } from '@/shared/ui/components/rustrak-wordmark';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/components/shadcn/card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return {
    title: t('about.meta.title'),
    description: t('about.meta.description'),
  };
}

/**
 * Neither `LoadFailure` nor `ServiceUnavailable` is used for the failed read
 * here, and the reason is worth writing down so the next person does not
 * "fix" it.
 *
 * `LoadFailure` navigates: `unauthenticated` redirects to login and `not_found`
 * renders the 404. Both are right for a page whose subject is the thing that
 * failed, and both are wrong here, where the rest of this page loaded and one
 * row of a grid could not be filled. `ServiceUnavailable` is that row's honest
 * content but the wrong shape for it, a full-width padded card standing where a
 * version string goes.
 *
 * So the row reports itself, in place, and borrows `describeError` so the
 * sentence explaining why matches the one used everywhere else. What matters is
 * only that "the server said 0.13.0" and "we could not ask the server" do not
 * render as the same thing, which is what a bare `null` collapsing into
 * "Unavailable" used to guarantee.
 */
export default async function AboutPage() {
  const [t, rootT, serverVersion] = await Promise.all([
    getTranslations('settings'),
    getTranslations(),
    getServerVersion(),
  ]);

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
          {t('about.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('about.subtitle')}</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            {/* The wordmark stands in for the card title: it says "Rustrak"
                already, and setting the name twice beside itself is the one
                thing the mark is not allowed to do. */}
            <div className="space-y-1.5">
              <RustrakWordmark className="h-[26px] w-auto" />
              <CardDescription>{t('about.cardDescription')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">
                  {t('about.webviewVersion')}
                </p>
                <p className="font-mono font-medium">v{APP_VERSION}</p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t('about.serverVersion')}
                </p>
                {serverVersion.success ? (
                  <p className="font-mono font-medium">
                    {serverVersion.data.version
                      ? `v${serverVersion.data.version}`
                      : t('about.notReported')}
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <PlugZap aria-hidden="true" className="size-4 shrink-0" />
                    {t('about.couldNotRead')}
                  </p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t('about.environment')}
                </p>
                <p className="font-mono font-medium">{process.env.NODE_ENV}</p>
              </div>
            </div>

            {!serverVersion.success && (
              <p className="text-xs text-muted-foreground">
                {describeError(serverVersion.error, rootT)}{' '}
                {t('about.serverVersionUnknown')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('about.links')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="https://github.com/rustrak/rustrak"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline block"
            >
              {t('about.githubRepository')}
            </a>
            <a
              href="https://github.com/rustrak/rustrak/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline block"
            >
              {t('about.reportAnIssue')}
            </a>
            <a
              href="https://docs.sentry.io/platforms/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline block"
            >
              {t('about.sentryDocs')}
            </a>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
