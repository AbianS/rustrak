import type { TagSummary } from '@rustrak/client';

/**
 * Sentry-style tag distribution: one row per tag key showing the most common
 * value with a proportional bar. The percentage is the top value's share
 * among the top values returned (`top_values` is capped server-side), not
 * a share of all occurrences of the tag.
 */
export function TagDistribution({ tags }: { tags: TagSummary[] }) {
  return (
    <div className="space-y-2.5">
      {tags.map((tag) => {
        const total = tag.top_values.reduce((sum, v) => sum + v.count, 0);
        const top = tag.top_values[0];
        const pct =
          top && total > 0 ? Math.round((top.count / total) * 100) : 0;
        return (
          <div key={tag.key} className="flex items-center gap-3 text-xs">
            <span className="w-28 shrink-0 truncate font-medium text-foreground">
              {tag.key}
            </span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              className="w-9 shrink-0 text-right tabular-nums text-muted-foreground"
              title="Share of the top values shown, not of all occurrences"
            >
              {pct}%
            </span>
            <span className="w-24 shrink-0 truncate font-mono text-muted-foreground">
              {top?.value ?? '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
