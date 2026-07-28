import type { Issue } from '@rustrak/client';
import { AlertCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { TrendSparkline } from '@/components/trend-sparkline';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LevelBadge } from '@/features/issue/ui/issue-indicators';
import { compactCount, exactCount } from '@/lib/chart-format';

interface IssueListCardProps {
  projectId: number;
  issues: Issue[];
  title: string;
  /** Qualifies what the list covers, e.g. the window it is scoped to. */
  subtitle?: string;
  emptyMessage: string;
}

export function IssueListCard({
  projectId,
  issues,
  title,
  subtitle,
  emptyMessage,
}: IssueListCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </CardTitle>
        {subtitle ? (
          <CardDescription className="text-xs">{subtitle}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {issues.map((issue) => (
              <Link
                key={issue.id}
                href={`/projects/${projectId}/issues/${issue.id}`}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:text-primary transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">
                    {issue.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <LevelBadge level={issue.level} />
                    <span className="font-mono text-muted-foreground/70">
                      {issue.short_id}
                    </span>
                  </div>
                </div>

                {/* The list endpoint already computes these; showing them turns
                    a bare event count into "how many people, and is it
                    accelerating". */}
                {issue.trend && issue.trend.length > 0 ? (
                  <TrendSparkline trend={issue.trend} />
                ) : null}

                {issue.user_count !== undefined ? (
                  <span
                    className="hidden shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground sm:flex"
                    title={`${exactCount(issue.user_count)} users affected`}
                  >
                    <Users className="size-3.5" aria-hidden />
                    {compactCount(issue.user_count)}
                  </span>
                ) : null}

                <span
                  className="w-12 shrink-0 text-right font-mono text-sm text-muted-foreground"
                  title={`${exactCount(issue.event_count)} events`}
                >
                  {compactCount(issue.event_count)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
