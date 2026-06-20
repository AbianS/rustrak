import { cookies } from 'next/headers';
import { listIssues } from '@/actions/issues';
import { getProject, getProjects } from '@/actions/projects';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ProjectSidebar } from './project-sidebar';

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

  const [project, issuesResponse, projectsResponse, cookieStore] =
    await Promise.all([
      getProject(projectId),
      listIssues(projectId, { filter: 'open', per_page: 20 }).catch(() => ({
        items: [],
        total_count: 0,
        page: 1,
        per_page: 20,
        total_pages: 0,
      })),
      getProjects({ per_page: 100 }).catch(() => ({ items: [] })),
      cookies(),
    ]);

  const unresolvedCount = issuesResponse.total_count;
  const projects = projectsResponse.items.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
  }));
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="min-h-[calc(100svh-4rem)]!"
    >
      <ProjectSidebar
        projectId={projectId}
        projects={projects}
        unresolvedCount={unresolvedCount}
      />
      <SidebarInset className="min-w-0 overflow-hidden">
        {/* Mobile-only bar — opens the sidebar sheet. On desktop the sidebar
            collapses via its footer button, drag-rail, or Cmd/Ctrl+B.
            top-0: it pins to the top of SidebarInset, which already sits below
            the global header (an offset like top-16 would double-shift it). */}
        <div className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md md:hidden">
          <SidebarTrigger className="text-muted-foreground" />
          <span className="truncate text-sm font-medium text-muted-foreground">
            {project?.name ?? ''}
          </span>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
