'use client';

import {
  type ExceptionChain,
  orderFramesForDisplay,
} from '@/lib/format-stack-trace';
import { StackFrameItem } from './stack-frame-item';

interface StackTraceProps {
  exception?: ExceptionChain;
  platform?: string;
}

export function StackTrace({ exception, platform }: StackTraceProps) {
  const exceptions = exception?.values ?? [];

  if (exceptions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No stack trace available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {exceptions.map((exc, i) => {
        const originalFrames = exc.stacktrace?.frames ?? [];
        const displayFrames = orderFramesForDisplay(originalFrames, platform);
        return (
          <div key={i} className="space-y-4">
            {/* Exception Header */}
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-destructive">{exc.type}</h3>
              <p className="text-sm text-muted-foreground">{exc.value}</p>
            </div>

            {/* Frames */}
            {displayFrames.length > 0 && (
              <div className="space-y-2">
                {displayFrames.map((frame) => (
                  <StackFrameItem
                    key={originalFrames.indexOf(frame)}
                    frame={frame}
                    index={originalFrames.indexOf(frame) + 1}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
