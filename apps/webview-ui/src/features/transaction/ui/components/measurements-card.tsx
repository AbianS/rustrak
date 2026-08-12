'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/utils';

interface Measurement {
  value?: number;
  unit?: string;
}

interface MeasurementsCardProps {
  measurements: Record<string, unknown>;
}

// Web-vital thresholds (good / needs-improvement boundaries) from web.dev.
// Values in ms unless noted. Unknown keys render without a rating.
const VITALS: Record<string, { labelKey: string; good: number; poor: number }> =
  {
    lcp: { labelKey: 'lcp', good: 2500, poor: 4000 },
    fcp: { labelKey: 'fcp', good: 1800, poor: 3000 },
    fid: { labelKey: 'fid', good: 100, poor: 300 },
    inp: { labelKey: 'inp', good: 200, poor: 500 },
    ttfb: { labelKey: 'ttfb', good: 800, poor: 1800 },
    cls: { labelKey: 'cls', good: 0.1, poor: 0.25 },
  };

function rating(key: string, value: number): 'good' | 'meh' | 'poor' | null {
  const v = VITALS[key.toLowerCase()];
  if (!v) return null;
  if (value <= v.good) return 'good';
  if (value <= v.poor) return 'meh';
  return 'poor';
}

const RATING_STYLES: Record<'good' | 'meh' | 'poor', string> = {
  good: 'text-primary',
  meh: 'text-yellow-600 dark:text-yellow-500',
  poor: 'text-destructive',
};

function formatValue(value: number, unit?: string): string {
  if (unit === 'millisecond' || unit == null) {
    if (value < 1000) return `${Math.round(value)}ms`;
    return `${(value / 1000).toFixed(2)}s`;
  }
  if (unit === 'ratio' || unit === 'none') return value.toFixed(3);
  if (unit === 'second') return `${value.toFixed(2)}s`;
  return `${value} ${unit}`;
}

export function MeasurementsCard({ measurements }: MeasurementsCardProps) {
  const t = useTranslations('transactions');

  const entries = Object.entries(measurements)
    .map(([key, raw]): [string, Measurement] | null => {
      const m = raw as Measurement | null;
      return m && typeof m.value === 'number' ? [key, m] : null;
    })
    .filter((e): e is [string, Measurement] => e !== null);

  if (entries.length === 0) return null;

  // Known vitals first, then the rest.
  entries.sort(([a], [b]) => {
    const av = a.toLowerCase() in VITALS ? 0 : 1;
    const bv = b.toLowerCase() in VITALS ? 0 : 1;
    return av - bv;
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {entries.map(([key, m]) => {
        const value = m.value as number;
        const r = rating(key, value);
        const vital = VITALS[key.toLowerCase()];
        const label = vital ? t(`measurements.${vital.labelKey}`) : key;
        return (
          <div key={key} className="rounded-lg border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div
              className={cn(
                'mt-1 font-mono text-lg font-semibold',
                r ? RATING_STYLES[r] : 'text-foreground',
              )}
            >
              {formatValue(value, m.unit)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
