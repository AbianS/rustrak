'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  type ExceptionChain,
  findBestThread,
  formatStackTraceAsText,
  matchExceptionForThread,
  orderFramesForDisplay,
  type Thread,
} from '@/features/event/lib/format-stack-trace';
import { CopyAsDropdown } from '@/shared/ui/components/copy-as-dropdown';
import { Badge } from '@/shared/ui/components/shadcn/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/components/shadcn/select';
import { StackFrameItem } from './stack-frame-item';

interface ThreadsSectionProps {
  threads: Thread[];
  exception?: ExceptionChain;
  platform?: string;
}

function threadLabel(
  thread: Thread,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  return thread.name || t('threads.threadLabel', { id: thread.id ?? '?' });
}

function threadKey(thread: Thread, index: number): string {
  return thread.id !== undefined ? String(thread.id) : `idx-${index}`;
}

export function ThreadsSection({
  threads,
  exception,
  platform,
}: ThreadsSectionProps) {
  const t = useTranslations('events');
  const bestThread = useMemo(() => findBestThread(threads), [threads]);
  const [activeKey, setActiveKey] = useState<string>(() =>
    bestThread ? threadKey(bestThread, threads.indexOf(bestThread)) : '',
  );

  if (threads.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('stackTrace.empty')}
      </div>
    );
  }

  const activeThread =
    threads.find((thread, i) => threadKey(thread, i) === activeKey) ??
    bestThread;
  const matchedException = matchExceptionForThread(exception, activeThread);

  const originalFrames =
    matchedException?.stacktrace?.frames ??
    activeThread?.stacktrace?.frames ??
    [];
  const displayFrames = orderFramesForDisplay(originalFrames, platform);

  const copyFormats = matchedException
    ? [
        {
          label: t('copy.plainText'),
          value: formatStackTraceAsText(
            { values: [matchedException] },
            platform,
          ),
        },
        {
          label: t('copy.json'),
          value: JSON.stringify(matchedException, null, 2),
        },
      ]
    : [{ label: t('copy.json'), value: JSON.stringify(activeThread, null, 2) }];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {threads.length > 1 ? (
          <Select
            value={activeKey}
            onValueChange={(value) => {
              if (value) setActiveKey(value);
            }}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {threads.map((thread, i) => (
                <SelectItem
                  key={threadKey(thread, i)}
                  value={threadKey(thread, i)}
                >
                  {threadLabel(thread, t)}
                  {thread.crashed ? t('threads.crashedSuffix') : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm font-semibold">
            {activeThread ? threadLabel(activeThread, t) : t('threads.thread')}
          </p>
        )}

        <div className="flex items-center gap-2">
          {activeThread?.crashed && (
            <Badge variant="destructive">{t('threads.crashed')}</Badge>
          )}
          {activeThread?.current && (
            <Badge variant="outline">{t('threads.current')}</Badge>
          )}
          {activeThread?.main && (
            <Badge variant="outline">{t('threads.main')}</Badge>
          )}
          {activeThread?.state && (
            <Badge variant="secondary">{activeThread.state}</Badge>
          )}
          <CopyAsDropdown formats={copyFormats} />
        </div>
      </div>

      {matchedException && (
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-destructive">
            {matchedException.type}
          </h3>
          <p className="text-sm text-muted-foreground">
            {matchedException.value}
          </p>
        </div>
      )}

      {displayFrames.length > 0 ? (
        <div className="space-y-2">
          {displayFrames.map((frame) => {
            const originalIdx = originalFrames.indexOf(frame);
            return (
              <StackFrameItem
                key={originalIdx}
                frame={frame}
                index={originalIdx + 1}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          {t('stackTrace.emptyForThread')}
        </div>
      )}
    </div>
  );
}
