import type { Issue } from '@rustrak/client';
import type { Translator } from '@rustrak/i18n';
import {
  ArrowRightIcon,
  Button,
  Card,
  CardBody,
  CardEmpty,
  CardHeader,
  focusRing,
  interactiveTransition,
  Sparkline,
  type SparklineTone,
  Tag,
  type TagTone,
  Text,
} from '@rustrak/ui';
import { Link } from '@tanstack/react-router';
import { numberFormats, relativeTime } from './format';

interface TopIssuesProps {
  issues: readonly Issue[];
  projectId: number;
  t: Translator;
}

/** The SDK's own vocabulary, so it is not translated: it is what the payload says. */
const LEVEL_TONE: Record<string, { tag: TagTone; spark: SparklineTone }> = {
  fatal: { tag: 'error', spark: 'danger' },
  error: { tag: 'error', spark: 'danger' },
  warning: { tag: 'warning', spark: 'warning' },
};

function toneFor(level: string | null) {
  return (
    LEVEL_TONE[level ?? ''] ?? {
      tag: 'info' as const,
      spark: 'neutral' as const,
    }
  );
}

/**
 * The five open issues producing the most events.
 *
 * It is the issue list's own row, minus the tick box and the hover actions:
 * level, what broke and where, the shape of the last day, and the two figures
 * that decide whether it matters. Anything less is a list of titles, and a
 * list of titles is not worth a third of an overview.
 *
 * All time rather than the selected window, and the subtitle says so: the
 * endpoint ranks by an issue's lifetime `event_count`, so a window here would
 * be a label over a ranking that does not honour it.
 */
export function TopIssues({ issues, projectId, t }: TopIssuesProps) {
  const { integer, compact } = numberFormats(t.locale);

  return (
    <Card fill>
      <CardHeader
        actions={
          <Button
            icon={ArrowRightIcon}
            render={
              <Link
                params={{ id: String(projectId) }}
                to="/projects/$id/issues"
              />
            }
            size="xs"
            variant="ghost"
          >
            {t.t('projectOverview.viewAll')}
          </Button>
        }
        subtitle={t.t('projectOverview.topIssuesSubtitle')}
        title={t.t('projectOverview.topIssues')}
      />
      <CardBody>
        {issues.length === 0 ? (
          <CardEmpty>{t.t('projectOverview.noIssues')}</CardEmpty>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="flex items-center gap-3 border-b border-border-divider pb-1.5"
            >
              <span className="hidden w-16 shrink-0 sm:block" />
              <Text className="min-w-0 flex-1" tone="meta" variant="column">
                {t.t('projectOverview.colIssue')}
              </Text>
              <Text
                className="hidden w-[110px] shrink-0 sm:block"
                tone="meta"
                variant="column"
              >
                {t.t('projectOverview.colTrend')}
              </Text>
              <Text
                className="w-16 shrink-0 text-end"
                tone="meta"
                variant="column"
              >
                {t.t('projectOverview.colEvents')}
              </Text>
              <Text
                className="hidden w-14 shrink-0 text-end md:block"
                tone="meta"
                variant="column"
              >
                {t.t('projectOverview.colUsers')}
              </Text>
            </div>

            <ul aria-label={t.t('projectOverview.topIssues')}>
              {issues.map((issue) => {
                const tone = toneFor(issue.level);

                return (
                  <li
                    key={issue.id}
                    className="border-b border-border-divider last:border-0"
                  >
                    {/* The whole row is the link, not the title inside it: a
                        4 px target in a 44 px row is a row that reads as
                        clickable and behaves as if it is not. */}
                    <Link
                      className={`-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 ${interactiveTransition} ${focusRing} hover:bg-surface-hover`}
                      params={{ id: String(projectId), issue: issue.id }}
                      to="/projects/$id/issues/$issue"
                    >
                      {/* On a phone the level moves down to the meta line. Its
                        column is 64 px, which is a fifth of the row there, and
                        the title is what people are reading. */}
                      <span className="hidden w-16 shrink-0 sm:block">
                        <Tag tone={tone.tag}>{issue.level ?? 'error'}</Tag>
                      </span>

                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <Text truncate variant="value">
                          {issue.title}
                        </Text>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Tag className="sm:hidden" tone={tone.tag}>
                            {issue.level ?? 'error'}
                          </Tag>
                          <Text tone="ghost" truncate variant="mono-sm">
                            {/* The identifier and where it fired are how you
                              refer to an issue later. On 390 px the answer to
                              "is it still happening" is worth more, and it is
                              the only one of the three that fits. */}
                            <span className="hidden sm:inline">
                              {issue.short_id}
                              {issue.culprit ? ` · ${issue.culprit}` : ''}
                              {' · '}
                            </span>
                            {relativeTime(t.locale, issue.last_seen)}
                          </Text>
                        </span>
                      </span>

                      {issue.trend?.length ? (
                        <Sparkline
                          className="hidden shrink-0 sm:block"
                          label={t.t('projectOverview.trendLabel', {
                            title: issue.title,
                          })}
                          tone={tone.spark}
                          values={issue.trend}
                        />
                      ) : (
                        <span className="hidden w-[110px] shrink-0 sm:block" />
                      )}

                      <Text
                        className="w-16 shrink-0 text-end"
                        truncate
                        variant="mono"
                      >
                        {compact.format(issue.event_count)}
                      </Text>

                      <Text
                        className="hidden w-14 shrink-0 text-end md:block"
                        tone="tertiary"
                        truncate
                        variant="mono"
                      >
                        {integer.format(issue.user_count ?? 0)}
                      </Text>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}
