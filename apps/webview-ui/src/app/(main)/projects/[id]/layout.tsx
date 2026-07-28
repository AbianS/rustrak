import { cookies } from 'next/headers';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { getProject, getProjects } from '@/features/project/api/queries';
import { ProjectSidebar } from '@/features/project/ui/project-sidebar';

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { id } = await params;
  const projectId = parseInt(id, 10);

  const [project, projectsResponse, cookieStore] = await Promise.all([
    getProject(projectId),
    getProjects({ per_page: 100 }),
    cookies(),
  ]);

  // The layout renders the chrome around whatever the page does with its own
  // failure, so neither fetch is fatal here. An empty switcher and a blank
  // mobile title are honest degradations; the page below this one is where the
  // same failure gets a surface with words on it.
  const projects = projectsResponse.success
    ? projectsResponse.data.items.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        platform: p.platform,
      }))
    : [];
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="min-h-[calc(100svh-4rem)]!"
    >
      <ProjectSidebar projectId={projectId} projects={projects} />
      <SidebarInset className="min-w-0 overflow-hidden">
        {/* Mobile-only bar — opens the sidebar sheet. On desktop the sidebar
            collapses via its footer button, drag-rail, or Cmd/Ctrl+B.
            top-0: it pins to the top of SidebarInset, which already sits below
            the global header (an offset like top-16 would double-shift it). */}
        <div className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md md:hidden">
          <SidebarTrigger className="text-muted-foreground" />
          <span className="truncate text-sm font-medium text-muted-foreground">
            {project.success ? project.data.name : ''}
          </span>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
