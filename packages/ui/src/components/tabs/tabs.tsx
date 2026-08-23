import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { focusRing } from '../../lib/focus';
import { interactiveTransition, slideTransition } from '../../lib/motion';
import { tv, type VariantProps } from '../../lib/tv';
import type { WithClassName } from '../../lib/types';

/**
 * The tabs that split one record or one list into views: Unresolved / Resolved
 * / Muted, or Details / Events / Breadcrumbs / Traces.
 *
 * There is no box and no pill. The tab is a word on the page and the only
 * chrome is the lime rule underneath it, because these sit directly under a
 * page title on a dark canvas and any container would make the header look
 * like a toolbar. What separates one tab from the next is the gap between
 * them, not padding inside them, so the rule ends up exactly as wide as the
 * word it belongs to.
 *
 * The rule does not jump from one tab to the next, it slides. It is the only
 * animation in the system that lasts longer than instant, and it earns the
 * time: the travel is what says where you came from. The selected tab also
 * gains weight, so somebody who cannot pick lime out still finds it.
 *
 * Base UI supplies `aria-selected`, `role="tabpanel"` and arrow-key
 * navigation; only the appearance lives here.
 *
 * Its default of manual activation is kept: the arrows move focus and Enter or
 * Space chooses. In this product a tab is a different query -- Events against
 * Traces against Breadcrumbs -- so activating on focus would fire four
 * requests on the way from the first tab to the last.
 */
const tabs = tv({
  slots: {
    list: 'relative flex items-center gap-5 border-b border-border-subtle',
    tab: [
      'relative flex h-tab shrink-0 items-center gap-1.75',
      'whitespace-nowrap text-fg-muted',
      'hover:text-fg-secondary',
      // Base UI marks the chosen tab with `data-active`, not `data-selected`.
      'data-active:font-semibold data-active:text-fg',
      'data-disabled:text-fg-disabled data-disabled:hover:text-fg-disabled',
      interactiveTransition,
      focusRing,
    ],
    indicator: [
      'absolute bottom-0 left-0 h-(--stroke-indicator) bg-surface-brand',
      'w-(--active-tab-width) translate-x-(--active-tab-left)',
      slideTransition,
    ],
    panel: 'pt-4 outline-none',
  },
  variants: {
    /*
     * Two sizes because the design uses two: a list splits at the value size,
     * and a record's tabs -- which sit below an already busy header -- drop to
     * the control size so the header has one clear largest thing in it.
     */
    size: {
      md: { tab: 'text-value' },
      sm: { tab: 'text-control' },
    },
  },
  defaultVariants: { size: 'md' },
});

export type TabsSize = NonNullable<VariantProps<typeof tabs>['size']>;

export interface TabsProps extends WithClassName<BaseTabs.Root.Props> {}

export function Tabs({ className, ...props }: TabsProps) {
  return (
    <BaseTabs.Root className={cn('flex flex-col', className)} {...props} />
  );
}

Tabs.displayName = 'Tabs';

export interface TabListProps extends WithClassName<BaseTabs.List.Props> {
  /** Pushed to the far right of the strip: a filter summary, a sort order. */
  meta?: ReactNode;
}

export function TabList({ className, children, meta, ...props }: TabListProps) {
  const styles = tabs();

  return (
    <BaseTabs.List className={styles.list({ className })} {...props}>
      {children}
      {/* `renderBeforeHydration` paints the position into the server HTML, so
          the rule does not snap into place when React takes over. */}
      <BaseTabs.Indicator
        renderBeforeHydration
        className={styles.indicator()}
      />
      {meta ? <span className="ms-auto pb-0.5">{meta}</span> : null}
    </BaseTabs.List>
  );
}

TabList.displayName = 'TabList';

export interface TabProps
  extends WithClassName<BaseTabs.Tab.Props>,
    VariantProps<typeof tabs> {}

export function Tab({ size, className, ...props }: TabProps) {
  return (
    <BaseTabs.Tab className={tabs({ size }).tab({ className })} {...props} />
  );
}

Tab.displayName = 'Tab';

export interface TabPanelProps extends WithClassName<BaseTabs.Panel.Props> {}

export function TabPanel({ className, ...props }: TabPanelProps) {
  return <BaseTabs.Panel className={tabs().panel({ className })} {...props} />;
}

TabPanel.displayName = 'TabPanel';
