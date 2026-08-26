import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { focusRing } from '../../lib/focus';
import {
  chevronFlip,
  interactiveTransition,
  pressScaleSmall,
  pressScaleTrigger,
} from '../../lib/motion';
import { tv } from '../../lib/tv';
import { Avatar } from '../avatar/avatar';
import { Wordmark } from '../brand/wordmark';
import type { IconComponent } from '../icon/icon';
import { ChevronDownIcon, SearchIcon } from '../icon/icon-catalog';
import { Kbd } from '../kbd/kbd';
import { Menu, MenuActions } from '../menu/menu';
import type { MenuAction } from '../menu/menu-parts';
import { Separator } from '../separator/separator';
import { Text } from '../text/text';

/**
 * The topbar: 48 px, full width, fixed. Identity on the left, everything global
 * on the right.
 *
 * What belongs here is what does not change when you change project: the mark,
 * the organisation, search, notifications, the account. The project itself
 * lives in the sidebar, which is where it can be switched next to the routes it
 * governs. That split is the whole reason the bar is this quiet -- an earlier
 * pass put the environment selector up here too, and the bar stopped reading as
 * a frame and started reading as a control panel.
 */
const topbar = tv({
  base: [
    'flex h-topbar w-full shrink-0 items-center justify-between gap-4',
    'border-b border-border bg-surface px-5',
    'max-md:px-3',
  ],
});

export interface TopbarProps extends ComponentPropsWithoutRef<'header'> {
  brand?: ReactNode;
  actions?: ReactNode;
  /**
   * What opens the navigation on a phone. Only visible below `md`, which is
   * where the sidebar stops being on screen permanently.
   */
  menu?: ReactNode;
}

export function Topbar({
  brand,
  actions,
  menu,
  className,
  ...props
}: TopbarProps) {
  return (
    <header className={topbar({ className })} {...props}>
      <div className="flex min-w-0 items-center gap-3.5">
        {menu}
        {brand}
      </div>

      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  );
}

Topbar.displayName = 'Topbar';

export interface TopbarBrandProps
  extends Omit<useRender.ComponentProps<'a'>, 'children'> {}

/**
 * The mark, and nothing else.
 *
 * The left of the topbar holds one thing. An earlier pass put the organisation
 * and its switcher next to it, and it went for the same reason the environment
 * selector went from the sidebar: the moment a frame holds a control, the frame
 * stops being a frame. Which project you are in is said by the sidebar, right
 * above the routes it governs; which organisation, by the account menu on the
 * right. Neither belongs beside the logo.
 *
 * With `render={<Link to="/" />}` it becomes the way home, which is what
 * everyone tries when they click a logo.
 *
 * The mark is never typed as text and never sits in a box -- both rules travel
 * with the artwork, in `brand/wordmark.tsx`. The clear space around it is this
 * component's job, which is why the gap lives on `Topbar` and not here.
 */
export function TopbarBrand({ className, render, ...props }: TopbarBrandProps) {
  return useRender({
    defaultTagName: 'a',
    render,
    props: mergeProps<'a'>(
      {
        'aria-label': 'Rustrak',
        className: cn(
          'flex shrink-0 items-center rounded-xs text-fg',
          'hover:text-fg-secondary',
          interactiveTransition,
          focusRing,
          className,
        ),
        children: <Wordmark className="h-wordmark w-auto" />,
      },
      props,
    ),
  });
}

TopbarBrand.displayName = 'TopbarBrand';

export interface TopbarSearchProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  placeholder?: string;
  /** The shortcut that opens it, drawn at the end of the field. */
  shortcut?: string;
}

/**
 * Global search.
 *
 * It is a button, not an `input`: it does not search in place, it opens the
 * command palette. Faking a text field that jumps somewhere else the moment you
 * type disorients anyone navigating by keyboard.
 *
 * It does not sink on press, and it is the one exception to the press rule: it
 * is 260 px wide, so a 3 % squeeze is 8 px of travel and reads as the bar
 * coming apart. What acknowledges the press is the palette opening on top of
 * it, which is a far clearer answer than any sink.
 */
export function TopbarSearch({
  placeholder,
  shortcut = '⌘K',
  className,
  ...props
}: TopbarSearchProps) {
  return (
    <button
      type="button"
      /* On a phone the label is hidden, and hidden text is read by nobody:
         the accessible name lives on the element itself, always. */
      aria-label={placeholder}
      className={cn(
        'flex h-control-sm w-search max-w-full items-center justify-between',
        'gap-2 rounded-md border border-border bg-canvas px-2.25',
        'text-control text-fg-ghost',
        'hover:border-border-strong hover:text-fg-subtle',
        interactiveTransition,
        focusRing,
        /*
         * On a phone it shrinks to its icon: one more round button on the
         * right, the same size as its neighbours. `size-control-sm` sets both
         * axes, but the field's width has to be disarmed first or it wins and
         * the button comes out tall and narrow.
         */
        'max-md:size-control-sm max-md:w-auto max-md:justify-center',
        'max-md:px-0',
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-2">
        <SearchIcon size="md" className="max-md:size-icon-xl" />
        <span className="min-w-0 truncate text-start max-md:hidden">
          {placeholder}
        </span>
      </span>
      <Kbd className="max-md:hidden">{shortcut}</Kbd>
    </button>
  );
}

TopbarSearch.displayName = 'TopbarSearch';

export interface TopbarActionProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  icon: IconComponent;
  /** What it does. Required: the action carries no visible text. */
  'aria-label': string;
  /** How many are waiting. Zero is not drawn. */
  count?: number;
}

/**
 * A topbar action: notifications, help.
 *
 * The counter is a lime dot rather than a number. In 48 px of height there is
 * no room for a legible figure on top of a 15 px icon, and the figure was never
 * the point -- what the bell has to say is "there is something", and how many
 * is a question the panel answers.
 */
export function TopbarAction({
  icon: Icon,
  count,
  className,
  ...props
}: TopbarActionProps) {
  return (
    <button
      type="button"
      className={cn(
        'relative flex size-control-sm shrink-0 items-center justify-center',
        'rounded-md text-fg-subtle',
        'hover:bg-surface-hover hover:text-fg',
        interactiveTransition,
        pressScaleSmall,
        focusRing,
        className,
      )}
      {...props}
    >
      <Icon size="xl" />

      {count != null && count > 0 ? (
        <span
          aria-hidden="true"
          className={cn(
            'absolute end-1.5 top-1.5 size-dot rounded-pill bg-surface-brand',
          )}
        />
      ) : null}
    </button>
  );
}

TopbarAction.displayName = 'TopbarAction';

const user = tv({
  slots: {
    trigger: [
      'group flex shrink-0 items-center gap-1 rounded-pill p-0.5',
      interactiveTransition,
      pressScaleTrigger,
      'hover:bg-surface-hover',
      // While the menu is open the pill stays marked: it is what says where
      // the panel underneath came from.
      'data-popup-open:bg-surface-hover',
      focusRing,
    ],
    chevron: ['shrink-0 text-fg-ghost', chevronFlip],
    popup: 'w-64 max-w-(--available-width) p-1.5',
    header: 'flex items-center gap-2.5 px-2.5 pt-2.5 pb-3',
    footer: [
      'flex items-center justify-between gap-3 px-2.5 pt-2 pb-1',
      'font-mono text-mono-sm text-fg-ghost',
    ],
    footerItem: 'min-w-0 truncate',
  },
});

const userStyles = user();

export interface TopbarUserProps {
  name: string;
  email?: string;
  src?: string;
  /** What can be done from here. Sign out goes last and separated. */
  actions: MenuAction[];
  /** The build. Not an action: it is what you read out over the phone. */
  version?: string;
}

/**
 * The account.
 *
 * It carries a chevron because a bare avatar does not say there is anything
 * behind it. Inside, the first thing is who you are, and the last thing,
 * separated, is leaving.
 */
export function TopbarUser({
  name,
  email,
  src,
  actions,
  version,
}: TopbarUserProps) {
  return (
    <Menu
      align="end"
      popupClassName={userStyles.popup()}
      trigger={
        <button
          type="button"
          aria-label={`Account: ${name}`}
          className={userStyles.trigger()}
        >
          <Avatar name={name} src={src} />
          <ChevronDownIcon
            size="sm"
            aria-hidden="true"
            className={userStyles.chevron()}
          />
        </button>
      }
    >
      <div className={userStyles.header()}>
        <Avatar name={name} src={src} size="md" />

        {/* `min-w-0` on the column and `w-full` on each line: that is what lets
            a long address clip instead of widening the panel. */}
        <span className="flex min-w-0 flex-1 flex-col items-start">
          <Text variant="card-title" truncate className="w-full">
            {name}
          </Text>
          {email ? (
            <Text variant="meta" tone="meta" truncate className="w-full">
              {email}
            </Text>
          ) : null}
        </span>
      </div>

      <Separator className="mx-2 mb-1.5" />

      <MenuActions actions={actions} />

      {version ? (
        <>
          <Separator className="mx-2 mt-1.5" />
          <div className={userStyles.footer()}>
            <span className={userStyles.footerItem()}>{version}</span>
          </div>
        </>
      ) : null}
    </Menu>
  );
}

TopbarUser.displayName = 'TopbarUser';
