'use client';

import type {
  AlertIntegration,
  AlertRule,
  Project,
  ProjectMember,
} from '@rustrak/client';
import { ProjectAlertsDialog } from './project-alerts-dialog';
import { ProjectMembersDialog } from './project-members-dialog';
import { ProjectSettingsDialog } from './project-settings-dialog';

interface ProjectHeaderProps {
  project: Project;
  alertRules: AlertRule[];
  channels: AlertIntegration[];
  members: ProjectMember[];
  currentUserId?: number;
  canManageMembers: boolean;
}

export function ProjectHeader({
  project,
  alertRules,
  channels,
  members,
  currentUserId,
  canManageMembers,
}: ProjectHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight truncate">
          {project.name}
        </h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm truncate">
          {project.slug}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right mr-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Events
          </p>
          <p className="text-xl font-bold text-primary">
            {project.digested_event_count.toLocaleString()}
          </p>
        </div>

        <ProjectAlertsDialog
          project={project}
          alertRules={alertRules}
          channels={channels}
        />
        <ProjectMembersDialog
          projectId={project.id}
          members={members}
          currentUserId={currentUserId}
          canManage={canManageMembers}
        />
        <ProjectSettingsDialog project={project} />
      </div>
    </div>
  );
}
