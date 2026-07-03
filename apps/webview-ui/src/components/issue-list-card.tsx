import type { Issue } from '@rustrak/client';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { LevelBadge } from '@/components/issue-indicators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface IssueListCardProps {
  projectId: number;
  issues: Issue[];
  title: string;
  emptyMessage: string;
}

export function IssueListCard({
  projectId,
  issues,
  title,
  emptyMessage,
}: IssueListCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </CardTitle>
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
                <span className="font-mono text-sm text-muted-foreground shrink-0">
                  {issue.event_count.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
