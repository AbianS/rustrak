import type { ReactNode } from 'react';

/**
 * Shared surface for every chart tooltip on the dashboard, so hover feels the
 * same everywhere. Charts supply the rows; this owns the chrome.
 */
export function ChartTooltipSurface({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {children}
    </div>
  );
}

/**
 * One `swatch — label — value` line inside a tooltip.
 *
 * The swatch carries the series identity; the text stays in text tokens. A
 * light chart hue is illegible as text on the surface, so the color never
 * touches the label.
 */
export function ChartTooltipRow({
  color,
  label,
  value,
}: {
  color?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {color ? (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-[2px]"
          style={{ background: color }}
        />
      ) : null}
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums text-popover-foreground">
        {value}
      </span>
    </div>
  );
}

/** Muted caption line, normally the bucket timestamp. */
export function ChartTooltipCaption({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-muted-foreground">{children}</p>;
}

/**
 * Legend shared by the charts that carry two or more series.
 *
 * Always rendered when a chart has more than one series: identity must never
 * rest on color alone.
 */
export function ChartLegend({
  items,
}: {
  items: Array<{ label: string; color: string }>;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            aria-hidden
            className="size-2 rounded-[2px]"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
