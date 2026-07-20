import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProject } from '@/actions/projects';
import { GeneralSettingsForm } from './general-settings-form';

interface GeneralSettingsPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'General Settings | Rustrak',
};

export default async function GeneralSettingsPage({
  params,
}: GeneralSettingsPageProps) {
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project) {
    notFound();
  }

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
          General Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your project and view integration details.
        </p>
      </div>

      <GeneralSettingsForm project={project} />
    </>
  );
}
