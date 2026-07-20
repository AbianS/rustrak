import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProject } from '@/actions/projects';
import { ClientKeysSettings } from './client-keys-settings';

interface ClientKeysPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Client Keys | Rustrak',
};

export default async function ClientKeysPage({ params }: ClientKeysPageProps) {
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project) {
    notFound();
  }

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">
          Client Keys (DSN)
        </h1>
        <p className="mt-1 text-muted-foreground">
          Connect an application to this project.
        </p>
      </div>

      <ClientKeysSettings project={project} />
    </>
  );
}
