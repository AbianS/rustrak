import type { RustrakError } from '@rustrak/client';
import {
  describeError,
  errorGuidance,
  errorHeadline,
} from '@/shared/lib/error-copy';
import { ErrorScreen } from '@/shared/ui/error-screen';
import { ReloadButton } from '@/shared/ui/reload-button';

/**
 * The whole-viewport version of a failed read, for the places that have no
 * header to sit under: the root auth gate and the layouts below it.
 *
 * Its in-place sibling is `ServiceUnavailable`, which is what a single failed
 * tile or panel renders. The distinction matters: a page that loaded most of
 * itself must not be replaced by one sub-request's failure.
 *
 * Every line comes from `kind`. Only `network` and `server_error` claim the API
 * is down; a `forbidden` reaching this screen is told to ask an administrator,
 * not to wait for a server that is already answering.
 */
export function OutageScreen({ error }: { error: RustrakError }) {
  return (
    <ErrorScreen
      headline={errorHeadline(error)}
      description={describeError(error)}
      guidance={errorGuidance(error)}
      actions={<ReloadButton />}
    />
  );
}
