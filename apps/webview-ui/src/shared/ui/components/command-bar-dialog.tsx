'use client';

import { useRouter } from 'next/navigation';
import { PlatformIcon } from 'platformicons';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  type CommandLink,
  type CommandProject,
  PROJECT_COMMANDS,
  PROJECT_PAGE_COUNT,
  PROJECT_PAGES,
  PROJECT_SETTINGS_PAGES,
  type ProjectPage,
  SETTINGS_COMMANDS,
} from '@/shared/config/commands';
import { scoreCommand } from '@/shared/lib/command-score';
import { cn } from '@/shared/lib/utils';
import { useIsMobile } from '@/shared/ui/hooks/use-mobile';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from './shadcn/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './shadcn/dialog';
import { Kbd, KbdGroup } from './shadcn/kbd';

/** Every page a project has, in the order the preview column lists them. */
const PANEL_PAGES: ProjectPage[] = [
  ...PROJECT_PAGES,
  ...PROJECT_SETTINGS_PAGES,
];

/**
 * cmdk scores each rendered row through this. `value` carries the project name
 * and page, `keywords` the synonyms that never appear on screen, and both are
 * searchable.
 */
const filterCommand = (value: string, search: string, keywords?: string[]) =>
  scoreCommand([value, ...(keywords ?? [])].join(' '), search);

/**
 * How many project-page rows a search will render.
 *
 * The flattened set is every project times every page, which on a full
 * instance is a thousand rows that cmdk would mount and then rescore on each
 * keystroke. So the matching runs here first, in plain JS over strings, and
 * only the best rows are ever mounted. Nothing is lost that anyone would have
 * read: a query returning more than this many project pages is a query that
 * needed narrowing, and the static links below are never subject to the cap.
 */
const SEARCH_ROW_LIMIT = 50;

/**
 * cmdk lowercases item values and collapses their whitespace before it reports
 * the selected one, so matching a row back to its project has to normalise the
 * same way or every selection misses.
 */
const rowKey = (value: string) =>
  value.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Group headings, restyled from outside the generated component: smaller,
 * uppercase and tracked out, so a heading reads as a divider rather than as
 * another row. `**:` reaches the `[cmdk-group-heading]` element cmdk renders
 * for us, which is the only handle we get on it.
 */
const GROUP_HEADING = cn(
  '**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-3',
  '**:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:text-[11px]',
  '**:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:uppercase',
  '**:[[cmdk-group-heading]]:tracking-[0.09em]',
  '**:[[cmdk-group-heading]]:text-muted-foreground/60',
);

function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <CommandGroup heading={heading} className={cn('px-2', GROUP_HEADING)}>
      {children}
    </CommandGroup>
  );
}

/**
 * Selection styling, spelled out rather than left to the generated component.
 *
 * Two things force this. cmdk writes `data-selected="false"` on every row, and
 * Tailwind's bare `data-selected:` variant matches the attribute's *presence*,
 * so the kit's own `data-selected:bg-muted` paints the whole list and the
 * active row is indistinguishable. And `--muted` sits four points of luminance
 * from `--popover` in this theme, which is not enough to read as a highlight
 * even once only one row gets it. Hence the explicit `=true` test and the
 * primary tint.
 */
const SELECTED_ROW = cn(
  'data-[selected=false]:bg-transparent!',
  'data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary',
);

/** The square that carries a row's icon, so every row starts on the same line. */
function IconTile({
  children,
  size = 'row',
}: {
  children: ReactNode;
  size?: 'row' | 'detail';
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border transition-colors duration-100',
        'border-foreground/10 bg-foreground/5',
        'group-data-[selected=true]/command-item:border-primary/30',
        'group-data-[selected=true]/command-item:bg-primary/10',
        size === 'row' ? 'size-9' : 'size-14',
      )}
    >
      {children}
    </span>
  );
}

function Row({
  value,
  keywords,
  label,
  description,
  media,
  badge,
  onSelect,
  onHover,
  trailing,
}: {
  /** What the matcher scores against; the label alone is often too thin. */
  value: string;
  keywords?: string[];
  label: string;
  description: string;
  media: ReactNode;
  /** Where the row lives, when the list is mixing several places. */
  badge?: ReactNode;
  onSelect: () => void;
  onHover: () => void;
  trailing?: ReactNode;
}) {
  return (
    <CommandItem
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      // cmdk drives selection from the keyboard only. Without this the pointer
      // moves over a row and nothing happens, which reads as a dead list.
      onPointerMove={onHover}
      className={cn(
        'gap-3 rounded-lg px-3 py-3 transition-colors duration-100',
        SELECTED_ROW,
      )}
    >
      <IconTile>{media}</IconTile>
      {/* Takes the slack itself. Left to size on content, the free space is
          split between this row's trailing margin and the hidden CheckIcon the
          kit appends, and the trailing mark lands somewhere different on every
          row depending on how long its label is. */}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] leading-tight font-medium">
            {label}
          </span>
          {badge}
        </span>
        <span className="truncate text-xs leading-tight text-muted-foreground">
          {description}
        </span>
      </span>
      {/* `CommandShortcut` is what makes the kit hide its own trailing
          CheckIcon, which is the other half of the same alignment problem. */}
      {trailing ? (
        <CommandShortcut className="flex shrink-0 items-center gap-1.5 tracking-normal">
          {trailing}
        </CommandShortcut>
      ) : null}
    </CommandItem>
  );
}

const BADGE =
  'flex min-w-0 shrink-0 items-center gap-1 rounded-md border border-foreground/10 bg-foreground/5 px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground';

/**
 * Marks where a row lives once the search flattens everything into one list.
 * Without it "Issues" appears once per project with nothing to tell them
 * apart, which is the state the grouped-by-project version was hiding behind
 * three headings for three rows.
 */
function ProjectBadge({ project }: { project: CommandProject }) {
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
function ScopeBadge({ label }: { label: string }) {
  return <span className={BADGE}>{label}</span>;
}

/**
 * The preview column: the pages of whichever project is selected.
 *
 * It is a real focus region, not a passive readout. Tab moves into it, the
 * arrows walk it, Enter opens a page and Tab closes it again. That is the
 * whole reason the palette no longer needs a mode for "inside a project": the
 * pages are one keystroke away from the project row instead of behind a state
 * change that swapped the entire list.
 */
function ProjectPanel({
  project,
  focusIndex,
  onFocusIndexChange,
  onNavigate,
  onToggle,
}: {
  project: CommandProject;
  /** Which page holds DOM focus. The column only exists while it is set. */
  focusIndex: number | null;
  onFocusIndexChange: (index: number) => void;
  onNavigate: (href: string) => void;
  /** Tab, which closes the column and returns focus to the list. */
  onToggle: () => void;
}) {
  const base = `/projects/${project.id}`;
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // DOM focus is state this component does not own, so it is synced rather
  // than set in the handler: entering the column happens in the *input's*
  // keydown, one component up, and there is no element to focus until this
  // one has rendered.
  useEffect(() => {
    if (focusIndex !== null) itemRefs.current[focusIndex]?.focus();
  }, [focusIndex]);

  // Every branch stops the event as well as preventing it. This column lives
  // inside `Command`, whose root handles the same keys for the list below: an
  // unstopped Enter reaches it and opens whatever row the *list* had selected,
  // and an unstopped arrow moves that list while the column walks its pages.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (focusIndex === null) return;

    const step =
      event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;

    if (step !== 0) {
      event.preventDefault();
      event.stopPropagation();
      onFocusIndexChange(
        (focusIndex + step + PANEL_PAGES.length) % PANEL_PAGES.length,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onNavigate(`${base}${PANEL_PAGES[focusIndex].segment}`);
    } else if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      onToggle();
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className={cn(
        'hidden w-[18rem] shrink-0 flex-col overflow-hidden p-5 md:flex',
        // `--border` is four points of luminance off the popover here, so the
        // column is separated by its own surface, not by an invisible line.
        'border-l border-foreground/10 bg-foreground/[0.03]',
      )}
    >
      <div className="flex shrink-0 flex-col items-center gap-3 text-center">
        <IconTile size="detail">
          <PlatformIcon
            platform={project.platform ?? 'other'}
            size={32}
            format="lg"
            className="rounded-md"
          />
        </IconTile>
        <div className="flex flex-col gap-1">
          <p className="text-base leading-tight font-semibold">
            {project.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {project.platform ?? 'No platform set'}
          </p>
        </div>
      </div>

      <div className="my-5 h-px shrink-0 bg-foreground/10" />

      <p className="mb-2 shrink-0 text-[11px] font-semibold tracking-[0.09em] text-muted-foreground/60 uppercase">
        {PROJECT_PAGE_COUNT} pages
      </p>

      {/* Only the page list scrolls; the identity above it stays put. */}
      <ul className="-mx-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-2">
        {PANEL_PAGES.map((page, index) => (
          <li key={page.segment}>
            <button
              type="button"
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              // Roving focus: the column is entered deliberately with Tab and
              // walked with the arrows, so only the active page is a tab stop.
              tabIndex={focusIndex === index ? 0 : -1}
              onClick={() => onNavigate(`${base}${page.segment}`)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors duration-100 outline-none hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:text-primary"
            >
              <page.icon className="size-3.5 shrink-0 opacity-70" />
              <span className="truncate">{page.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Hint({ keys, children }: { keys: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {keys}
      {children}
    </span>
  );
}

function Footer({
  hasPreview,
  previewOpen,
}: {
  hasPreview: boolean;
  previewOpen: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-5 border-t border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-xs text-muted-foreground">
      <Hint
        keys={
          <KbdGroup>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
          </KbdGroup>
        }
      >
        navigate
      </Hint>
      <Hint keys={<Kbd>↵</Kbd>}>open</Hint>

      {hasPreview ? (
        <Hint keys={<Kbd>⇥</Kbd>}>{previewOpen ? 'hide pages' : 'pages'}</Hint>
      ) : null}

      <Hint keys={<Kbd>esc</Kbd>}>close</Hint>
    </div>
  );
}

interface CommandBarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: CommandProject[];
}

export default function CommandBarDialog({
  open,
  onOpenChange,
  projects,
}: CommandBarDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // The preview column is `md:flex`, and 768px is exactly that breakpoint.
  // Below it the column is `display: none`, where `focus()` is a no-op, so
  // every key the column claims would land nowhere.
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  /**
   * Which page of the preview column has focus, and by the same token whether
   * the column is showing at all. There is no state for "open but not focused"
   * because Tab is the only way in or out and it always lands inside.
   */
  const [panelIndex, setPanelIndex] = useState<number | null>(null);
  const panelIndexRef = useRef<number | null>(null);

  // Seeded with the top row rather than empty. cmdk is controlled here, and a
  // controlled value matching no row leaves *nothing* highlighted instead of
  // falling back to the first one, so an empty initial value would open the
  // palette with a dead list.
  const [selected, setSelected] = useState(
    () => projects[0]?.name ?? PROJECT_COMMANDS[0].label,
  );

  // Only a project row can be previewed, and its row value is its name.
  const selectedProject = useMemo(() => {
    const key = rowKey(selected);
    return projects.find((project) => rowKey(project.name) === key) ?? null;
  }, [projects, selected]);

  // Derived rather than stored, so a selection that stops being a project --
  // or a viewport that drops below `md` mid-session -- takes the column with
  // it without an effect chasing it.
  const canPreview = selectedProject !== null && !isMobile;
  const showPreview = canPreview && panelIndex !== null;

  // Nothing to tear down on the way out: `CommandBar` keys this component on
  // the open count, so the next open is a new instance and every piece of
  // state below starts from its initial value again.
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  /**
   * Mirrored into a ref because the keyboard reads it back in the same task it
   * writes it: two keys pressed inside one frame both run against the render
   * that preceded them, and a handler reading `panelIndex` from its closure
   * would still see the value from before the previous keystroke. State drives
   * the rendering, the ref answers "where am I now".
   */
  const movePanel = (index: number | null) => {
    panelIndexRef.current = index;
    setPanelIndex(index);
  };

  // Tab is the only way in and out of the column, so it is also the only thing
  // that decides whether the column exists.
  const togglePanel = () => {
    if (panelIndexRef.current !== null) {
      movePanel(null);
      inputRef.current?.focus();
    } else {
      movePanel(0);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // `isMobile` as well as the selection: below `md` there is no column to
    // enter, and claiming Tab there would strand `panelIndexRef` non-null and
    // route every subsequent arrow and Enter into a hidden subtree, which
    // reads as the visible list having died.
    if (!selectedProject || isMobile) return;

    // DOM focus reaches the column one render after `panelIndex` is set, so a
    // quick second keystroke still arrives here. Routing by intent rather than
    // by where focus happens to sit means entering the column never eats the
    // key that follows it. cmdk listens on its own root above this input, so
    // these have to stop bubbling or the list would move as well.
    const current = panelIndexRef.current;

    if (current !== null) {
      const step =
        event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;

      if (step !== 0) {
        event.preventDefault();
        event.stopPropagation();
        movePanel((current + step + PANEL_PAGES.length) % PANEL_PAGES.length);
      } else if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        togglePanel();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        go(`/projects/${selectedProject.id}${PANEL_PAGES[current].segment}`);
      }
      return;
    }

    // Safe to take: a project row is only ever selected with an empty query,
    // so no caret is being moved, and the input is the palette's single tab
    // stop. Shift+Tab is left alone.
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      togglePanel();
    }
  };

  // Collapsed at rest, flattened while searching. A project is one row until
  // the viewer types, at which point every project's pages become candidates
  // and the list only gets long once a query is there to make it short again.
  const searching = query.trim().length > 0;

  /**
   * The project pages a query matches, best first and capped.
   *
   * Scored here rather than handed to cmdk row by row. It is the same function
   * cmdk would have called through `filter`, over the same string, so the rows
   * that survive are exactly the rows it would have kept and it still does the
   * final ordering -- the difference is that the thousand that do not survive
   * were never mounted. See `SEARCH_ROW_LIMIT`.
   */
  const matches = useMemo(() => {
    if (query.trim().length === 0) return [];

    const scored: {
      project: CommandProject;
      page: ProjectPage;
      value: string;
      score: number;
    }[] = [];

    for (const project of projects) {
      for (const page of PANEL_PAGES) {
        const value = `${project.name} ${page.label}`;
        const score = filterCommand(value, query, page.keywords);
        if (score > 0) scored.push({ project, page, value, score });
      }
    }

    // Stable, so projects that score alike stay in the order they arrived.
    return scored.sort((a, b) => b.score - a.score).slice(0, SEARCH_ROW_LIMIT);
  }, [projects, query]);

  // Only ever rendered by the search, where every project's pages sit in one
  // list, so the badge is unconditional: without it "Issues" appears once per
  // project with nothing to tell the rows apart.
  const pageRow = (
    project: CommandProject,
    page: ProjectPage,
    value: string,
  ) => (
    <Row
      key={`${project.id}${page.segment}`}
      value={value}
      keywords={page.keywords}
      label={page.label}
      description={page.description}
      badge={<ProjectBadge project={project} />}
      media={<page.icon className="size-[18px] text-muted-foreground" />}
      onSelect={() => go(`/projects/${project.id}${page.segment}`)}
      onHover={() => panelIndex === null && setSelected(value)}
    />
  );

  const linkRows = (links: CommandLink[], badgeLabel?: string) =>
    links.map((link) => (
      <Row
        key={link.href}
        value={link.label}
        keywords={link.keywords}
        label={link.label}
        description={link.description}
        badge={badgeLabel ? <ScopeBadge label={badgeLabel} /> : undefined}
        media={<link.icon className="size-[18px] text-muted-foreground" />}
        onSelect={() => go(link.href)}
        onHover={() => panelIndex === null && setSelected(link.label)}
      />
    ));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[10vh] w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden rounded-xl! p-0 sm:max-w-[52rem]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command bar</DialogTitle>
        <DialogDescription className="sr-only">
          Search projects, pages and settings, then press enter to open one.
        </DialogDescription>

        <Command
          loop
          filter={filterCommand}
          value={selected}
          onValueChange={setSelected}
          className="p-0"
        >
          <div
            className={cn(
              'flex shrink-0 items-center gap-2 p-3',
              '*:data-[slot=command-input-wrapper]:min-w-0',
              '*:data-[slot=command-input-wrapper]:flex-1',
              '*:data-[slot=command-input-wrapper]:p-0',
            )}
          >
            <CommandInput
              ref={inputRef}
              // Base UI parks focus on the dialog popup itself, and cmdk
              // listens for arrow keys on its own root below that, so without
              // this the palette opens with a dead keyboard. Enough on its own
              // now that every open is a fresh mount.
              autoFocus
              value={query}
              onValueChange={setQuery}
              onKeyDown={handleKeyDown}
              className="h-10! text-[15px]!"
              placeholder="Search projects, pages and settings..."
            />
          </div>

          {/* Fixed height so the list does not resize under the selection as
              it shortens with the query. */}
          <div className="flex h-[30rem] min-h-0 border-t border-foreground/10">
            <CommandList className="max-h-none min-w-0 flex-1 p-2">
              <CommandEmpty className="px-4 py-16 text-center text-sm text-muted-foreground">
                No results for “{query.trim()}”
              </CommandEmpty>

              {searching ? (
                // One flat, relevance-ordered list. Grouping by project here
                // spends a heading on every match, which for a query that hits
                // one page per project is three headings for three rows.
                <Section heading="Results">
                  {matches.map(({ project, page, value }) =>
                    pageRow(project, page, value),
                  )}
                  {linkRows(PROJECT_COMMANDS, 'General')}
                  {linkRows(SETTINGS_COMMANDS, 'Settings')}
                </Section>
              ) : (
                <>
                  <Section heading="Projects">
                    {projects.map((project) => (
                      <Row
                        key={project.id}
                        value={project.name}
                        keywords={['project', project.platform ?? '']}
                        label={project.name}
                        description={`${project.platform ?? 'No platform'} · ${PROJECT_PAGE_COUNT} pages`}
                        media={
                          <PlatformIcon
                            platform={project.platform ?? 'other'}
                            size={20}
                            format="lg"
                            className="rounded-[3px]"
                          />
                        }
                        // Enter goes to the project, like every other row goes
                        // to its page. Its pages are one Tab away instead of
                        // behind a mode that replaced the whole list.
                        onSelect={() => go(`/projects/${project.id}`)}
                        onHover={() =>
                          panelIndex === null && setSelected(project.name)
                        }
                        // Advertises the shortcut on the row it applies to,
                        // which is the only place anyone would look for it.
                        trailing={
                          <Kbd className="opacity-0 transition-opacity duration-100 group-data-[selected=true]/command-item:opacity-100">
                            ⇥
                          </Kbd>
                        }
                      />
                    ))}
                    {linkRows(PROJECT_COMMANDS)}
                  </Section>

                  <Section heading="Settings">
                    {linkRows(SETTINGS_COMMANDS)}
                  </Section>
                </>
              )}
            </CommandList>

            {showPreview && selectedProject ? (
              <ProjectPanel
                project={selectedProject}
                focusIndex={panelIndex}
                onFocusIndexChange={movePanel}
                onNavigate={go}
                onToggle={togglePanel}
              />
            ) : null}
          </div>

          {/* `canPreview`, so the hint is not advertising a Tab that does
              nothing on the viewports where the column cannot open. */}
          <Footer hasPreview={canPreview} previewOpen={showPreview} />
        </Command>
      </DialogContent>
    </Dialog>
  );
}
