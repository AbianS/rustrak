import type { Project } from '@rustrak/client';
import type { Translator } from '@rustrak/i18n';
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  OkIcon,
  SidebarProject,
  Text,
} from '@rustrak/ui';
import { Link } from '@tanstack/react-router';
import { PlatformMark } from '../projects/platform-mark';

interface ProjectSwitcherProps {
  current: Project;
  projects: readonly Project[];
  t: Translator;
}

/**
 * The card at the head of the sidebar, and the way out of the project you are
 * in without going back to the list.
 *
 * The list it opens is the whole point: an error tracker is a place you move
 * between projects all day, and a switcher that only says which one you are in
 * costs a round trip through `/projects` every time. The current one is ticked
 * rather than left out -- a list that silently omits one item reads as a list
 * that is missing something.
 *
 * There is no search field in it. A menu popup owns its printable keys for
 * typeahead, so a field inside one fights the menu for every character; past a
 * screenful of projects the answer is `/projects`, which is a page built to be
 * searched and is the last row here.
 */
export function ProjectSwitcher({
  current,
  projects,
  t,
}: ProjectSwitcherProps) {
  return (
    <Menu
      align="start"
      // The card is the sidebar's width less its padding; the panel matches it
      // rather than sizing to the longest name, so opening it shifts nothing.
      popupClassName="w-64"
      side="bottom"
      trigger={
        <SidebarProject
          caption={current.slug}
          mark={<PlatformMark platform={current.platform} size={26} />}
          name={current.name}
        />
      }
    >
      <MenuGroup label={t.t('projectOverview.switcherHeading')}>
        {projects.map((project) => (
          <MenuItem
            key={project.id}
            className="h-project-card"
            render={
              <Link params={{ id: String(project.id) }} to="/projects/$id" />
            }
          >
            <PlatformMark platform={project.platform} size={22} />
            <span className="flex min-w-0 flex-1 flex-col">
              <Text truncate variant="control">
                {project.name}
              </Text>
              <Text tone="meta" truncate variant="hint">
                {project.slug}
              </Text>
            </span>
            {project.id === current.id ? (
              <OkIcon className="shrink-0 text-fg-brand" size="md" />
            ) : null}
          </MenuItem>
        ))}
      </MenuGroup>

      <MenuSeparator />

      <MenuItem render={<Link to="/projects" />}>
        {t.t('projectOverview.switcherAll')}
      </MenuItem>
    </Menu>
  );
}
