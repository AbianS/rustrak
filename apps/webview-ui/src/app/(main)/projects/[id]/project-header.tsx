'use client';

import type { Project } from '@rustrak/client';
import { ProjectSettingsDialog } from './project-settings-dialog';

interface ProjectHeaderProps {
  project: Project;
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {project.name}
        </h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          {project.slug}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-right mr-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Events
          </p>
          <p className="text-xl font-bold text-primary">
            {project.digested_event_count.toLocaleString()}
          </p>
        </div>

        <ProjectSettingsDialog project={project} />
      </div>
    </div>
  );
}
