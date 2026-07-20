import { ProjectSettingsMobileNav } from './settings-mobile-nav';
import { ProjectSettingsNav } from './settings-nav';

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
      {/* Mobile bar. top-11 parks it under the project layout's own mobile
          bar (h-11) instead of overlapping it. */}
      <div className="sticky top-11 z-30 flex items-center gap-3 border-b bg-background px-4 py-3 md:hidden">
        <ProjectSettingsMobileNav projectId={projectId} />
        <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Project Settings
        </span>
      </div>

      <div className="flex min-h-[calc(100svh-4rem)]">
        {/* top-0, not top-16: this sits inside SidebarInset, which already
            starts below the global header. */}
        <aside className="sticky top-0 hidden h-[calc(100svh-4rem)] w-64 shrink-0 flex-col overflow-y-auto border-r border-border p-6 md:flex">
          <h2 className="mb-4 px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Project Settings
          </h2>
          <ProjectSettingsNav projectId={projectId} />
        </aside>

        <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
