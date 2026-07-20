import { SettingsTabs } from './settings-tabs';

interface ProjectSettingsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectSettingsLayout({
  children,
  params,
}: ProjectSettingsLayoutProps) {
  const { id } = await params;
  const projectId = parseInt(id, 10);

  return (
    <div className="w-full">
      <div className="border-b px-4 md:px-8">
        <SettingsTabs projectId={projectId} />
      </div>
      <div className="px-4 py-4 md:px-8 md:py-6">{children}</div>
    </div>
  );
}
