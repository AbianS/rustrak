import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { focusRing } from '../../lib/focus';
import { interactiveTransition, pressScaleSmall } from '../../lib/motion';
import { tv } from '../../lib/tv';
import { Avatar } from '../avatar/avatar';
import { Count } from '../count/count';
import type { IconComponent } from '../icon/icon';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SelectorIcon,
} from '../icon/icon-catalog';
import { Kbd } from '../kbd/kbd';
import { Text } from '../text/text';
import { Tooltip } from '../tooltip/tooltip';
import { useSidebar } from './sidebar-context';

/**
 * The sidebar: 216 px open, a 56 px rail collapsed.
 *
 * It holds two things and nothing else: which project you are in, and the seven
 * routes inside it. Earlier passes also carried an environment selector and a
 * quota block at the foot; both went, because a navigation column that also
 * holds controls stops being scannable and the routes are what people come here
 * to click. Anything that is a control belongs on the page it controls.
 *
 * There is no scrolling and no accordion, because seven rows never need either.
 * That is a property of this product rather than a rule -- if the route list
 * ever grows past a screen, it needs sections, and sections need a design pass.
 *
 * The active row is marked by a filled background and by weight: two signals,
 * because one of them being colour would leave out anyone who cannot pick lime
 * out of grey. An earlier version added a lime bar down the left edge as a
 * third; it went, because with only seven rows there is nothing to hunt for.
 */
const sidebar = tv({
  base: [
    'flex w-sidebar shrink-0 flex-col border-e border-border-subtle bg-panel',
    // Collapsing covers 160 px: the longest distance in the system, so it gets
    // the longest duration the system uses day to day.
    'transition-[width] duration-slow ease-standard',
    /*
     * On a phone it stops taking up space and becomes a drawer over the
     * content. At 375 px wide, a permanent 216 px of navigation would leave
     * 159 px for the issue, and the 56 px rail is no better: seven unlabelled
     * icons with no tooltip -- because there is no pointer to hover with -- are
     * not navigation, they are a guessing game.
     *
     * It moves with `translate`, which is the only thing that does not force
     * the browser to lay the page out on every frame, and here it shows: this
     * is the largest animation anyone sees on a phone.
     */
    'max-md:fixed max-md:inset-y-0 max-md:start-0 max-md:z-40',
    'max-md:shadow-overlay',
    /*
     * `visibility` rides in the transition alongside the movement, and it is
     * not decoration: it is what takes a closed drawer out of the tab order.
     * The browser changes it last when hiding and first when showing, so the
     * drawer is seen leaving in full and still leaves nothing focusable off
     * screen.
     *
     * `translate`, not `transform`: Tailwind 4 compiles `-translate-x-full` to
     * the individual property, so naming `transform` here would transition
     * nothing and the drawer would teleport. See `lib/motion.ts`.
     */
    'max-md:transition-[translate,visibility] max-md:duration-slow',
    'max-md:not-data-drawer-open:invisible',
    'max-md:not-data-drawer-open:-translate-x-full',
    // Crossing the breakpoint animates nothing: motion is for what somebody
    // asked for, not for what falls out of a resize.
    'data-switching:transition-none',
  ],
  variants: {
    // The collapsed width only exists from tablet up. On a phone the sidebar is
    // always the same width: it is either there or it is not.
    collapsed: { true: 'md:w-sidebar-rail', false: 'md:w-sidebar' },
  },
});

export interface SidebarProps extends ComponentPropsWithoutRef<'nav'> {
  /** The project card, above the routes and outside the scroll. */
  header?: ReactNode;
  /** Pinned to the bottom. Usually the collapse button. */
  footer?: ReactNode;
}

export function Sidebar({
  className,
  header,
  children,
  footer,
  ...props
}: SidebarProps) {
  const { collapsed, drawerOpen, switching } = useSidebar();

  return (
    <nav
      aria-label="Main navigation"
      data-collapsed={collapsed || undefined}
      data-drawer-open={drawerOpen || undefined}
      data-switching={switching || undefined}
      className={sidebar({ collapsed, className })}
      {...props}
    >
      {header ? (
        <div
          className={cn(
            'shrink-0 border-b border-border-muted p-2.5',
            collapsed && 'flex justify-center px-0',
          )}
        >
          {header}
        </div>
      ) : null}

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-px overflow-y-auto p-2.5',
          collapsed && 'items-center gap-0.5 px-0',
        )}
      >
        {children}
      </div>

      {footer ? (
        <div className="shrink-0 border-t border-border-muted p-2.5">
          {footer}
        </div>
      ) : null}
    </nav>
  );
}

Sidebar.displayName = 'Sidebar';

const projectCard = tv({
  base: [
    'flex w-full items-center gap-2.5 rounded-lg border border-border-raised',
    'bg-surface-raised text-start',
    'hover:border-border-strong',
    interactiveTransition,
    focusRing,
  ],
  variants: {
    collapsed: {
      /* The same square as a rail row: collapsed, the project card is one
         more item in that column and has to line up with the seven below it. */
      true: 'size-rail-item justify-center p-0',
      false: 'h-project-card px-2.5',
    },
  },
});

export interface SidebarProjectProps
  extends Omit<useRender.ComponentProps<'button'>, 'children'> {
  /** The project. */
  name: string;
  /** The organisation it belongs to. */
  organisation?: string;
  /** The platform code inside the tile: `JS`, `PY`, `RS`. */
  platform?: string;
}

/**
 * The project card at the head of the sidebar, and the way to switch project.
 *
 * It is a card and not a row because it is not one of the routes: it says what
 * the seven rows underneath it are *about*. Wrap it in a `Menu` to make it
 * switch.
 *
 * Collapsed it keeps only the platform tile. The tile is the one part that
 * survives, because a two-letter code is the only thing in the card that is
 * still legible at 34 px.
 */
export function SidebarProject({
  name,
  organisation,
  platform,
  className,
  render,
  ...props
}: SidebarProjectProps) {
  const { collapsed } = useSidebar();

  const element = useRender({
    defaultTagName: 'button',
    render,
    props: mergeProps<'button'>(
      {
        type: 'button',
        className: projectCard({ collapsed, className }),
        ...(collapsed
          ? {
              'aria-label': organisation ? `${name} · ${organisation}` : name,
              children: (
                <Avatar
                  shape="square"
                  size="md"
                  name={name}
                  initials={platform}
                  className="border-0 bg-transparent text-fg-tertiary"
                />
              ),
            }
          : {
              children: (
                <>
                  <Avatar
                    shape="square"
                    size="md"
                    name={name}
                    initials={platform}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Text variant="control" truncate className="font-semibold">
                      {name}
                    </Text>
                    {organisation ? (
                      <Text variant="hint" tone="meta" truncate>
                        {organisation}
                      </Text>
                    ) : null}
                  </span>
                  <SelectorIcon size="md" className="shrink-0 text-fg-ghost" />
                </>
              ),
            }),
      },
      props,
    ),
  });

  if (collapsed) {
    return (
      <Tooltip content={name} side="right">
        {element}
      </Tooltip>
    );
  }

  return element;
}

SidebarProject.displayName = 'SidebarProject';

const row = tv({
  base: [
    'relative flex h-nav-item w-full items-center gap-2.5 rounded-md px-2.5',
    'text-value text-fg-muted',
    'hover:bg-surface-hover hover:text-fg-secondary',
    /*
     * The height is not negotiable.
     *
     * The scroll area is a flex column and its children shrink by default: the
     * moment the list runs past the bottom, a row would give up its 32 px and
     * the hover background would come out thinner than its neighbours.
     */
    'shrink-0',
    interactiveTransition,
    // A nav row does not sink on press: it is 32 px, and shrinking it reads as
    // a flicker. The background arriving already says it was pressed.
    focusRing,
  ],
  variants: {
    active: { true: 'bg-surface-selected font-semibold text-fg' },
  },
});

const railRow = tv({
  base: [
    'relative flex h-rail-item w-rail-item-w shrink-0 items-center',
    'justify-center rounded-md text-fg-muted',
    'hover:bg-surface-hover hover:text-fg-secondary',
    interactiveTransition,
    pressScaleSmall,
    focusRing,
  ],
  variants: {
    active: { true: 'bg-surface-selected text-fg' },
  },
});

export interface SidebarItemProps
  extends Omit<useRender.ComponentProps<'a'>, 'children'> {
  icon: IconComponent;
  label: string;
  /** How many are open. Zero is not drawn. */
  count?: number | string;
  active?: boolean;
}

/**
 * A route.
 *
 * With `render` the element changes without losing the look, which is how a
 * router's link is plugged in: `render={<Link to="/issues" />}`.
 *
 * Collapsed it becomes a rail item and the label moves into a tooltip, which is
 * the only way to keep the name without the width. The count moves too -- into
 * a lime dot, because a four-digit number does not fit in 36 px and "there is
 * something here" is the part that survives the loss.
 */
export function SidebarItem({
  icon: Icon,
  label,
  count,
  active,
  className,
  render,
  ...props
}: SidebarItemProps) {
  const { collapsed } = useSidebar();
  const hasCount = count != null && count !== 0 && count !== '';

  const element = useRender({
    defaultTagName: 'a',
    render,
    props: mergeProps<'a'>(
      {
        'aria-current': active ? 'page' : undefined,
        ...(collapsed
          ? {
              'aria-label': label,
              className: railRow({ active, className }),
              children: (
                <>
                  <Icon size="xl" />
                  {hasCount ? (
                    <span
                      aria-hidden="true"
                      className="absolute end-1.5 top-1.5 size-dot rounded-pill bg-surface-brand"
                    />
                  ) : null}
                </>
              ),
            }
          : {
              className: row({ active, className }),
              children: (
                <>
                  <Icon size="lg" className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <Count>{count}</Count>
                </>
              ),
            }),
      },
      props,
    ),
  });

  if (collapsed) {
    return (
      <Tooltip content={hasCount ? `${label} · ${count}` : label} side="right">
        {element}
      </Tooltip>
    );
  }

  return element;
}

SidebarItem.displayName = 'SidebarItem';

/** The collapse button, and its shortcut. */
export function SidebarCollapseButton() {
  const { collapsed, toggle } = useSidebar();
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const Icon = collapsed ? ChevronRightIcon : ChevronLeftIcon;

  const button = (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-expanded={!collapsed}
      className={cn(
        'flex h-control-sm items-center gap-2.5 rounded-md px-2.5',
        'text-meta text-fg-meta',
        'hover:bg-surface-hover hover:text-fg-secondary',
        interactiveTransition,
        collapsed ? 'mx-auto w-rail-item-w justify-center px-0' : 'w-full',
        focusRing,
      )}
    >
      <Icon size="md" className="shrink-0" />
      {collapsed ? null : (
        <>
          <span className="min-w-0 flex-1 truncate text-start">{label}</span>
          <Kbd>⌘B</Kbd>
        </>
      )}
    </button>
  );

  /* On a phone there is no rail to collapse to, so the button says nothing:
     the drawer closes by tapping outside, with Escape, or by picking a route. */
  return (
    <div className="max-md:hidden">
      {collapsed ? (
        <Tooltip content={`${label} (⌘B)`} side="right">
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </div>
  );
}

SidebarCollapseButton.displayName = 'SidebarCollapseButton';
