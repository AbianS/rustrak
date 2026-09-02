import { getProjects } from '@/features/project/api/queries';
import { toCommandProjects } from '@/features/project/lib/command-items';
import { COMMAND_BAR_PROJECT_LIMIT } from '@/shared/config/commands';
import { CommandBar } from '@/shared/ui/components/command-bar/command-bar';

/**
 * Composition seam for the command bar: it spans the `project` slice and the
 * static settings routes, so neither feature can own it and it is assembled
 * here instead.
 *
 * The projects read happens on the server, which is why the bar takes its
 * commands as a prop rather than fetching them from an effect. A failed read
 * still renders the bar: the static commands are the bulk of it, and a search
 * box that silently disappears is worse than one missing project entries.
 *
 * One page, on purpose: see `COMMAND_BAR_PROJECT_LIMIT` for why the bar has a
 * stated ceiling instead of paging until the instance runs out.
 */
export async function CommandBarSlot() {
  const result = await getProjects({ per: COMMAND_BAR_PROJECT_LIMIT });
  const projects = result.success ? result.data.items : [];

  return <CommandBar projects={toCommandProjects(projects)} />;
}
