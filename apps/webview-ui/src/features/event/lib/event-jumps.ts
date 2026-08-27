import type { readEventPayload } from '@/features/event/lib/event-payload';

/** The "does this event have anything to show here?" flags. */
export type EventJumpFlags = ReturnType<typeof readEventPayload>['has'];

/** An anchor the "jump to" strip can offer. */
export type EventJumpTarget =
  | 'highlights'
  | 'stacktrace'
  | 'breadcrumbs'
  | 'tags'
  | 'context';

/**
 * The sections this event actually has, in render order.
 *
 * An anchor to a section that is not on the page is worse than no anchor: it
 * scrolls nowhere and reads as a broken page rather than as an event that
 * simply carried no breadcrumbs.
 */
export function eventJumpTargets(has: EventJumpFlags): EventJumpTarget[] {
  const targets: EventJumpTarget[] = ['highlights'];

  if (has.stackTrace) targets.push('stacktrace');
  if (has.breadcrumbs) targets.push('breadcrumbs');
  if (has.tags) targets.push('tags');

  // One anchor for three panels: contexts, modules and the user render
  // together under a single heading.
  if (has.contexts || has.modules || has.user) targets.push('context');

  return targets;
}
