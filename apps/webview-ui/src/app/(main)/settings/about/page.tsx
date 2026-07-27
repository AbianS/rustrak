import { PlugZap } from 'lucide-react';
import type { Metadata } from 'next';
import { getServerVersion } from '@/actions/server';
import { RustrakLogoIcon } from '@/components/icons/rustrak-logo';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { APP_VERSION } from '@/lib/constants';
import { describeError } from '@/lib/error-copy';

export const metadata: Metadata = {
  title: 'About | Rustrak',
  description: 'About Rustrak error tracking system',
};

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
  const serverVersion = await getServerVersion();

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
          About
        </h1>
        <p className="text-muted-foreground mt-1">
          Information about your Rustrak installation
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <RustrakLogoIcon className="size-10" />
              <div>
                <CardTitle>Rustrak</CardTitle>
                <CardDescription>
                  Lightweight error tracking system
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">WebView version</p>
                <p className="font-mono font-medium">v{APP_VERSION}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Server version</p>
                {serverVersion.success ? (
                  <p className="font-mono font-medium">
                    {serverVersion.data.version
                      ? `v${serverVersion.data.version}`
                      : 'Not reported'}
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <PlugZap aria-hidden="true" className="size-4 shrink-0" />
                    Could not read
                  </p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Environment</p>
                <p className="font-mono font-medium">{process.env.NODE_ENV}</p>
              </div>
            </div>

            {!serverVersion.success && (
              <p className="text-xs text-muted-foreground">
                {describeError(serverVersion.error)} The server version is
                unknown until it answers; nothing is shown in its place.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="https://github.com/rustrak/rustrak"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline block"
            >
              GitHub Repository
            </a>
            <a
              href="https://github.com/rustrak/rustrak/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline block"
            >
              Report an Issue
            </a>
            <a
              href="https://docs.sentry.io/platforms/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline block"
            >
              Sentry SDK Documentation
            </a>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
