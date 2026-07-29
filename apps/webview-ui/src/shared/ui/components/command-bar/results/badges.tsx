import { PlatformIcon } from 'platformicons';
import type { CommandProject } from '@/shared/config/commands';

const BADGE =
  'flex min-w-0 shrink-0 items-center gap-1 rounded-md border border-foreground/10 bg-foreground/5 px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground';

/**
 * Marks where a row lives once the search flattens everything into one list.
 * Without it "Issues" appears once per project with nothing to tell them
 * apart, which is the state the grouped-by-project version was hiding behind
 * three headings for three rows.
 */
export function ProjectBadge({ project }: { project: CommandProject }) {
  return (
    <span className={BADGE}>
      <PlatformIcon
        platform={project.platform ?? 'other'}
        size={11}
        format="lg"
        className="shrink-0 rounded-[2px]"
      />
      <span className="max-w-28 truncate">{project.name}</span>
    </span>
  );
}

/** The counterpart for rows that belong to the instance, not to a project. */
export function ScopeBadge({ label }: { label: string }) {
  return <span className={BADGE}>{label}</span>;
}
