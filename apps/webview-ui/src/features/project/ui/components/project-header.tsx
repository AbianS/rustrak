import type { Project } from '@rustrak/client';
import { getFormatter, getTranslations } from 'next-intl/server';

interface ProjectHeaderProps {
  project: Project;
}

export async function ProjectHeader({ project }: ProjectHeaderProps) {
  const format = await getFormatter();
  const t = await getTranslations('projects');

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

      <div className="text-right shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {t('events')}
        </p>
        <p className="text-xl font-bold text-primary">
          {format.number(project.digested_event_count)}
        </p>
      </div>
    </div>
  );
}
