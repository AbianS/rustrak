import { Menu as Base } from '@base-ui/react/menu';
import { cn } from '../../lib/cn';
import { popTransition } from '../../lib/motion';
import { tv, type VariantProps } from '../../lib/tv';
import type { IconComponent } from '../icon/icon';

/**
 * A list of actions behind a trigger: the row overflow, the project switcher,
 * the bulk actions on a selection.
 *
 * Re-exported as parts rather than wrapped in a single `items={[...]}` prop.
 * An array API looks tidy until the first separator, the first submenu and the
 * first item that needs a badge, at which point it grows a `type` discriminator
 * and becomes a worse version of JSX. Base UI already composes; this only
 * supplies the styling and keeps the trigger unstyled so any `Button` can be it.
 *
 * Keyboard behaviour, focus return, typeahead and the escape/outside-click
 * contract all come from Base UI and are not re-implemented here.
 */

const menu = tv({
  slots: {
    popup: [
      'min-w-40 origin-(--transform-origin) rounded-lg p-1',
      'bg-surface-floating shadow-overlay inset-ring inset-ring-border-subtle',
      'outline-none',
    ],
    item: [
      // No `cursor-*` here. `styles/base.css` gives every `[role="menuitem"]`
      // a pointer at zero specificity, and a utility on the element would beat
      // it. Writing `cursor-default` here was doing exactly that.
      'flex items-center gap-2 rounded-md px-2 py-1.5',
      'text-control text-fg-secondary select-none',
      'transition-[color,background-color] duration-instant ease-standard',
      // State comes from the DOM, not from props threaded down: Base UI marks
      // the item the keyboard is on with `data-highlighted`, and hover and
      // keyboard therefore look identical without any state to keep in sync.
      'data-highlighted:bg-surface-hover data-highlighted:text-fg',
      'data-disabled:text-fg-disabled data-disabled:pointer-events-none',
      'outline-none',
    ],
    separator: 'my-1 h-px bg-border',
    groupLabel: 'px-2 py-1 font-mono text-column uppercase text-fg-muted',
  },
  variants: {
    tone: {
      default: {},
      /** Destructive. Reads as danger before it is read as a word. */
      danger: {
        item: [
          'text-fg-error',
          'data-highlighted:bg-surface-error data-highlighted:text-fg-fatal',
        ],
      },
    },
  },
  defaultVariants: { tone: 'default' },
});

const { popup, item, separator, groupLabel } = menu();

/** Groups the parts. Renders no element of its own. */
export const MenuRoot = Base.Root;

/**
 * The control that opens it. Left unstyled on purpose so a `Button` can be
 * passed through `render` and keep every one of its own variants.
 */
export const MenuTrigger = Base.Trigger;

export type MenuItemTone = NonNullable<VariantProps<typeof menu>['tone']>;

export interface MenuContentProps
  extends React.ComponentProps<typeof Base.Popup> {
  /** @default 'bottom' */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** @default 'start' */
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

/**
 * The panel. Bundles Portal, Positioner and Popup because those three are
 * always used together and getting the order wrong is a silent positioning bug
 * rather than an error.
 */
export function MenuContent({
  side = 'bottom',
  align = 'start',
  sideOffset = 6,
  className,
  children,
  ...props
}: MenuContentProps) {
  return (
    <Base.Portal>
      <Base.Positioner side={side} align={align} sideOffset={sideOffset}>
        <Base.Popup
          className={cn(popup(), popTransition, className)}
          {...props}
        >
          {children}
        </Base.Popup>
      </Base.Positioner>
    </Base.Portal>
  );
}

MenuContent.displayName = 'MenuContent';

export interface MenuItemProps extends React.ComponentProps<typeof Base.Item> {
  tone?: MenuItemTone;
  /**
   * Drawn before the label.
   *
   * It inherits the item's colour rather than taking one of its own, so a
   * danger item's icon turns with its text and the highlighted state does not
   * leave a grey glyph next to red words.
   */
  icon?: IconComponent;
}

export function MenuItem({
  tone,
  icon: Icon,
  className,
  children,
  ...props
}: MenuItemProps) {
  return (
    <Base.Item className={cn(menu({ tone }).item(), className)} {...props}>
      {Icon ? <Icon size="md" /> : null}
      {children}
    </Base.Item>
  );
}

MenuItem.displayName = 'MenuItem';

/**
 * An item that navigates. A real anchor, so middle-click, copy-link and
 * open-in-new-tab all work; an item with an `onClick` that calls the router
 * takes those away for no gain.
 */
export interface MenuLinkItemProps
  extends React.ComponentProps<typeof Base.LinkItem> {
  icon?: IconComponent;
}

export function MenuLinkItem({
  icon: Icon,
  className,
  children,
  ...props
}: MenuLinkItemProps) {
  return (
    <Base.LinkItem className={cn(item(), className)} {...props}>
      {Icon ? <Icon size="md" /> : null}
      {children}
    </Base.LinkItem>
  );
}

MenuLinkItem.displayName = 'MenuLinkItem';

export function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Base.Separator>) {
  return <Base.Separator className={cn(separator(), className)} {...props} />;
}

MenuSeparator.displayName = 'MenuSeparator';

export const MenuGroup = Base.Group;

export function MenuGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof Base.GroupLabel>) {
  return <Base.GroupLabel className={cn(groupLabel(), className)} {...props} />;
}

MenuGroupLabel.displayName = 'MenuGroupLabel';
