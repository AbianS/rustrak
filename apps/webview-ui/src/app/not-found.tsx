import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ErrorScreen } from '@/shared/ui/components/error-screen';
import { Button } from '@/shared/ui/components/shadcn/button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('errors');
  return { title: t('notFound.meta.title') };
}

/**
 * The one 404 for every route.
 *
 * It covers both an unmatched URL and every `notFound()` raised inside the
 * app -- a project id that does not exist, a deleted issue, a release with no
 * rows, or `LoadFailure` turning a `not_found` into the app's 404. Because it
 * is the only one, it replaces the header for a signed-in reader too, which is
 * why the action below is not decoration: it is the only way back.
 */
export default async function NotFound() {
  const t = await getTranslations('errors');

  return (
    <ErrorScreen
      brandStatement={t('notFound.brandStatement')}
      brandDescription={t('notFound.brandDescription')}
      headline={t('notFound.headline')}
      description={t('notFound.description')}
      guidance={t('notFound.guidance')}
      actions={
        <Button nativeButton={false} render={<Link href="/projects" />}>
          {t('goToProjects')}
        </Button>
      }
    />
  );
}
