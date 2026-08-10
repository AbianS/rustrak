import { redirect } from '@/i18n/redirect';

interface ProjectSettingsIndexPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectSettingsIndexPage({
  params,
}: ProjectSettingsIndexPageProps) {
  const { id } = await params;
  await redirect(`/projects/${id}/settings/general`);
}
