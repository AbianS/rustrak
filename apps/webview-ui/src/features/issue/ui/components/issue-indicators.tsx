'use client';

import type { Issue, IssuePriority } from '@rustrak/client';
import { useTranslations } from 'next-intl';
import { priorityDisplay, statusDisplay } from '@/features/issue/model/status';
import { cn } from '@/shared/lib/utils';

/**
 * A small rounded pill: a leading color dot + label on a subtle surface. The
 * pill shape (vs. bare text) makes each value read as a distinct, labeled
 * attribute, and the `title` spells out what the value represents on hover.
 */
function Pill({
  dot,
  label,
  title,
  className,
}: {
  dot: string;
  label: string;
  title: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', dot)} />
      {label}
    </span>
  );
}

export function StatusIndicator({
  issue,
  className,
}: {
  issue: Pick<Issue, 'status' | 'substatus'>;
  className?: string;
}) {
  const t = useTranslations('issues');
  const { dot, labelKey } = statusDisplay(issue);
  const label = t(labelKey);
  return (
    <Pill
      dot={dot}
      label={label}
      title={t('statusTitle', { label })}
      className={className}
    />
  );
}

export function PriorityIndicator({
  priority,
  className,
}: {
  priority: IssuePriority | null | undefined;
  className?: string;
}) {
  const t = useTranslations('issues');
  const meta = priorityDisplay(priority);
  if (!meta) {
    return null;
  }
  const label = t(meta.labelKey);
  return (
    <Pill
      dot={meta.dot}
      label={label}
      title={t('priorityTitle', { label })}
      className={className}
    />
  );
}

const LEVEL_STYLES: Record<string, string> = {
  fatal: 'bg-red-500/10 text-red-600 dark:text-red-400',
  error: 'bg-red-500/10 text-red-600 dark:text-red-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  debug: 'bg-muted text-muted-foreground',
};

/**
 * Severity badge for an event level — color-coded so severity reads at a glance
 * (Sentry shows level this way). `null` when no level is set.
 */
export function LevelBadge({
  level,
  className,
}: {
  level: string | null | undefined;
  className?: string;
}) {
  const t = useTranslations('issues');
  if (!level) {
    return null;
  }
  const style =
    LEVEL_STYLES[level.toLowerCase()] ?? 'bg-muted text-muted-foreground';
  return (
    <span
      title={t('levelTitle', { level })}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide',
        style,
        className,
      )}
    >
      {level}
    </span>
  );
}
