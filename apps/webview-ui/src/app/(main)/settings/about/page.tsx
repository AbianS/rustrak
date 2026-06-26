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

export const metadata: Metadata = {
  title: 'About | Rustrak',
  description: 'About Rustrak error tracking system',
};

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
                <p className="font-mono font-medium">
                  {serverVersion?.version
                    ? `v${serverVersion.version}`
                    : 'Unavailable'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Environment</p>
                <p className="font-mono font-medium">{process.env.NODE_ENV}</p>
              </div>
            </div>
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
