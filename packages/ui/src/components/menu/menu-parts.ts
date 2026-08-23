import { popTransition } from '../../lib/motion';
import { tv } from '../../lib/tv';
import type { IconComponent } from '../icon/icon';

/**
 * Everything about the menu that is not a component: the recipe, the two
 * class helpers `SplitButton` shares, the action shape and the one function
 * that decides what an action says on hover.
 *
 * They sit beside `menu.tsx` rather than inside it because a file that exports
 * both components and plain values is a file React Fast Refresh cannot
 * preserve state across (`react-doctor/only-export-components`).
 */
const menu = tv({
  slots: {
    /*
     * The stacking level goes on the positioner, not on the popup.
     *
     * Base UI puts `position: fixed` and its own `z-index` on `Positioner`,
     * which opens a stacking context: any height set inside it only orders its
     * own siblings. A `z-50` on the popup therefore lifts nothing, and the menu
     * ends up under a sticky table header that is a `z-10` from another
     * context.
     */
    positioner: 'z-50',
    /*
     * It scrolls down, never sideways. A menu you have to drag horizontally to
     * read a label is badly measured: the overflow is clipped with an ellipsis,
     * which also says there is more.
     */
    popup: [
      'flex max-h-(--available-height) min-w-52 flex-col',
      'overflow-x-hidden overflow-y-auto',
      'rounded-lg border border-border bg-surface-floating p-1.25',
      'shadow-overlay',
      popTransition,
    ],
    item: [
      'group/item flex h-menu-item shrink-0 cursor-default items-center gap-2.5',
      'rounded-sm px-2.5 text-control text-fg-muted outline-none select-none',
      // The highlight runs ahead of the pointer, not behind it: no transition.
      'transition-none',
      'data-highlighted:bg-surface-selected data-highlighted:text-fg',
      'data-disabled:text-fg-disabled',
      /*
       * Destructive is read before it is pressed. The red goes on the label and
       * the icon, never on the resting background: a red row at rest shouts,
       * and this is a line in a menu, not an alarm.
       */
      'data-[tone=danger]:text-danger-fg',
      'data-[tone=danger]:data-highlighted:bg-danger-surface',
    ],
    icon: [
      'shrink-0 text-fg-ghost',
      'group-data-highlighted/item:text-fg-subtle',
      'group-data-disabled/item:text-fg-disabled',
      'group-data-[tone=danger]/item:text-danger-fg',
    ],
    label: 'min-w-0 flex-1 truncate',
    trailing: 'ms-auto flex shrink-0 items-center gap-2',
    groupLabel: 'px-2.5 pt-2 pb-1 font-mono text-column text-fg-meta uppercase',
    // The rule uses `border` and not `border-subtle`: it sits on the floating
    // surface, which is the lightest thing on screen, and the subtle step
    // disappears into it entirely.
    separator: 'my-1 h-px bg-border',
    /*
     * The keyboard footer.
     *
     * Every panel in the product ends with one, and it is not decoration: this
     * is a product whose users live in the keyboard, and a menu that never says
     * `Tab completes` is a menu nobody ever learns to stop clicking.
     */
    hints: [
      'mt-1 flex shrink-0 gap-3.5 border-t border-border-subtle',
      'px-2.5 pt-2 pb-1 font-mono text-mono-sm text-fg-ghost',
    ],
  },
});

const styles = menu();

export { styles as menuStyles };

/**
 * The floating panel, shared with `SplitButton`.
 *
 * Exported rather than copied: the two are the same surface opened from two
 * different places, and a second copy of the radius, the border, the shadow and
 * the entry transition is a copy that drifts.
 */
export const menuPopupClass = styles.popup;
export const menuPositionerClass = styles.positioner;

export interface MenuAction {
  /** Stable: it is React's key and the action's identity. */
  id: string;
  label: string;
  icon?: IconComponent;
  /** The shortcut that does the same, so it is learned by reading. */
  shortcut?: string;
  /** A figure: how many are filtered, how many attachments there are. */
  count?: number | string;
  disabled?: boolean;
  /**
   * Why it is off: "Select an issue first".
   *
   * A greyed-out action with no explanation leaves whoever is looking at it
   * clicking around to find out what turns it on. It is said on hover, which is
   * exactly when the question got asked.
   */
  disabledReason?: string;
  /** What explains the action when the label falls short. */
  hint?: string;
  onSelect?: () => void;
  /** Turns the action into a folder: hovering it opens these. */
  items?: MenuAction[];
  /** Draws a rule above: separates the destructive, or another subject. */
  separated?: boolean;
  /** Red for what destroys or leaves: delete, sign out. */
  tone?: 'danger';
}

/**
 * What there is to say about an action on hover.
 *
 * One place for all three possible answers, because otherwise each surface
 * decides on its own and with its own mechanism, and one toolbar ends up with
 * two looks and two delays.
 *
 * The order matters. If it is off, the only thing worth knowing is why; the
 * hint about what it would do is beside the point.
 */
export function explainAction(
  action: MenuAction,
  iconOnly = false,
): string | undefined {
  if (action.disabled) return action.disabledReason ?? action.hint;
  if (action.hint) return action.hint;
  // With no visible label there is nothing to read: the name becomes the
  // explanation.
  return iconOnly ? action.label : undefined;
}
