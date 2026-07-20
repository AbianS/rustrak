import { redirect } from 'next/navigation';

interface ProjectSettingsIndexPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectSettingsIndexPage({
  params,
}: ProjectSettingsIndexPageProps) {
  const { id } = await params;
  redirect(`/projects/${id}/settings/general`);
}
