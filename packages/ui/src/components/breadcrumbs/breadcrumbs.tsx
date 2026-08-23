import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { Fragment, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { focusRing } from '../../lib/focus';
import { interactiveTransition } from '../../lib/motion';
import { tv } from '../../lib/tv';

/**
 * Where you are, and the way back: Issues / CHECKOUT-API-4F2.
 *
 * Two levels, three at most. This is not a file tree -- the sidebar already
 * says which section you are in, so the trail only has to bridge the gap
 * between a list and the record opened from it. A trail that needs four levels
 * is a navigation problem, not a breadcrumb problem.
 *
 * The last crumb is an identifier, so it is set in mono and it is not a link:
 * you are already there. Its `aria-current="page"` is what tells a screen
 * reader the same thing the weight tells everyone else.
 */
const crumbs = tv({
  slots: {
    root: 'flex min-w-0 items-center gap-1.75 text-control',
    link: [
      'min-w-0 shrink truncate text-fg-subtle',
      'hover:text-fg-secondary',
      'rounded-xs',
      interactiveTransition,
      focusRing,
    ],
    /* An intermediate crumb with nowhere to go: the trail names the level but
       the level has no page of its own. Same colour as a link, minus every
       affordance that would promise one. */
    label: 'min-w-0 shrink truncate text-fg-subtle',
    current: 'min-w-0 truncate font-mono text-mono text-fg',
    separator: 'shrink-0 text-fg-placeholder',
  },
});

const styles = crumbs();

export interface Crumb {
  label: string;
  /**
   * The element that navigates: `<Link to="/issues" />`. Omit it and the crumb
   * is drawn as plain text -- an `<a>` with no `href` is not a link, is not
   * reachable by tab, and announces as nothing.
   */
  render?: useRender.ComponentProps<'a'>['render'];
}

export interface BreadcrumbsProps {
  /** The trail, root first. The last one is the page you are on. */
  items: Crumb[];
  /** What sits between them. A slash, because a chevron says "expand". */
  separator?: ReactNode;
  className?: string;
  /** Names the trail for a screen reader. */
  label?: string;
}

function CrumbLink({ label, render }: Crumb) {
  return useRender({
    defaultTagName: 'a',
    render,
    props: mergeProps<'a'>({ className: styles.link(), children: label }, {}),
  });
}

export function Breadcrumbs({
  items,
  separator = '/',
  className,
  label = 'Breadcrumb',
}: BreadcrumbsProps) {
  return (
    <nav aria-label={label} className={cn(styles.root(), className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1;

        return (
          <Fragment key={item.label}>
            {index > 0 ? (
              <span aria-hidden="true" className={styles.separator()}>
                {separator}
              </span>
            ) : null}

            {last ? (
              <span aria-current="page" className={styles.current()}>
                {item.label}
              </span>
            ) : item.render == null ? (
              <span className={styles.label()}>{item.label}</span>
            ) : (
              <CrumbLink {...item} />
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

Breadcrumbs.displayName = 'Breadcrumbs';
