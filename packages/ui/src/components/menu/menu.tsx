import { Menu as BaseMenu } from '@base-ui/react/menu';
import type { ReactElement, ReactNode } from 'react';
import { Count } from '../count/count';
import { ChevronRightIcon } from '../icon/icon-catalog';
import { Kbd } from '../kbd/kbd';
import { Tooltip } from '../tooltip/tooltip';
import {
  explainAction,
  type MenuAction,
  menuStyles as styles,
} from './menu-parts';

/**
 * A dropdown menu.
 *
 * The actions are described as data rather than JSX, because the same list is
 * drawn in more than one place: on the folder button that opens it, on the
 * trailing half of a split button, and in the overflow menu a row falls back to
 * when the width runs out. Written as JSX it would be written three times, and
 * the three would drift.
 */

function Trailing({ action }: { action: MenuAction }) {
  if (action.count == null && !action.shortcut) {
    return null;
  }

  return (
    <span className={styles.trailing()}>
      <Count>{action.count}</Count>
      {action.shortcut ? <Kbd>{action.shortcut}</Kbd> : null}
    </span>
  );
}

/** Wraps in a tooltip only when there is something to say. */
function MaybeTooltip({
  content,
  children,
}: {
  content?: string;
  children: ReactElement;
}) {
  if (!content) return children;

  return (
    <Tooltip content={content} side="right">
      {children}
    </Tooltip>
  );
}

/**
 * The actions of a menu, with their folders inside. Used on its own when the
 * trigger is somebody else's -- a split button, a toolbar.
 */
export function MenuActions({ actions }: { actions: MenuAction[] }) {
  return (
    <>
      {actions.map((action) => {
        const content = (
          <>
            {action.icon ? (
              <action.icon size="lg" className={styles.icon()} />
            ) : null}
            <span className={styles.label()}>{action.label}</span>
            <Trailing action={action} />
          </>
        );

        return (
          <div key={action.id} className="contents">
            {action.separated ? (
              <div aria-hidden="true" className={styles.separator()} />
            ) : null}

            {action.items ? (
              <BaseMenu.SubmenuRoot>
                {/* A folder that is off is explained too: it opens nothing, so
                    without the reason there is no trace but the grey. */}
                <MaybeTooltip content={explainAction(action)}>
                  <BaseMenu.SubmenuTrigger
                    className={styles.item()}
                    disabled={action.disabled}
                  >
                    {content}
                    <ChevronRightIcon
                      size="sm"
                      aria-hidden="true"
                      className="ms-auto shrink-0 text-fg-ghost"
                    />
                  </BaseMenu.SubmenuTrigger>
                </MaybeTooltip>
                <BaseMenu.Portal>
                  <BaseMenu.Positioner
                    sideOffset={2}
                    alignOffset={-5}
                    className={styles.positioner()}
                  >
                    <BaseMenu.Popup className={styles.popup()}>
                      <MenuActions actions={action.items} />
                    </BaseMenu.Popup>
                  </BaseMenu.Positioner>
                </BaseMenu.Portal>
              </BaseMenu.SubmenuRoot>
            ) : (
              <MaybeTooltip content={explainAction(action)}>
                <BaseMenu.Item
                  className={styles.item()}
                  data-tone={action.tone}
                  disabled={action.disabled}
                  onClick={action.onSelect}
                >
                  {content}
                </BaseMenu.Item>
              </MaybeTooltip>
            )}
          </div>
        );
      })}
    </>
  );
}

MenuActions.displayName = 'MenuActions';

export interface MenuProps {
  /** What opens it. Must accept props and a ref: a `Button`, for example. */
  trigger: ReactElement;
  actions?: MenuAction[];
  /** For what does not fit in `actions`: checkboxes, radios, headers. */
  children?: ReactNode;
  /** The keyboard footer: `['↑↓ move', 'Enter applies', 'Esc closes']`. */
  hints?: string[];
  side?: BaseMenu.Positioner.Props['side'];
  align?: BaseMenu.Positioner.Props['align'];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * The panel's measurements, for what is not a plain list of actions. Size and
   * padding only; the colour and the border come from the recipe.
   */
  popupClassName?: string;
}

/** A menu with its trigger. */
export function Menu({
  trigger,
  actions,
  children,
  hints,
  side = 'bottom',
  align = 'start',
  open,
  onOpenChange,
  popupClassName,
}: MenuProps) {
  return (
    <BaseMenu.Root open={open} onOpenChange={onOpenChange}>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner
          side={side}
          align={align}
          sideOffset={6}
          className={styles.positioner()}
        >
          <BaseMenu.Popup
            className={styles.popup({ className: popupClassName })}
          >
            {actions ? <MenuActions actions={actions} /> : null}
            {children}
            {hints?.length ? (
              <span aria-hidden="true" className={styles.hints()}>
                {hints.map((hint) => (
                  <span key={hint}>{hint}</span>
                ))}
              </span>
            ) : null}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

Menu.displayName = 'Menu';

export interface MenuItemProps {
  children: ReactNode;
  /** Makes the row navigate: `render={<Link to="/projects/4" />}`. */
  render?: ReactElement;
  onClick?: () => void;
  disabled?: boolean;
  /** Red for what destroys or leaves. */
  tone?: 'danger';
  className?: string;
}

/**
 * One row of a menu, written as JSX.
 *
 * `actions` covers the ordinary case and should stay the default: a list
 * described as data is drawn identically wherever it is opened from. This is
 * for the row that is not a label and an icon -- a project with its slug under
 * it and a tick beside it, a member with an avatar -- where the shape is the
 * point and describing it as data would mean inventing a field per shape.
 *
 * It carries the same recipe either way, so a custom row cannot drift from the
 * height, the highlight or the destructive treatment of the rows above it.
 */
export function MenuItem({
  children,
  render,
  onClick,
  disabled,
  tone,
  className,
}: MenuItemProps) {
  return (
    <BaseMenu.Item
      className={styles.item({ className })}
      data-tone={tone}
      disabled={disabled}
      onClick={onClick}
      render={render}
    >
      {children}
    </BaseMenu.Item>
  );
}

MenuItem.displayName = 'MenuItem';

/** The rule between two blocks of a menu. */
export function MenuSeparator() {
  return <div aria-hidden="true" className={styles.separator()} />;
}

MenuSeparator.displayName = 'MenuSeparator';

export interface MenuGroupProps {
  children: ReactNode;
  /** The small-caps heading over the block. */
  label?: ReactNode;
}

/**
 * A block of rows under one heading.
 *
 * The heading is a prop rather than a component of its own, and that is the
 * fix for a trap: Base UI's `GroupLabel` throws unless it sits inside a
 * `Group`, and a label and a group written as two independent components is an
 * invitation to write the label and forget the group. Here it cannot happen --
 * the heading only exists as part of the block it names, which is also what
 * makes the group labelled by it for a screen reader.
 */
export function MenuGroup({ children, label }: MenuGroupProps) {
  return (
    <BaseMenu.Group>
      {label ? (
        <BaseMenu.GroupLabel className={styles.groupLabel()}>
          {label}
        </BaseMenu.GroupLabel>
      ) : null}
      {children}
    </BaseMenu.Group>
  );
}

MenuGroup.displayName = 'MenuGroup';
