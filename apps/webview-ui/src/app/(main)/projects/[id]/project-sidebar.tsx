'use client';

import {
  AlertCircle,
  Check,
  ChevronsLeft,
  ChevronsUpDown,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ProjectOption {
  id: number;
  name: string;
  slug: string;
}

interface ProjectSidebarProps {
  projectId: number;
  projects: ProjectOption[];
  unresolvedCount: number;
}

function formatBadge(count: number): string {
  if (count > 99) return '99+';
  return String(count);
}

function initialOf(name: string): string {
  return (name || '?').charAt(0).toUpperCase();
}

function ProjectAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-sm font-semibold text-foreground',
        className,
      )}
    >
      {initialOf(name)}
    </div>
  );
}

/** Dokploy-style project switcher: a card that opens a project picker. */
function ProjectSwitcher({
  projectId,
  projects,
}: {
  projectId: number;
  projects: ProjectOption[];
}) {
  const current =
    projects.find((p) => p.id === projectId) ??
    ({ id: projectId, name: 'Project', slug: '' } as ProjectOption);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg border bg-sidebar-accent/40 p-2 text-left transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0"
          />
        }
      >
        <ProjectAvatar name={current.name} />
        <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
          <span className="truncate text-sm font-semibold leading-tight">
            {current.name}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground leading-tight">
            {current.slug}
          </span>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Projects
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              render={<Link href={`/projects/${p.id}/issues`} />}
              className="gap-2"
            >
              <ProjectAvatar name={p.name} className="size-6 text-xs" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{p.name}</span>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {p.slug}
                </span>
              </div>
              {p.id === projectId && (
                <Check className="size-4 shrink-0 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CollapseButton() {
  const { toggleSidebar } = useSidebar();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Expand"
          onClick={toggleSidebar}
          isActive={false}
          className="h-9 justify-center text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <ChevronsLeft className="transition-transform group-data-[collapsible=icon]:rotate-180" />
          <span className="group-data-[collapsible=icon]:hidden">Collapse</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function ProjectSidebar({
  projectId,
  projects,
  unresolvedCount,
}: ProjectSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: `/projects/${projectId}/issues`,
      label: 'Issues',
      icon: AlertCircle,
      badge: unresolvedCount,
    },
    {
      href: `/projects/${projectId}/performance`,
      label: 'Performance',
      icon: Zap,
    },
  ];

  return (
    <TooltipProvider delay={0}>
      <Sidebar collapsible="icon" className="top-16! h-[calc(100svh-4rem)]!">
        <SidebarHeader className="p-2">
          <ProjectSwitcher projectId={projectId} projects={projects} />
        </SidebarHeader>

        <SidebarContent className="py-1">
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);
                  const showBadge =
                    item.badge !== undefined && item.badge > 0;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        // Drive active styling ourselves for the brand-green fill.
                        isActive={false}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                        className={cn(
                          'h-10 gap-3 rounded-lg text-[0.925rem] font-medium group-data-[collapsible=icon]:justify-center',
                          isActive
                            ? 'bg-primary! font-semibold text-primary-foreground! shadow-sm hover:bg-primary! hover:text-primary-foreground!'
                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
                        )}
                      >
                        <Icon />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.label}
                        </span>
                        {showBadge && (
                          <span
                            className={cn(
                              'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums group-data-[collapsible=icon]:hidden',
                              isActive
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : 'bg-destructive/10 text-destructive',
                            )}
                          >
                            {formatBadge(item.badge!)}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <CollapseButton />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </TooltipProvider>
  );
}
