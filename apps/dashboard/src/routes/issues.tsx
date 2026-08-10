import { Button, ReopenIcon, ResolveIcon } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/issues')({ component: Issues });

/**
 * Static rows on purpose. Wiring `@rustrak/client` is the next slice; this one
 * is about the design system rendering and the server serving a deep link.
 */
const ISSUES = [
  {
    id: 'CHECKOUT-API-4F2',
    title: "TypeError: Cannot read properties of undefined (reading 'total')",
    culprit: 'src/checkout/summary.tsx · renderTotals',
    severity: 'error',
    events: '12,431',
  },
  {
    id: 'CHECKOUT-API-3B1',
    title: 'ConnectionTimeout: pool exhausted after 30000ms',
    culprit: 'db/pool.rs · acquire',
    severity: 'fatal',
    events: '3,902',
  },
  {
    id: 'CHECKOUT-API-2C8',
    title: 'ValidationError: coupon code not applicable',
    culprit: 'src/promo/apply.ts · applyCoupon',
    severity: 'warning',
    events: '1,204',
  },
] as const;

const SEVERITY_FG = {
  fatal: 'text-fg-fatal',
  error: 'text-fg-error',
  warning: 'text-fg-warning',
} as const;

const FILTERS = ['Unresolved', 'Resolved', 'Ignored'] as const;

function Issues() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Unresolved');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-page-title text-fg">Issues</h1>

      {/* `selected` is real state here, not a static prop: it is the clearest
          way to see the variant behave under interaction. */}
      <div className="flex items-center gap-2">
        {FILTERS.map((option) => (
          <Button
            key={option}
            variant="ghost"
            size="sm"
            selected={filter === option}
            onClick={() => setFilter(option)}
          >
            {option}
          </Button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {ISSUES.map((issue) => (
          <li
            key={issue.id}
            className="flex items-center gap-4 rounded-lg bg-surface p-4 inset-ring inset-ring-border"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span
                className={`font-mono text-badge ${SEVERITY_FG[issue.severity]}`}
              >
                {issue.id}
              </span>
              <span className="truncate text-body text-fg">{issue.title}</span>
              <span className="truncate font-mono text-code text-fg-muted">
                {issue.culprit}
              </span>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-3">
              <span
                data-numeric=""
                className="text-meta text-fg-tertiary tabular-nums"
              >
                {issue.events} events
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={ReopenIcon}
                aria-label={`Reopen ${issue.id}`}
              />
              <Button variant="primary" size="sm" icon={ResolveIcon}>
                Resolve
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
