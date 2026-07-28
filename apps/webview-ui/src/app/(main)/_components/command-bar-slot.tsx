import { getProjects } from '@/features/project/api/queries';
import { toCommandProjects } from '@/features/project/lib/command-items';
import CommandBar from '@/shared/ui/components/command-bar';

/**
 * Composition seam for the command bar: it spans the `project` slice and the
 * static settings routes, so neither feature can own it and it is assembled
 * here instead.
 *
 * The projects read happens on the server, which is why the bar takes its
 * commands as a prop rather than fetching them from an effect. A failed read
 * still renders the bar: the static commands are the bulk of it, and a search
 * box that silently disappears is worse than one missing project entries.
 */
export async function CommandBarSlot() {
  const result = await getProjects({ per_page: 100 });
  const projects = result.success ? result.data.items : [];

  return <CommandBar projects={toCommandProjects(projects)} />;
}
