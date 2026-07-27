import type { Issue, IssuePriority } from '@rustrak/client';

/**
 * Presentation metadata for an issue indicator (#165).
 *
 * The UI favors restraint over loud color: status and priority are shown as a
 * small leading dot plus a muted text label, the way Sentry surfaces them —
 * color is a quiet signal, not the dominant visual element.
 */
export interface IssueIndicator {
  label: string;
  /** Tailwind `bg-*` class for the small leading dot. */
  dot: string;
}

const SUBSTATUS_LABELS: Record<string, string> = {
  new: 'New',
  ongoing: 'Ongoing',
  escalating: 'Escalating',
  regressed: 'Regressed',
  archived_until_escalating: 'Archived',
  archived_until_condition_met: 'Archived',
  archived_forever: 'Archived',
};

/**
 * Resolve the dot color + label for an issue's status.
 *
 * Prefers a recognized substatus label, falling back to the coarse status.
 * Unresolved (the common case) stays neutral; only resolved earns an accent.
 */
export function statusDisplay(
  issue: Pick<Issue, 'status' | 'substatus'>,
): IssueIndicator {
  const substatusLabel = issue.substatus
    ? SUBSTATUS_LABELS[issue.substatus]
    : undefined;

  switch (issue.status) {
    case 'resolved':
      return { label: 'Resolved', dot: 'bg-emerald-500' };
    case 'ignored':
      return {
        label: substatusLabel ?? 'Ignored',
        dot: 'bg-muted-foreground/40',
      };
    default:
      return {
        label: substatusLabel ?? 'Unresolved',
        dot: 'bg-muted-foreground',
      };
  }
}

const PRIORITY_META: Record<IssuePriority, IssueIndicator> = {
  high: { label: 'High', dot: 'bg-red-500' },
  medium: { label: 'Medium', dot: 'bg-amber-500' },
  low: { label: 'Low', dot: 'bg-sky-500' },
};

/**
 * Dot color + label for a priority tier, or `null` when unset.
 */
export function priorityDisplay(
  priority: IssuePriority | null | undefined,
): IssueIndicator | null {
  if (!priority) {
    return null;
  }
  return PRIORITY_META[priority] ?? null;
}
