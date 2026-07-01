interface IssueTrendSparklineProps {
  trend: number[];
}

/** Compact 24h event-rate sparkline for the issue list "Trend" column. */
export function IssueTrendSparkline({ trend }: IssueTrendSparklineProps) {
  if (trend.length === 0) {
    return null;
  }

  const max = Math.max(...trend, 1);
  const barWidth = 2;
  const gap = 1;

  return (
    <svg
      viewBox={`0 0 ${trend.length * (barWidth + gap)} 24`}
      className="w-16 h-6 shrink-0"
      preserveAspectRatio="none"
      role="img"
      aria-label="24h event trend"
    >
      {trend.map((count, i) => {
        const height = count > 0 ? Math.max((count / max) * 22, 2) : 0;
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={24 - height}
            width={barWidth}
            height={height}
            rx={0.5}
            className="fill-muted-foreground/50"
          />
        );
      })}
    </svg>
  );
}
