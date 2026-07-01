export interface StackFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
}

export interface ExceptionValue {
  type?: string;
  value?: string;
  stacktrace?: {
    frames?: StackFrame[];
  };
}

export interface ExceptionChain {
  values?: ExceptionValue[];
}

/**
 * Plain-text rendering of the full exception chain, oldest frame last
 * (matches the UI). Kept out of stack-trace.tsx (a `'use client'` module) so
 * Server Components can call it directly — everything exported from a
 * `'use client'` file is treated as client-only, even plain helpers.
 */
export function formatStackTraceAsText(exception?: ExceptionChain): string {
  const exceptions = exception?.values ?? [];
  return exceptions
    .map((exc) => {
      const header = [exc.type, exc.value].filter(Boolean).join(': ');
      const frames = [...(exc.stacktrace?.frames ?? [])].reverse();
      const frameLines = frames.map((frame) => {
        const location = [frame.filename, frame.lineno, frame.colno]
          .filter((part) => part !== undefined && part !== '')
          .join(':');
        return `  at ${frame.function || '<anonymous>'} (${location})`;
      });
      return [header, ...frameLines].join('\n');
    })
    .join('\n\n');
}
