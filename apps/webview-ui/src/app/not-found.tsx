import type { Metadata } from 'next';
import Link from 'next/link';
import { ErrorScreen } from '@/shared/ui/error-screen';
import { Button } from '@/shared/ui/shadcn/button';

export const metadata: Metadata = {
  title: 'Not found | Rustrak',
};

/**
 * The one 404 for every route.
 *
 * It covers both an unmatched URL and every `notFound()` raised inside the
 * app -- a project id that does not exist, a deleted issue, a release with no
 * rows, or `LoadFailure` turning a `not_found` into the app's 404. Because it
 * is the only one, it replaces the header for a signed-in reader too, which is
 * why the action below is not decoration: it is the only way back.
 */
export default function NotFound() {
  return (
    <ErrorScreen
      brandStatement="Nothing here"
      brandDescription="Nothing failed on the way to this page. The server answered normally and simply had nothing at this address."
      headline="Page not found"
      description="This address does not match any page in this Rustrak instance."
      guidance="If you followed a link from inside Rustrak, the project, issue or event it pointed at may have been deleted since."
      actions={
        <Button nativeButton={false} render={<Link href="/projects" />}>
          Go to Projects
        </Button>
      }
    />
  );
}
