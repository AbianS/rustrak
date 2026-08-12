'use client';

import { useTranslations } from 'next-intl';
import {
  type ExceptionChain,
  orderFramesForDisplay,
} from '@/features/event/lib/format-stack-trace';
import { StackFrameItem } from './stack-frame-item';

interface StackTraceProps {
  exception?: ExceptionChain;
  platform?: string;
}

export function StackTrace({ exception, platform }: StackTraceProps) {
  const t = useTranslations('events');
  const exceptions = exception?.values ?? [];

  if (exceptions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('stackTrace.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {exceptions.map((exc, i) => {
        const originalFrames = exc.stacktrace?.frames ?? [];
        const displayFrames = orderFramesForDisplay(originalFrames, platform);
        return (
          // An exception chain read once off a stored event. It has no id, and
          // `type` repeats across a chain that rethrows the same class, so the
          // position is the only thing that identifies a link. The list never
          // reorders or filters: a different event is a different route.
          // react-doctor-disable-next-line react-doctor/no-array-index-as-key
          <div key={i} className="space-y-4">
            {/* Exception Header */}
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-destructive">{exc.type}</h3>
              <p className="text-sm text-muted-foreground">{exc.value}</p>
            </div>

            {/* Frames */}
            {displayFrames.length > 0 && (
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
            )}
          </div>
        );
      })}
    </div>
  );
}
