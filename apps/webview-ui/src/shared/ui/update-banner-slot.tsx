import { checkForUpdate } from '@/shared/api/version-check';
import { UpdateBanner } from '@/shared/ui/update-banner';

/**
 * Decides whether the update banner is shown at all.
 *
 * Exactly one of the four outcomes renders anything. `up-to-date` and
 * `disabled` render nothing because there is nothing to say; `unknown` renders
 * nothing because a banner is a claim about the running version, and this is
 * the branch where that version is precisely what could not be established.
 * Silence is the only honest output there, and it is also the only output the
 * type system cannot check, which is why it has its own test.
 *
 * It lives in its own file rather than inside `(main)/layout.tsx` so that this
 * decision can be rendered in a test. Awaiting a nested async component through
 * `<Suspense>` in jsdom does not resolve; calling this one does.
 */
export async function UpdateBannerSlot() {
  const check = await checkForUpdate();

  return check.state === 'update-available' ? (
    <UpdateBanner info={check.info} />
  ) : null;
}
