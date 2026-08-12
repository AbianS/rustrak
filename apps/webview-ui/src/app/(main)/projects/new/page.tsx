import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getProjects } from '@/features/project/api/queries';
import { CreateProjectForm } from '@/features/project/ui/components/create-project-form/create-project-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('projectPages');
  return {
    title: t('newProject.meta.title'),
    description: t('newProject.meta.description'),
  };
}

/**
 * Create-project page: platform picker plus name, in one form.
 *
 * A full page rather than a dialog, matching Sentry's own `/projects/new/`.
 */
export default async function NewProjectPage() {
  const t = await getTranslations('projectPages');

  // Only used to suggest a free default name. `projects.name` is UNIQUE, so
  // the raw platform id Sentry pre-fills would collide on a second Next.js
  // project. One page is enough for a suggestion; the server still has the
  // final say and returns a 409 on a genuine collision.
  //
  // A failed lookup only costs a less clever default name, so it must not block
  // project creation: this is one of the few places where discarding the
  // failure is the right answer, and it is written out rather than swallowed by
  // a `catch`.
  const existing = await getProjects({ page: 1, per_page: 100 });
  const existingNames = existing.success
    ? existing.data.items.map((p) => p.name)
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t('newProject.backToProjects')}
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">
          {t('newProject.title')}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('newProject.subtitle')}</p>
      </div>

      <CreateProjectForm existingNames={existingNames} />
    </div>
  );
}
