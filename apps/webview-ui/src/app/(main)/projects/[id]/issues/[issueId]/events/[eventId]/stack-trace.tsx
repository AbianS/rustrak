'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  vs,
  vscDarkPlus,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

interface StackFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
}

interface Exception {
  type?: string;
  value?: string;
  stacktrace?: {
    frames?: StackFrame[];
  };
}

interface StackTraceProps {
  exception?: {
    values?: Exception[];
  };
}

/**
 * Detect programming language from filename extension
 */
function detectLanguage(filename?: string): string {
  if (!filename) return 'text';

  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    php: 'php',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    sql: 'sql',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
  };

  return langMap[ext ?? ''] ?? 'text';
}

export function StackTrace({ exception }: StackTraceProps) {
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
      {exceptions.map((exc, i) => (
        <div key={i} className="space-y-4">
          {/* Exception Header */}
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-destructive">{exc.type}</h3>
            <p className="text-sm text-muted-foreground">{exc.value}</p>
          </div>

          {/* Frames */}
          {exc.stacktrace?.frames && (
            <div className="space-y-2">
              {[...exc.stacktrace.frames].reverse().map((frame, j) => (
                <StackFrameItem
                  key={j}
                  frame={frame}
                  index={exc.stacktrace!.frames!.length - j}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StackFrameItem({
  frame,
  index,
}: {
  frame: StackFrame;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(frame.in_app ?? false);
  const hasContext =
    frame.context_line ||
    (frame.pre_context && frame.pre_context.length > 0) ||
    (frame.post_context && frame.post_context.length > 0);

  const language = detectLanguage(frame.filename);

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden transition-colors',
        frame.in_app
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-card/50 opacity-60',
      )}
    >
      {/* Frame Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span
          className={cn(
            'text-xs font-mono',
            frame.in_app ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {String(index).padStart(2, '0')}
        </span>

        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold truncate">
            {frame.function || '<anonymous>'}
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {frame.filename}
            {frame.lineno && `:${frame.lineno}`}
            {frame.colno && `:${frame.colno}`}
          </p>
        </div>

        {hasContext && (
          <span className="text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </span>
        )}
      </button>

      {/* Frame Context with Syntax Highlighting */}
      {isExpanded && hasContext && (
        <FrameContext frame={frame} language={language} />
      )}
    </div>
  );
}

function FrameContext({
  frame,
  language,
}: {
  frame: StackFrame;
  language: string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="bg-zinc-100 dark:bg-zinc-900 font-mono text-xs leading-relaxed overflow-x-auto">
      {/* Pre-context */}
      {frame.pre_context?.map((line, i) => {
        const lineNo = (frame.lineno ?? 0) - frame.pre_context!.length + i;
        return (
          <CodeLine
            key={`pre-${i}`}
            lineNumber={lineNo}
            code={line}
            language={language}
            isHighlighted={false}
            isDark={isDark}
          />
        );
      })}

      {/* Context line (highlighted) */}
      {frame.context_line && (
        <CodeLine
          lineNumber={frame.lineno ?? 0}
          code={frame.context_line}
          language={language}
          isHighlighted={true}
          isDark={isDark}
        />
      )}

      {/* Post-context */}
      {frame.post_context?.map((line, i) => {
        const lineNo = (frame.lineno ?? 0) + i + 1;
        return (
          <CodeLine
            key={`post-${i}`}
            lineNumber={lineNo}
            code={line}
            language={language}
            isHighlighted={false}
            isDark={isDark}
          />
        );
      })}
    </div>
  );
}

function CodeLine({
  lineNumber,
  code,
  language,
  isHighlighted,
  isDark,
}: {
  lineNumber: number;
  code: string;
  language: string;
  isHighlighted: boolean;
  isDark: boolean;
}) {
  return (
    <div
      className={cn(
        'flex relative',
        isHighlighted ? 'bg-primary/15' : 'opacity-60',
      )}
    >
      {/* Highlight indicator */}
      {isHighlighted && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
      )}

      {/* Line number */}
      <span
        className={cn(
          'w-12 shrink-0 text-right pr-4 pl-3 select-none py-0.5',
          isHighlighted ? 'text-primary font-medium' : 'text-muted-foreground',
        )}
      >
        {lineNumber}
      </span>

      {/* Code with syntax highlighting */}
      <div className="flex-1 py-0.5 pr-4 overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={isDark ? vscDarkPlus : vs}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: 'inherit',
            lineHeight: 'inherit',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'inherit',
              whiteSpace: 'pre',
            },
          }}
        >
          {code || ' '}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
