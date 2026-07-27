import type { RustrakError } from '@rustrak/client';
import { PlugZap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { describeError, errorGuidance, errorHeadline } from '@/lib/error-copy';

/**
 * What the user is told when a page could not finish a read, and the reason was
 * **not** "you are signed out".
 *
 * The whole point of this surface is that it is not `/auth/login`. A page that
 * redirects on a network failure sends a signed-in user to a login form that
 * cannot help: logging in issues the same request, which fails the same way,
 * and the user is bounced again.
 *
 * Every line comes from `kind`. It used to assert an outage unconditionally --
 * heading "Rustrak is not responding", footer "reload once the API is back" --
 * which is right for `network` and `server_error` and wrong for the eleven
 * other kinds that reach it. A `forbidden` was told to wait for a server that
 * was already answering, and an `invalid_response` from a dashboard deployed
 * ahead of its API was told to reload, which can never fix a schema mismatch.
 */
export function ServiceUnavailable({
  error,
  title,
}: {
  error: RustrakError;
  /** Names the read that failed, for a page that does several. */
  title?: string;
}) {
  const guidance = errorGuidance(error);

  return (
    <div className="p-8">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <PlugZap className="size-12 text-muted-foreground/50 mb-4" />
          <p className="font-semibold">{title ?? errorHeadline(error)}</p>
          <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            {describeError(error)}
          </p>
          {guidance ? (
            <p className="text-muted-foreground/70 mt-4 text-xs max-w-sm">
              {guidance}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
