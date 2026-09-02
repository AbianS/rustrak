import type { ProjectListStats } from '@rustrak/client';
import type { SparklineTone } from '@rustrak/ui';

/**
 * How alarming a project looks at a glance.
 *
 * Deliberately not derived from event volume: one chatty issue can multiply
 * events without anything new being broken, so volume is the wrong thing to
 * colour a row by. Carried over from `webview-ui`, where this signal is what
 * makes a list of six projects readable without reading any of them.
 */
export type ProjectHealth = 'critical' | 'rising' | 'quiet';

export const HEALTH_TONE: Record<ProjectHealth, SparklineTone> = {
  critical: 'danger',
  rising: 'warning',
  quiet: 'neutral',
};

export function projectHealth(stats: ProjectListStats): ProjectHealth {
  if (stats.fatal_issues > 0) return 'critical';

  const { current, previous } = stats.new_issues;
  // `previous === null` is an all-time request with nothing to compare
  // against, which is not evidence of a rise. A previous of zero is.
  if (previous !== null && current > previous) return 'rising';

  return 'quiet';
}
